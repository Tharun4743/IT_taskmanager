import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, initDB } from './db.js';
import { syncAndGenerateStudentDirectory, constantStudentByIdMap, constantStudentByRegNoMap, constantStudentByEmailMap, constantStudentsByClassMap } from './studentDirectoryService.js';
import { cleanupOnlyTaskScreenshots } from './imageCleanupService.js';
import { generateDatabaseSnapshot } from './dbBackupService.js';
import { initSentry, captureException } from './sentryService.js';
import * as XLSX from 'xlsx';

// ─── Async Route Error Wrapper ────────────────────────────────────────────────
// Express 4 does not catch async errors automatically.
// This wrapper forwards unhandled promise rejections to the error middleware.
const asyncHandler = (fn: (req: any, res: any, next: NextFunction) => Promise<any>) =>
  (req: any, res: any, next: NextFunction) => fn(req, res, next).catch(next);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL STARTUP ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}

const missingCloudinary = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
].filter(key => !process.env[key]);

if (missingCloudinary.length > 0) {
  console.error(`FATAL STARTUP ERROR: Missing required Cloudinary configuration: ${missingCloudinary.join(', ')}`);
  process.exit(1);
}

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'academic-task-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    resource_type: 'auto',
  } as any,
});

const upload = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Express App ──────────────────────────────────────────────────────────────
async function startServer() {
  // Initialize PostgreSQL database schemas and tables
  await initDB();
  await syncAndGenerateStudentDirectory().catch(err => console.error('[StudentDirectory] Startup sync warning:', err));

  // Initialize Sentry Production Error Tracking
  initSentry();

  // Trigger initial 7-day screenshot cleanup and schedule daily background execution (every 24 hours)
  cleanupOnlyTaskScreenshots().catch(err => console.error('[ImageCleanup] Startup cleanup warning:', err));
  setInterval(() => {
    cleanupOnlyTaskScreenshots().catch(err => console.error('[ImageCleanup] Scheduled cleanup warning:', err));
  }, 24 * 60 * 60 * 1000);

  // Trigger initial DB snapshot backup and schedule daily execution (every 24 hours)
  generateDatabaseSnapshot().catch(err => console.error('[DBBackup] Startup snapshot warning:', err));
  setInterval(() => {
    generateDatabaseSnapshot().catch(err => console.error('[DBBackup] Scheduled snapshot warning:', err));
  }, 24 * 60 * 60 * 1000);

  const app = express();

  // Enable trust proxy so express-rate-limit correctly identifies individual client IPs behind reverse proxies (Render, Cloudflare, Nginx)
  app.set('trust proxy', 1);

  // Lightweight Health Check Endpoint (for keep-alive pings)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
  });

  // ── Security configuration ───────────────────────────────────────────────────
  const maxRequests = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 3000;
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxRequests, // Dynamic request limit (defaults to 3000 requests per 15 minutes)
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'development',
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests from this IP, please try again after 15 minutes' });
    }
  });

  app.use('/api/', apiLimiter);
  // Gzip/Brotli compression — reduces JSON response sizes by ~70%, critical for slow mobile connections
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(cors({
    origin: function (origin, callback) {
      const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'https://vsbec.unaux.com', 'https://it-taskmanager.onrender.com'];
      if (!origin || allowedOrigins.includes(origin) || (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)) {
        callback(null, true);
      } else {
        console.warn(`CORS rejected origin: ${origin}`);
        callback(null, false); // Fail silently instead of throwing error for unrecognized origins
      }
    },
    credentials: true
  }));

  const healthCheckHandler = async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('[Health Check Error]: Database connectivity failed:', err.message);
      res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
    }
  };

  app.get('/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);

  // ─── In-Memory User Auth Cache (2-minute TTL) to protect DB pool ─────────────
  const userAuthCache = new Map<string, { user: any; expiresAt: number }>();

  // Auth Middleware - Fetches dynamic permissions with 2-minute caching
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;
      const now = Date.now();

      let user: any = null;
      const cached = userAuthCache.get(userId);
      if (cached && cached.expiresAt > now) {
        user = cached.user;
      } else {
        const dbUserRes = await pool.query(
          'SELECT id, username, role, department_id, class_id, is_coordinator, is_year_coordinator, year_scope, register_number FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        user = dbUserRes.rows[0];
        if (user) {
          userAuthCache.set(userId, { user, expiresAt: now + 120000 });
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      req.user = {
        id: user.id,
        username: user.username || user.register_number,
        role: user.role || 'STUDENT',
        department_id: user.department_id,
        class_id: user.class_id,
        is_coordinator: Boolean(user.is_coordinator),
        is_year_coordinator: Boolean(user.is_year_coordinator),
        year_scope: user.year_scope,
      };
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const authorize = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  // Admin endpoint: Trigger manual purge of proof screenshots older than 7 days
  app.post('/api/admin/purge-old-screenshots', authenticate, authorize(['SUPREME_ADMIN', 'HOD']), asyncHandler(async (req: Request, res: Response) => {
    const purgedCount = await cleanupOnlyTaskScreenshots();
    res.json({ message: `Successfully purged ${purgedCount} task proof screenshots older than 7 days.`, purgedCount });
  }));

  // Admin endpoint: Export complete database JSON snapshot
  app.get('/api/admin/export-db-snapshot', authenticate, authorize(['SUPREME_ADMIN', 'HOD']), asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await generateDatabaseSnapshot();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(snapshot.filePath)}"`);
    res.send(JSON.stringify(snapshot.backupPayload, null, 2));
  }));

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Login accepts `email` field for HOD/Advisor accounts.
  // Students may still log in using their Registration Number (intentional).
  app.post('/api/auth/login', asyncHandler(async (req: any, res: Response) => {
    const { email, username, password } = req.body;
    // Accept either `email` (new) or `username` (legacy) field from the client
    const loginId = (email || username || '').trim();
    if (!loginId) return res.status(401).json({ error: 'Invalid credentials' });

    const cleanPassword = (password || '').trim();

    let userRes = await pool.query(
      'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER($1) OR LOWER(TRIM(register_number)) = LOWER($1) OR LOWER(TRIM(email)) = LOWER($1) LIMIT 1',
      [loginId]
    );
    let user = userRes.rows[0];

    // Secondary DB search removing space differences (e.g. accidental spaces in inputs or DB records)
    if (!user) {
      const cleanLoginIdNoSpaces = loginId.replace(/\s+/g, '').toLowerCase();
      userRes = await pool.query(
        "SELECT * FROM users WHERE REPLACE(LOWER(username), ' ', '') = $1 OR REPLACE(LOWER(register_number), ' ', '') = $1 OR REPLACE(LOWER(email), ' ', '') = $1 LIMIT 1",
        [cleanLoginIdNoSpaces]
      );
      user = userRes.rows[0];
    }

    // 1. Check Student Directory first for authoritative student records
    const dirKey = loginId.replace(/\s+/g, '').toLowerCase();
    const directoryStudent = constantStudentByEmailMap.get(dirKey) || constantStudentByRegNoMap.get(dirKey);

    if (directoryStudent) {
      try {
        const defaultPassHash = await bcrypt.hash(directoryStudent.register_number.trim(), 10);
        let validClassId = (directoryStudent.class_id && directoryStudent.class_id !== 'unassigned') ? directoryStudent.class_id : null;
        let validDeptId = (directoryStudent.department_id && directoryStudent.department_id !== 'unassigned') ? directoryStudent.department_id : null;

        if (!validClassId && directoryStudent.class_name) {
          const matchedClassRes = await pool.query('SELECT id, department_id FROM classes WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1', [directoryStudent.class_name]);
          if (matchedClassRes.rows[0]) {
            validClassId = matchedClassRes.rows[0].id;
            if (!validDeptId) validDeptId = matchedClassRes.rows[0].department_id;
          }
        }

        const studentUsername = (directoryStudent.email || directoryStudent.register_number).trim();

        // Check if user already exists in database
        const existingUserRes = await pool.query('SELECT * FROM users WHERE register_number = $1 OR username = $2', [directoryStudent.register_number.trim(), studentUsername]);

        if (existingUserRes.rows.length === 0) {
          // New student -> Insert with default password
          const syncedUserRes = await pool.query(`
            INSERT INTO users (
              username, password, role, department_id, class_id, full_name, email, register_number, gender
            ) VALUES ($1, $2, 'STUDENT', $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            studentUsername,
            defaultPassHash,
            validDeptId,
            validClassId,
            directoryStudent.full_name || 'Student',
            directoryStudent.email || null,
            directoryStudent.register_number.trim(),
            directoryStudent.gender || 'Not Specified'
          ]);
          user = syncedUserRes.rows[0];
        } else {
          // Existing student user -> preserve their updated DB password!
          user = existingUserRes.rows[0];
        }
      } catch (syncErr) {
        console.error('[Auth] Error syncing student from directory:', syncErr);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate password strictly against user.password in DB
    let isPasswordValid = false;
    try {
      if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
        isPasswordValid = await bcrypt.compare(cleanPassword, user.password) ||
          (password && await bcrypt.compare(password, user.password)) ||
          await bcrypt.compare(cleanPassword.toLowerCase(), user.password) ||
          await bcrypt.compare(cleanPassword.toUpperCase(), user.password);
      } else {
        isPasswordValid = (cleanPassword === user.password) || (password === user.password);
      }
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      department_id: user.department_id,
      class_id: user.class_id,
      is_coordinator: Boolean(user.is_coordinator),
      is_year_coordinator: Boolean(user.is_year_coordinator),
      year_scope: user.year_scope,
    }, JWT_SECRET);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        register_number: user.register_number,
        gender: user.gender,
        department_id: user.department_id,
        class_id: user.class_id,
        is_coordinator: Boolean(user.is_coordinator),
        is_year_coordinator: Boolean(user.is_year_coordinator),
        year_scope: user.year_scope,
      }
    });
  }));

  app.get('/api/auth/me', authenticate, asyncHandler(async (req: any, res: Response) => {
    const userRes = await pool.query(`
      SELECT 
        u.id, u.username, u.role, u.full_name, u.email, u.register_number, u.gender,
        u.phone, u.bio, u.github_url, u.linkedin_url, u.avatar_url,
        u.department_id, u.class_id, u.is_coordinator, u.is_year_coordinator, u.year_scope,
        d.name as department_name, c.name as class_name, c.year, c.batch
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1 LIMIT 1
    `, [req.user.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
      register_number: user.register_number,
      gender: user.gender,
      phone: user.phone || '',
      bio: user.bio || '',
      github_url: user.github_url || '',
      linkedin_url: user.linkedin_url || '',
      avatar_url: user.avatar_url || '',
      department_id: user.department_id,
      department_name: user.department_name,
      class_id: user.class_id,
      class_name: user.class_name,
      year: user.year,
      batch: user.batch,
      is_coordinator: Boolean(user.is_coordinator),
      is_year_coordinator: Boolean(user.is_year_coordinator),
      year_scope: user.year_scope,
    });
  }));



  // 1. Personal Info Update
  app.put('/api/student/profile/personal', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { mobile_number, date_of_birth, semester, cgpa, current_arrears, history_of_arrears, about_me } = req.body;

    const result = await pool.query(`
      INSERT INTO student_profiles (user_id, mobile_number, date_of_birth, semester, cgpa, current_arrears, history_of_arrears, about_me, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        mobile_number = EXCLUDED.mobile_number,
        date_of_birth = EXCLUDED.date_of_birth,
        semester = EXCLUDED.semester,
        cgpa = EXCLUDED.cgpa,
        current_arrears = EXCLUDED.current_arrears,
        history_of_arrears = EXCLUDED.history_of_arrears,
        about_me = EXCLUDED.about_me,
        updated_at = NOW()
      RETURNING *
    `, [userId, mobile_number || null, date_of_birth || null, semester || 1, cgpa || 0, current_arrears || 0, history_of_arrears || 0, about_me || null]);

    res.json({ message: 'Personal details updated', personal: result.rows[0] });
  });

  // 2. Skills
  app.post('/api/student/profile/skills', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { skill_name, category, level } = req.body;
    if (!skill_name || !skill_name.trim()) return res.status(400).json({ error: 'Skill name required' });

    const result = await pool.query(`
      INSERT INTO student_skills (user_id, skill_name, category, level)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [userId, skill_name.trim(), category || 'Technical', level || 'Intermediate']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/skills/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_skills WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // 3. Projects
  app.post('/api/student/profile/projects', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { project_name, description, tech_stack, github_url, live_demo_url } = req.body;
    if (!project_name || !project_name.trim()) return res.status(400).json({ error: 'Project name required' });

    const result = await pool.query(`
      INSERT INTO student_projects (user_id, project_name, description, tech_stack, github_url, live_demo_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, project_name.trim(), description || '', tech_stack || '', github_url || '', live_demo_url || '']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/projects/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // 4. Internships
  app.post('/api/student/profile/internships', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { company, role, duration, mode, certificate_url } = req.body;
    if (!company || !company.trim()) return res.status(400).json({ error: 'Company name required' });

    const result = await pool.query(`
      INSERT INTO student_internships (user_id, company, role, duration, mode, certificate_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, company.trim(), role || '', duration || '', mode || 'Offline', certificate_url || '']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/internships/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_internships WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // 5. Certifications
  app.post('/api/student/profile/certifications', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { certificate_name, provider, issue_date, credential_id, certificate_url } = req.body;
    if (!certificate_name || !certificate_name.trim()) return res.status(400).json({ error: 'Certificate name required' });

    const result = await pool.query(`
      INSERT INTO student_certifications (user_id, certificate_name, provider, issue_date, credential_id, certificate_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, certificate_name.trim(), provider || '', issue_date || '', credential_id || '', certificate_url || '']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/certifications/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_certifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // 6. Coding Profiles
  app.put('/api/student/profile/coding-profiles', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio } = req.body;

    const result = await pool.query(`
      INSERT INTO student_coding_profiles (user_id, github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        github = EXCLUDED.github,
        leetcode = EXCLUDED.leetcode,
        hackerrank = EXCLUDED.hackerrank,
        codechef = EXCLUDED.codechef,
        geeksforgeeks = EXCLUDED.geeksforgeeks,
        linkedin = EXCLUDED.linkedin,
        portfolio = EXCLUDED.portfolio,
        updated_at = NOW()
      RETURNING *
    `, [userId, github || '', leetcode || '', hackerrank || '', codechef || '', geeksforgeeks || '', linkedin || '', portfolio || '']);
    res.json(result.rows[0]);
  });

  // 7. Resume
  app.post('/api/student/profile/resume', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { resume_url, file_name } = req.body;
    if (!resume_url) return res.status(400).json({ error: 'Resume URL / link required' });

    const result = await pool.query(`
      INSERT INTO student_resumes (user_id, resume_url, file_name, last_updated)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        resume_url = EXCLUDED.resume_url,
        file_name = EXCLUDED.file_name,
        last_updated = NOW()
      RETURNING *
    `, [userId, resume_url, file_name || 'Resume.pdf']);
    res.json(result.rows[0]);
  });

  // 8. Achievements
  app.post('/api/student/profile/achievements', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { title, category, description, event_date } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

    const result = await pool.query(`
      INSERT INTO student_achievements (user_id, title, category, description, event_date)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [userId, title.trim(), category || 'Hackathons', description || '', event_date || '']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/achievements/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_achievements WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // 9. Languages
  app.post('/api/student/profile/languages', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const { language, proficiency } = req.body;
    if (!language || !language.trim()) return res.status(400).json({ error: 'Language name required' });

    const result = await pool.query(`
      INSERT INTO student_languages (user_id, language, proficiency)
      VALUES ($1, $2, $3) RETURNING *
    `, [userId, language.trim(), proficiency || 'Fluent']);
    res.json(result.rows[0]);
  });

  app.delete('/api/student/profile/languages/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    await pool.query('DELETE FROM student_languages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  // ── Departments ───────────────────────────────────────────────────────────
  app.get('/api/departments', authenticate, async (req, res) => {
    const deptsRes = await pool.query('SELECT * FROM departments ORDER BY created_at ASC');
    res.json(deptsRes.rows.map(d => ({ id: d.id, name: d.name, created_at: d.created_at })));
  });

  app.post('/api/departments', authenticate, authorize(['SUPREME_ADMIN']), async (req, res) => {
    const { name } = req.body;
    if (name !== 'Information Technology') {
      return res.status(400).json({ error: 'Only Information Technology department is allowed.' });
    }
    try {
      const resDept = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
      const d = resDept.rows[0];
      res.json({ id: d.id, name: d.name });
    } catch (e) {
      res.status(400).json({ error: 'Department already exists' });
    }
  });

  app.delete('/api/departments/:id', authenticate, authorize(['SUPREME_ADMIN']), async (req, res) => {
    const deptId = req.params.id;
    // Collect Cloudinary assets BEFORE the transaction (external side-effect, best-effort)
    let cloudinaryIds: string[] = [];
    try {
      const classesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1', [deptId]);
      const classIds = classesRes.rows.map((c: any) => c.id);
      if (classIds.length > 0 || deptId) {
        const userIds = classIds.length > 0
          ? (await pool.query('SELECT id FROM users WHERE department_id = $1 OR class_id = ANY($2)', [deptId, classIds])).rows.map((u: any) => u.id)
          : (await pool.query('SELECT id FROM users WHERE department_id = $1', [deptId])).rows.map((u: any) => u.id);
        if (userIds.length > 0) {
          const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = ANY($1)', [userIds]);
          cloudinaryIds = subsRes.rows.filter((r: any) => r.cloudinary_public_id).map((r: any) => r.cloudinary_public_id);
        }
      }
    } catch (err) {
      console.error('Pre-delete Cloudinary lookup error:', err);
    }

    // Atomic DB deletion wrapped in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const classesRes = await client.query('SELECT id FROM classes WHERE department_id = $1', [deptId]);
      const classIds = classesRes.rows.map((c: any) => c.id);
      const userIds = classIds.length > 0
        ? (await client.query('SELECT id FROM users WHERE department_id = $1 OR class_id = ANY($2)', [deptId, classIds])).rows.map((u: any) => u.id)
        : (await client.query('SELECT id FROM users WHERE department_id = $1', [deptId])).rows.map((u: any) => u.id);
      if (userIds.length > 0) {
        await client.query('DELETE FROM notifications WHERE user_id = ANY($1)', [userIds]);
        await client.query('DELETE FROM task_submissions WHERE user_id = ANY($1)', [userIds]);
        await client.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      }
      const tasksRes = await client.query('SELECT id FROM tasks WHERE department_id = $1', [deptId]);
      const taskIds = tasksRes.rows.map((t: any) => t.id);
      if (taskIds.length > 0) {
        await client.query('DELETE FROM task_submissions WHERE task_id = ANY($1)', [taskIds]);
        await client.query('DELETE FROM task_classes WHERE task_id = ANY($1)', [taskIds]);
        await client.query('DELETE FROM tasks WHERE id = ANY($1)', [taskIds]);
      }
      await client.query('DELETE FROM classes WHERE department_id = $1', [deptId]);
      await client.query('DELETE FROM departments WHERE id = $1', [deptId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to delete department:', err);
      return res.status(500).json({ error: 'Failed to delete department' });
    } finally {
      client.release();
    }

    // Destroy Cloudinary assets after successful DB commit (best-effort)
    if (cloudinaryIds.length > 0) {
      try { await cloudinary.api.delete_resources(cloudinaryIds); } catch (e) { console.error('Cloudinary cleanup error:', e); }
    }
    res.json({ success: true });
  });

  // ── Classes ───────────────────────────────────────────────────────────────
  app.get('/api/classes', authenticate, async (req: any, res) => {
    let classesRes;
    if (req.user.role === 'SUPREME_ADMIN') {
      classesRes = await pool.query(`
        SELECT c.*, d.name as department_name
        FROM classes c
        LEFT JOIN departments d ON c.department_id = d.id
        ORDER BY c.year ASC, c.name ASC
      `);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
        department_name: c.department_name,
      })));
    } else if (req.user.role === 'HOD') {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 ORDER BY year ASC, name ASC', [req.user.department_id]);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      })));
    } else if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 AND year = $2 ORDER BY year ASC, name ASC', [req.user.department_id, req.user.year_scope]);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      })));
    } else {
      if (!req.user.class_id) {
        return res.json([]);
      }
      classesRes = await pool.query('SELECT * FROM classes WHERE id = $1', [req.user.class_id]);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      })));
    }
  });

  app.post('/api/classes', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { name, department_id, year, batch } = req.body;
    if (!name || !name.trim() || !year || !batch) {
      return res.status(400).json({ error: 'Name, year, and batch are required.' });
    }
    if (req.user.role === 'SUPREME_ADMIN' && !department_id) {
      return res.status(400).json({ error: 'Department ID is required.' });
    }
    if (req.user.role === 'CLASS_ADVISOR') {
      if (!req.user.class_id) return res.status(400).json({ error: 'No class assigned to advisor' });
      await pool.query('UPDATE classes SET name = $1, year = $2, batch = $3, updated_at = NOW() WHERE id = $4', [name, year, batch, req.user.class_id]);
      return res.json({ id: req.user.class_id, name, year, batch });
    }
    const deptId = req.user.role === 'SUPREME_ADMIN' ? department_id : req.user.department_id;
    const newClassRes = await pool.query(
      'INSERT INTO classes (name, department_id, year, batch) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, deptId, year, batch]
    );
    const c = newClassRes.rows[0];
    res.json({ id: c.id, name: c.name, department_id: deptId, year, batch });
  });

  app.delete('/api/classes/:id', authenticate, authorize(['SUPREME_ADMIN', 'HOD']), async (req: any, res) => {
    const classId = req.params.id;
    if (req.user.role === 'HOD') {
      const clsRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [classId]);
      const cls = clsRes.rows[0];
      if (!cls || cls.department_id.toString() !== req.user.department_id.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Collect Cloudinary assets before transaction (external side-effect)
    let cloudinaryIds: string[] = [];
    try {
      const studentIds = (await pool.query("SELECT id FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId])).rows.map((s: any) => s.id);
      if (studentIds.length > 0) {
        const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = ANY($1)', [studentIds]);
        cloudinaryIds = subsRes.rows.filter((r: any) => r.cloudinary_public_id).map((r: any) => r.cloudinary_public_id);
      }
    } catch (err) { console.error('Pre-delete Cloudinary lookup error:', err); }

    // Atomic DB deletion
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const studentIds = (await client.query("SELECT id FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId])).rows.map((s: any) => s.id);
      if (studentIds.length > 0) {
        await client.query('DELETE FROM notifications WHERE user_id = ANY($1)', [studentIds]);
        await client.query('DELETE FROM task_submissions WHERE user_id = ANY($1)', [studentIds]);
        await client.query('DELETE FROM users WHERE id = ANY($1)', [studentIds]);
      }
      await client.query(
        "UPDATE users SET class_id = NULL, is_year_coordinator = FALSE, year_scope = NULL, updated_at = NOW() WHERE class_id = $1 AND role = 'CLASS_ADVISOR'",
        [classId]
      );
      await client.query('DELETE FROM task_classes WHERE class_id = $1', [classId]);
      await client.query('DELETE FROM classes WHERE id = $1', [classId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to delete class:', err);
      return res.status(500).json({ error: 'Failed to delete class' });
    } finally {
      client.release();
    }

    if (cloudinaryIds.length > 0) {
      try { await cloudinary.api.delete_resources(cloudinaryIds); } catch (e) { console.error('Cloudinary cleanup error:', e); }
    }
    res.json({ success: true });
  });

  app.get('/api/my-class', authenticate, authorize(['CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    if (req.user.role === 'STUDENT' && !req.user.is_coordinator) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.user.class_id) return res.json(null);
    const clsRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [req.user.class_id]);
    const cls = clsRes.rows[0];
    if (!cls) return res.json(null);
    res.json({ id: cls.id, name: cls.name, year: cls.year, batch: cls.batch, department_id: cls.department_id });
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  app.get('/api/users', authenticate, async (req: any, res) => {
    let usersRes;
    if (req.user.role === 'SUPREME_ADMIN') {
      usersRes = await pool.query(`
        SELECT u.*, d.name as department_name, c.name as class_name, c.year as class_year
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role != 'SUPREME_ADMIN'
        ORDER BY u.role ASC, c.year ASC NULLS LAST, c.name ASC NULLS LAST, u.register_number ASC NULLS LAST, u.full_name ASC
      `);
    } else if (req.user.role === 'HOD') {
      usersRes = await pool.query(`
        SELECT u.*, c.name as class_name, c.year as class_year
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.department_id = $1 AND u.role != 'SUPREME_ADMIN'
        ORDER BY u.role ASC, c.year ASC NULLS LAST, c.name ASC NULLS LAST, u.register_number ASC NULLS LAST, u.full_name ASC
      `, [req.user.department_id]);
    } else if (req.user.role === 'CLASS_ADVISOR' || req.user.role === 'STUDENT') {
      if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
        usersRes = await pool.query(`
          SELECT u.*, c.name as class_name, c.year as class_year
          FROM users u
          LEFT JOIN classes c ON u.class_id = c.id
          WHERE u.department_id = $1 AND c.year = $2 AND u.role = 'STUDENT'
          ORDER BY c.name ASC, u.register_number ASC, u.full_name ASC
        `, [req.user.department_id, req.user.year_scope]);
      } else {
        const classIdStr = (req.user.class_id || '').toString();
        const cachedStudents = constantStudentsByClassMap.get(classIdStr);

        if (cachedStudents && cachedStudents.length > 0) {
          const liveStatusRes = await pool.query('SELECT id, is_coordinator, is_active FROM users WHERE class_id = $1 AND role = \'STUDENT\'', [req.user.class_id]);
          const liveCoordsMap = new Map<string, boolean>();
          const liveActiveMap = new Map<string, boolean>();
          liveStatusRes.rows.forEach(r => {
            liveCoordsMap.set(r.id.toString(), Boolean(r.is_coordinator));
            liveActiveMap.set(r.id.toString(), r.is_active !== false);
          });

          return res.json(cachedStudents.map(st => ({
            id: st.id,
            username: st.register_number,
            role: 'STUDENT',
            full_name: st.full_name,
            email: st.email,
            register_number: st.register_number,
            gender: st.gender,
            is_coordinator: liveCoordsMap.get(st.id.toString()) || false,
            is_active: liveActiveMap.get(st.id.toString()) !== false,
            department_id: st.department_id,
            department_name: st.department_name,
            class_id: st.class_id,
            class_name: st.class_name,
            is_year_coordinator: false,
            year_scope: null,
          })));
        } else {
          usersRes = await pool.query(`
            SELECT u.*, c.name as class_name
            FROM users u
            LEFT JOIN classes c ON u.class_id = c.id
            WHERE u.class_id = $1 AND u.role = 'STUDENT'
            ORDER BY u.register_number ASC, u.full_name ASC
          `, [req.user.class_id]);
        }
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(usersRes.rows.map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      full_name: u.full_name,
      email: u.email,
      register_number: u.register_number,
      gender: u.gender,
      is_coordinator: u.is_coordinator,
      is_active: u.is_active,
      department_id: u.department_id,
      department_name: u.department_name,
      class_id: u.class_id,
      class_name: u.class_name,
      is_year_coordinator: u.is_year_coordinator,
      year_scope: u.year_scope,
    })));
  });

  app.post('/api/users', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { username, password, role, department_id, class_id, full_name, email, register_number, is_year_coordinator, year_scope } = req.body;

    let userRole = role;
    let deptId = department_id || null;
    let clsId = class_id || null;

    if (req.user.role === 'CLASS_ADVISOR') {
      userRole = 'STUDENT'; deptId = req.user.department_id; clsId = req.user.class_id;
    } else if (req.user.role === 'HOD') {
      userRole = role === 'STUDENT' ? 'STUDENT' : 'CLASS_ADVISOR';
      deptId = req.user.department_id;
      if (clsId) {
        const targetClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [clsId]);
        const targetClass = targetClassRes.rows[0];
        if (!targetClass || targetClass.department_id.toString() !== req.user.department_id.toString()) {
          return res.status(403).json({ error: 'Forbidden: Class does not belong to your department' });
        }
      }
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const finalPassword = password || register_number || username;
    const hashed = await bcrypt.hash(finalPassword, 10);

    try {
      const newUserRes = await pool.query(`
        INSERT INTO users (
          username, password, role, department_id, class_id, full_name, email,
          register_number, is_coordinator, is_year_coordinator, year_scope
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, $10)
        RETURNING *
      `, [
        username.trim(), hashed, userRole, deptId, clsId, full_name?.trim(),
        email?.trim() || null, register_number?.trim() || null,
        is_year_coordinator || false, year_scope || null
      ]);
      const u = newUserRes.rows[0];
      res.json({ id: u.id, username, role: userRole, department_id: deptId, class_id: clsId, full_name, email, register_number });
    } catch (e: any) {
      const isDuplicate = e.code === '23505';
      const field = isDuplicate ? (e.detail?.includes('username') ? 'Username' : 'Register Number') : '';
      res.status(400).json({ error: isDuplicate ? `${field} already exists. Please choose a different one.` : 'Failed to create user' });
    }
  });

  // Dedicated endpoint for student creation
  app.post('/api/users/students', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { fullName, registrationNumber, password, classId } = req.body;

    if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Full Name is required' });
    if (!registrationNumber || !registrationNumber.trim()) return res.status(400).json({ error: 'Registration Number is required' });

    let clsId = classId || null;
    let deptId = req.user.department_id || null;

    if (req.user.role === 'CLASS_ADVISOR') {
      clsId = req.user.class_id;
      deptId = req.user.department_id;
    } else if (req.user.role === 'HOD') {
      deptId = req.user.department_id;
      if (!clsId) return res.status(400).json({ error: 'Class ID is required' });
      // Validate class belongs to HOD department
      const targetClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [clsId]);
      const targetClass = targetClassRes.rows[0];
      if (!targetClass || targetClass.department_id.toString() !== req.user.department_id.toString()) {
        return res.status(403).json({ error: 'Forbidden: Class does not belong to your department' });
      }
    } else if (req.user.role === 'SUPREME_ADMIN') {
      if (!clsId) return res.status(400).json({ error: 'Class ID is required' });
      const targetClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [clsId]);
      const targetClass = targetClassRes.rows[0];
      if (!targetClass) return res.status(400).json({ error: 'Invalid Class ID' });
      deptId = targetClass.department_id;
    }

    const finalPassword = (password || registrationNumber || '').trim();
    const hashed = await bcrypt.hash(finalPassword, 10);

    try {
      const newUserRes = await pool.query(`
        INSERT INTO users (
          username, password, role, department_id, class_id, full_name, register_number
        ) VALUES ($1, $2, 'STUDENT', $3, $4, $5, $6)
        RETURNING *
      `, [
        registrationNumber.trim(), hashed, deptId, clsId, fullName.trim(), registrationNumber.trim()
      ]);
      const u = newUserRes.rows[0];
      await syncAndGenerateStudentDirectory().catch(err => console.error('[StudentDirectory] Sync on student create warning:', err));
      res.json({ id: u.id, username: u.username, role: u.role, department_id: u.department_id, class_id: u.class_id, full_name: u.full_name, register_number: u.register_number });
    } catch (e: any) {
      const isDuplicate = e.code === '23505';
      const field = isDuplicate ? (e.detail?.includes('username') ? 'Username' : 'Register Number') : '';
      res.status(400).json({ error: isDuplicate ? `${field} already exists. Please choose a different one.` : 'Failed to create student' });
    }
  });

  // Dedicated endpoint for advisor creation
  app.post('/api/users/advisors', authenticate, authorize(['SUPREME_ADMIN', 'HOD']), async (req: any, res) => {
    const { fullName, username, password, classId, is_year_coordinator, year_scope } = req.body;

    if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Full Name is required' });
    if (!username || !username.trim()) return res.status(400).json({ error: 'Username/Email is required' });

    let clsId = classId || null;
    let deptId = req.user.department_id || null;

    if (req.user.role === 'HOD') {
      deptId = req.user.department_id;
      if (clsId) {
        const targetClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [clsId]);
        const targetClass = targetClassRes.rows[0];
        if (!targetClass || targetClass.department_id.toString() !== req.user.department_id.toString()) {
          return res.status(403).json({ error: 'Forbidden: Class does not belong to your department' });
        }
      }
    } else if (req.user.role === 'SUPREME_ADMIN') {
      if (clsId) {
        const targetClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [clsId]);
        const targetClass = targetClassRes.rows[0];
        if (!targetClass) return res.status(400).json({ error: 'Invalid Class ID' });
        deptId = targetClass.department_id;
      } else {
        return res.status(400).json({ error: 'Class ID is required' });
      }
    }

    const finalPassword = password || username;
    const hashed = await bcrypt.hash(finalPassword, 10);

    try {
      const newUserRes = await pool.query(`
        INSERT INTO users (
          username, password, role, department_id, class_id, full_name, email,
          is_coordinator, is_year_coordinator, year_scope
        ) VALUES ($1, $2, 'CLASS_ADVISOR', $3, $4, $5, $6, FALSE, $7, $8)
        RETURNING *
      `, [
        username.trim(), hashed, deptId, clsId, fullName.trim(), username.trim(),
        is_year_coordinator || false, year_scope || null
      ]);
      const u = newUserRes.rows[0];
      res.json({ id: u.id, username: u.username, role: u.role, department_id: u.department_id, class_id: u.class_id, full_name: u.full_name, email: u.email });
    } catch (e: any) {
      const isDuplicate = e.code === '23505';
      const field = isDuplicate ? 'Username/Email' : '';
      res.status(400).json({ error: isDuplicate ? `${field} already exists. Please choose a different one.` : 'Failed to create advisor' });
    }
  });

  app.post('/api/students/bulk', authenticate, authorize(['CLASS_ADVISOR']), async (req: any, res) => {
    const { students } = req.body;
    const classId = req.user.class_id;
    const deptId = req.user.department_id;
    if (!classId) return res.status(400).json({ error: 'You are not assigned to any class.' });
    // Bug 5: validate that students is an array before iterating
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'students must be a non-empty array.' });
    }

    let success = 0, failed = 0;
    for (const s of students) {
      try {
        const rawRegNo = s.register_number != null ? String(s.register_number).trim() : '';
        // Bug 5: skip entries without a valid register number to avoid inserting 'undefined'
        if (!rawRegNo || rawRegNo === 'undefined') { failed++; continue; }
        const regNo = rawRegNo;
        // Bug 5: use async hash to avoid blocking the event loop on Render
        const hashed = await bcrypt.hash(regNo, 10);
        await pool.query(`
          INSERT INTO users (
            username, password, role, department_id, class_id, full_name, email, register_number
          ) VALUES ($1, $2, 'STUDENT', $3, $4, $5, $6, $7)
        `, [regNo, hashed, deptId, classId, s.name?.trim() || null, s.email?.trim() || null, regNo]);
        success++;
      } catch { failed++; }
    }
    res.json({ success, failed });
  });

  app.patch('/api/users/:id/coordinator', authenticate, authorize(['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN']), async (req: any, res) => {
    const { is_coordinator } = req.body;
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'CLASS_ADVISOR') {
      if (target.class_id?.toString() !== req.user.class_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden: Student does not belong to your class' });
      }
    } else if (req.user.role === 'HOD') {
      if (target.department_id?.toString() !== req.user.department_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden: Student does not belong to your department' });
      }
    }

    await pool.query('UPDATE users SET is_coordinator = $1, updated_at = NOW() WHERE id = $2', [is_coordinator, req.params.id]);

    const cached = constantStudentByIdMap.get(req.params.id.toString());
    if (cached) {
      (cached as any).is_coordinator = Boolean(is_coordinator);
    }

    res.json({ success: true });
  });

  app.patch('/api/users/:id/year-coordinator', authenticate, authorize(['HOD', 'SUPREME_ADMIN']), async (req: any, res) => {
    const { is_year_coordinator, year_scope } = req.body;
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'HOD' && target.department_id?.toString() !== req.user.department_id?.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (target.role !== 'CLASS_ADVISOR' && is_year_coordinator) {
      return res.status(400).json({ error: 'Only Class Advisors can be assigned as Year Coordinators' });
    }

    await pool.query(
      'UPDATE users SET is_year_coordinator = $1, year_scope = $2, updated_at = NOW() WHERE id = $3',
      [is_year_coordinator, is_year_coordinator ? year_scope : null, req.params.id]
    );
    res.json({ success: true });
  });


  app.patch('/api/users/:id/reset-password', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    const targetUser = targetRes.rows[0];
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'HOD' && targetUser.department_id?.toString() !== req.user.department_id?.toString())
      return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'CLASS_ADVISOR' && targetUser.class_id?.toString() !== req.user.class_id?.toString())
      return res.status(403).json({ error: 'Forbidden' });

    const newPass = targetUser.register_number || targetUser.username;
    const hashed = await bcrypt.hash(newPass, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashed, req.params.id]);
    res.json({ success: true, message: `Password reset to ${newPass}` });
  });

  app.delete('/api/users/:id', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'SUPREME_ADMIN') {
      if (target.role === 'SUPREME_ADMIN') return res.status(403).json({ error: 'Cannot delete Supreme Admin account' });
    } else if (req.user.role === 'HOD') {
      if (target.department_id?.toString() !== req.user.department_id?.toString() || target.role === 'SUPREME_ADMIN' || target.role === 'HOD')
        return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'CLASS_ADVISOR') {
      if (target.role !== 'STUDENT' || target.class_id?.toString() !== req.user.class_id?.toString())
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Clean up Cloudinary assets first
    try {
      const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = $1 AND cloudinary_public_id IS NOT NULL', [req.params.id]);
      const cids = subsRes.rows.map(r => r.cloudinary_public_id).filter(Boolean);
      if (cids.length > 0) {
        try {
          await cloudinary.api.delete_resources(cids);
        } catch (err) {
          console.error('Failed to delete user submission images from Cloudinary:', err);
        }
      }
    } catch (err) {
      console.error('Failed to retrieve user submissions for Cloudinary cleanup:', err);
    }

    await pool.query('DELETE FROM task_submissions WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await syncAndGenerateStudentDirectory().catch(err => console.error('[StudentDirectory] Sync on delete warning:', err));
    res.json({ success: true });
  });

  // Export & Generate Year-Wise Folders & Section-Wise Files for Students
  app.post('/api/admin/generate-student-directory', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    try {
      const result = await syncAndGenerateStudentDirectory();
      res.json({ message: 'Student directory generated successfully', ...result });
    } catch (err: any) {
      console.error('[StudentDirectory] Failed to generate directory:', err);
      res.status(500).json({ error: 'Failed to generate student directory', details: err.message });
    }
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────
  app.get('/api/tasks', authenticate, async (req: any, res) => {
    const dbUser = req.user;
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    let tasksRes;
    if (dbUser.role === 'SUPREME_ADMIN') {
      tasksRes = await pool.query(`
        SELECT t.*, u.full_name as creator_name, d.name as department_name,
               (SELECT array_remove(array_agg(class_id), NULL) FROM task_classes WHERE task_id = t.id) as class_ids
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN departments d ON t.department_id = d.id
        ORDER BY t.created_at DESC
      `);
    } else if (dbUser.role === 'STUDENT' || dbUser.role === 'CLASS_ADVISOR') {
      let query = `
        SELECT t.*, u.full_name as creator_name, d.name as department_name,
               (SELECT array_remove(array_agg(class_id), NULL) FROM task_classes WHERE task_id = t.id) as class_ids
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.created_by = $1
           OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
           OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
           OR EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id AND class_id = $3)
      `;
      let params: any[] = [dbUser.id, dbUser.department_id, dbUser.class_id];

      if (dbUser.is_year_coordinator) {
        const yearClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1 AND year = $2', [dbUser.department_id, dbUser.year_scope]);
        const yearClassIds = yearClassesRes.rows.map(c => c.id);
        if (yearClassIds.length > 0) {
          query += ' OR EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id AND class_id = ANY($4))';
          params.push(yearClassIds);
        }
      }

      query += ' ORDER BY t.created_at DESC';
      tasksRes = await pool.query(query, params);
    } else {
      // HOD
      const deptClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1', [dbUser.department_id]);
      const deptClassIds = deptClassesRes.rows.map(c => c.id);

      let query = `
        SELECT t.*, u.full_name as creator_name, d.name as department_name,
               (SELECT array_remove(array_agg(class_id), NULL) FROM task_classes WHERE task_id = t.id) as class_ids
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.created_by = $1
           OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
           OR t.department_id = $2
      `;
      let params: any[] = [dbUser.id, dbUser.department_id];

      if (deptClassIds.length > 0) {
        query += ' OR EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id AND class_id = ANY($3))';
        params.push(deptClassIds);
      }

      query += ' ORDER BY t.created_at DESC';
      tasksRes = await pool.query(query, params);
    }

    const tasks = tasksRes.rows;
    const taskIds = tasks.map(t => t.id);

    let countsMap: Record<string, number> = {};
    if (taskIds.length > 0) {
      let countsRes;
      if (dbUser.role === 'STUDENT' && !dbUser.is_coordinator) {
        // Normal students do not receive submission counts
        countsMap = {};
      } else if (dbUser.role === 'STUDENT' && dbUser.is_coordinator) {
        // Coordinator sees submission count ONLY for students in their class
        countsRes = await pool.query(`
          SELECT ts.task_id, count(*) as count
          FROM task_submissions ts
          JOIN users u ON ts.user_id = u.id
          WHERE ts.task_id = ANY($1) 
            AND ts.status IN ('SUBMITTED', 'VERIFIED')
            AND u.class_id = $2
          GROUP BY ts.task_id
        `, [taskIds, dbUser.class_id]);
        countsRes.rows.forEach(c => {
          countsMap[c.task_id] = parseInt(c.count);
        });
      } else if (dbUser.role === 'CLASS_ADVISOR') {
        if (dbUser.is_year_coordinator && dbUser.year_scope) {
          // Year Coordinator Advisor sees count for classes in their year scope
          const yearClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1 AND year = $2', [dbUser.department_id, dbUser.year_scope]);
          const yearClassIds = yearClassesRes.rows.map(c => c.id);
          countsRes = await pool.query(`
            SELECT ts.task_id, count(*) as count
            FROM task_submissions ts
            JOIN users u ON ts.user_id = u.id
            WHERE ts.task_id = ANY($1) 
              AND ts.status IN ('SUBMITTED', 'VERIFIED')
              AND u.class_id = ANY($2)
            GROUP BY ts.task_id
          `, [taskIds, yearClassIds]);
        } else {
          // Regular Advisor sees count ONLY for their assigned class
          countsRes = await pool.query(`
            SELECT ts.task_id, count(*) as count
            FROM task_submissions ts
            JOIN users u ON ts.user_id = u.id
            WHERE ts.task_id = ANY($1) 
              AND ts.status IN ('SUBMITTED', 'VERIFIED')
              AND u.class_id = $2
            GROUP BY ts.task_id
          `, [taskIds, dbUser.class_id]);
        }
        countsRes.rows.forEach(c => {
          countsMap[c.task_id] = parseInt(c.count);
        });
      } else if (dbUser.role === 'HOD') {
        // HOD sees count across ALL sections in their department
        countsRes = await pool.query(`
          SELECT ts.task_id, count(*) as count
          FROM task_submissions ts
          JOIN users u ON ts.user_id = u.id
          WHERE ts.task_id = ANY($1) 
            AND ts.status IN ('SUBMITTED', 'VERIFIED')
            AND u.department_id = $2
          GROUP BY ts.task_id
        `, [taskIds, dbUser.department_id]);
        countsRes.rows.forEach(c => {
          countsMap[c.task_id] = parseInt(c.count);
        });
      } else {
        // SUPREME_ADMIN sees global count across all classes
        countsRes = await pool.query(`
          SELECT task_id, count(*) as count
          FROM task_submissions
          WHERE task_id = ANY($1) AND status IN ('SUBMITTED', 'VERIFIED')
          GROUP BY task_id
        `, [taskIds]);
        countsRes.rows.forEach(c => {
          countsMap[c.task_id] = parseInt(c.count);
        });
      }
    }

    res.json(tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      external_link: t.external_link,
      deadline: t.deadline,
      screenshot_instruction: t.screenshot_instruction,
      custom_field_label: t.custom_field_label,
      creator_name: t.creator_name || 'Admin',
      department_id: t.department_id,
      department_name: t.department_name || null,
      class_ids: t.class_ids,
      status: t.status,
      submission_type: t.submission_type || 'INDIVIDUAL',
      min_team_size: t.min_team_size ?? 2,
      max_team_size: t.max_team_size ?? 5,
      created_at: t.created_at,
      poster_url: t.poster_url || null,
      poster_cloudinary_public_id: t.poster_cloudinary_public_id || null,
      submission_count: countsMap[t.id] || 0
    })));
  });

  // Dedicated Poster Image Upload Endpoint
  app.post('/api/upload/poster', authenticate, upload.single('poster'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No poster image file provided' });
    res.json({
      poster_url: req.file.path,
      poster_cloudinary_public_id: req.file.filename
    });
  });

  const taskSchemaValidator = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    external_link: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    screenshot_instruction: z.string().optional().nullable(),
    custom_field_label: z.string().optional().nullable(),
    department_id: z.union([z.string(), z.number(), z.null()]).optional(),
    class_ids: z.array(z.any()).optional().nullable(),
    poster_url: z.string().optional().nullable(),
    poster_cloudinary_public_id: z.string().optional().nullable(),
    submission_type: z.string().optional().nullable(),
    min_team_size: z.union([z.number(), z.string()]).optional().nullable(),
    max_team_size: z.union([z.number(), z.string()]).optional().nullable(),
  });

  const submissionSchemaValidator = z.object({
    task_id: z.string().min(1, 'Task ID is required'),
    custom_field_value: z.string().optional(),
    not_participating_reason: z.string().optional()
  });

  app.get('/api/tasks/:id', authenticate, async (req: any, res) => {
    const taskId = req.params.id;
    const taskRes = await pool.query(`
      SELECT t.*, u.full_name as creator_name, d.name as department_name,
             (SELECT array_remove(array_agg(class_id), NULL) FROM task_classes WHERE task_id = t.id) as class_ids
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.id = $1 LIMIT 1
    `, [taskId]);
    const t = taskRes.rows[0];
    if (!t) return res.status(404).json({ error: 'Task not found' });

    const countsRes = await pool.query(`
      SELECT count(*) as count FROM task_submissions WHERE task_id = $1 AND status IN ('SUBMITTED', 'VERIFIED')
    `, [taskId]);
    const submission_count = parseInt(countsRes.rows[0].count);

    res.json({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      external_link: t.external_link,
      deadline: t.deadline,
      screenshot_instruction: t.screenshot_instruction,
      custom_field_label: t.custom_field_label,
      creator_name: t.creator_name || 'Admin',
      department_id: t.department_id,
      department_name: t.department_name || null,
      class_ids: t.class_ids,
      status: t.status,
      submission_type: t.submission_type || 'INDIVIDUAL',
      min_team_size: t.min_team_size ?? 2,
      max_team_size: t.max_team_size ?? 5,
      created_at: t.created_at,
      poster_url: t.poster_url || null,
      poster_cloudinary_public_id: t.poster_cloudinary_public_id || null,
      submission_count
    });
  });

  app.post('/api/tasks', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    try {
      taskSchemaValidator.parse(req.body);
    } catch (e: any) {
      let errorMessage = 'Invalid task data';
      if (e && e.errors && Array.isArray(e.errors)) {
        errorMessage = e.errors.map((err: any) => err.message || String(err)).join(', ');
      } else if (e && e.message) {
        errorMessage = e.message;
      }
      return res.status(400).json({ error: errorMessage });
    }
    const { title, description, category, external_link, deadline, screenshot_instruction, custom_field_label, department_id, class_ids, poster_url, poster_cloudinary_public_id, submission_type, min_team_size, max_team_size } = req.body;

    if (req.user.role === 'STUDENT' && !req.user.is_coordinator)
      return res.status(403).json({ error: 'Only coordinators can post tasks' });

    const dbUserRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const dbUser = dbUserRes.rows[0];
    if (!dbUser) return res.status(401).json({ error: 'User not found' });

    let deptId = department_id || null;
    let clsIds = class_ids || [];

    if (dbUser.role === 'CLASS_ADVISOR' || (dbUser.role === 'STUDENT' && dbUser.is_coordinator)) {
      deptId = dbUser.department_id;
      if (!dbUser.is_year_coordinator || (class_ids && class_ids.length > 0)) {
        clsIds = (class_ids && class_ids.length > 0) ? class_ids : [dbUser.class_id];
      }
    } else if (dbUser.role === 'HOD') {
      deptId = dbUser.department_id;
      if (!class_ids || class_ids.length === 0) {
        return res.status(400).json({ error: 'HOD must select at least one target class before posting the task.' });
      }
    }

    if (dbUser.is_year_coordinator && !department_id && (!class_ids || class_ids.length === 0)) {
      const yearClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1 AND year = $2', [dbUser.department_id, dbUser.year_scope]);
      clsIds = yearClassesRes.rows.map(c => c.id);
    }

    if (clsIds.length > 0) {
      if (dbUser.role === 'CLASS_ADVISOR' || (dbUser.role === 'STUDENT' && dbUser.is_coordinator)) {
        if (dbUser.is_year_coordinator) {
          const validClassesRes = await pool.query('SELECT id FROM classes WHERE id = ANY($1) AND department_id = $2 AND year = $3', [clsIds, dbUser.department_id, dbUser.year_scope]);
          if (validClassesRes.rowCount !== clsIds.length) {
            return res.status(403).json({ error: 'Forbidden: Cannot assign tasks to classes outside your department or year scope' });
          }
        } else {
          const onlyOwn = clsIds.every((cid: any) => cid.toString() === dbUser.class_id?.toString());
          if (!onlyOwn) {
            return res.status(403).json({ error: 'Forbidden: Cannot assign tasks to other classes' });
          }
        }
      } else if (dbUser.role === 'HOD') {
        const validClassesRes = await pool.query('SELECT id FROM classes WHERE id = ANY($1) AND department_id = $2', [clsIds, dbUser.department_id]);
        if (validClassesRes.rowCount !== clsIds.length) {
          return res.status(403).json({ error: 'Forbidden: Cannot assign tasks to classes outside your department' });
        }
      }
    }

    // Validate deadline before hitting the DB
    const parsedDeadline = deadline ? new Date(deadline) : null;
    if (parsedDeadline && isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ error: 'Invalid deadline date format.' });
    }

    const cleanSubmissionType = (submission_type === 'TEAM') ? 'TEAM' : 'INDIVIDUAL';
    const cleanMinTeam = parseInt(min_team_size, 10) || 2;
    const cleanMaxTeam = parseInt(max_team_size, 10) || 5;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const taskInsertRes = await client.query(`
        INSERT INTO tasks (
          title, description, category, external_link, deadline,
          screenshot_instruction, custom_field_label, created_by, department_id, status,
          poster_url, poster_cloudinary_public_id, submission_type, min_team_size, max_team_size
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        title, description, category, external_link, parsedDeadline,
        screenshot_instruction, custom_field_label, dbUser.id, deptId,
        poster_url || null, poster_cloudinary_public_id || null,
        cleanSubmissionType, cleanMinTeam, cleanMaxTeam
      ]);
      const t = taskInsertRes.rows[0];

      for (const cid of clsIds) {
        await client.query('INSERT INTO task_classes (task_id, class_id) VALUES ($1, $2)', [t.id, cid]);
      }

      if (clsIds.length > 0) {
        await client.query(
          `INSERT INTO notifications (user_id, message, type)
           SELECT id, $1, 'NEW_TASK'
           FROM users
           WHERE class_id = ANY($2::uuid[]) AND role = 'STUDENT'`,
          [`New task posted by ${dbUser.full_name || 'HOD'}: "${t.title}"`, clsIds]
        );
      }

      await client.query('COMMIT');
      res.json({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        external_link: t.external_link,
        deadline: t.deadline,
        screenshot_instruction: t.screenshot_instruction,
        custom_field_label: t.custom_field_label,
        creator_name: dbUser.full_name,
        department_id: t.department_id,
        class_ids: clsIds,
        status: t.status,
        submission_type: t.submission_type || 'INDIVIDUAL',
        min_team_size: t.min_team_size || 2,
        max_team_size: t.max_team_size || 5,
        created_at: t.created_at,
        poster_url: t.poster_url || null,
        poster_cloudinary_public_id: t.poster_cloudinary_public_id || null,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error("Task Creation Error DB:", err);
      res.status(500).json({ error: err.message || 'Failed to create task' });
    } finally {
      client.release();
    }
  });

  app.patch('/api/tasks/:id/status', authenticate, authorize(['HOD', 'SUPREME_ADMIN']), async (req: any, res) => {
    const { status } = req.body;
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const tcRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [task.id]);
    const taskClassIds = tcRes.rows.map(r => r.class_id.toString());

    let isAuthorized = false;
    if (req.user.role === 'SUPREME_ADMIN') {
      isAuthorized = true;
    } else if (req.user.role === 'HOD') {
      if (task.department_id?.toString() === req.user.department_id?.toString()) {
        isAuthorized = true;
      } else if (taskClassIds.length > 0) {
        const hodClassRes = await pool.query(
          'SELECT 1 FROM classes WHERE id = ANY($1::uuid[]) AND department_id = $2 LIMIT 1',
          [taskClassIds, req.user.department_id]
        );
        if (hodClassRes.rowCount && hodClassRes.rowCount > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  });

  app.patch('/api/tasks/:id/reopen', authenticate, authorize(['HOD', 'SUPREME_ADMIN']), async (req: any, res) => {
    const { deadline } = req.body;
    if (!deadline) {
      return res.status(400).json({ error: 'New deadline date and time is required to reopen the task.' });
    }

    const newDeadline = new Date(deadline);
    if (isNaN(newDeadline.getTime()) || newDeadline <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be a valid future date and time.' });
    }

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const tcRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [task.id]);
    const taskClassIds = tcRes.rows.map(r => r.class_id.toString());

    let isAuthorized = false;
    if (req.user.role === 'SUPREME_ADMIN') {
      isAuthorized = true;
    } else if (req.user.role === 'HOD') {
      if (task.department_id?.toString() === req.user.department_id?.toString()) {
        isAuthorized = true;
      } else if (taskClassIds.length > 0) {
        const hodClassRes = await pool.query(
          'SELECT 1 FROM classes WHERE id = ANY($1::uuid[]) AND department_id = $2 LIMIT 1',
          [taskClassIds, req.user.department_id]
        );
        if (hodClassRes.rowCount && hodClassRes.rowCount > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) return res.status(403).json({ error: 'Forbidden: Only HOD of the task department can reopen and extend deadline' });

    await pool.query(
      'UPDATE tasks SET status = \'OPEN\', deadline = $1, updated_at = NOW() WHERE id = $2',
      [newDeadline.toISOString(), req.params.id]
    );

    if (taskClassIds.length > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, message, type)
         SELECT id, $1, 'TASK_REOPENED'
         FROM users
         WHERE class_id = ANY($2::uuid[]) AND role = 'STUDENT'`,
        [`Deadline extended & task reopened by HOD for "${task.title}". New deadline: ${newDeadline.toLocaleString()}`, taskClassIds]
      );
    }

    res.json({ success: true, deadline: newDeadline.toISOString(), status: 'OPEN' });
  });

  app.delete('/api/tasks/:id', authenticate, authorize(['HOD']), async (req: any, res) => {
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const tcRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [task.id]);
    const taskClassIds = tcRes.rows.map(r => r.class_id.toString());

    let isDeptHOD = req.user.role === 'HOD' && (
      task.department_id?.toString() === req.user.department_id?.toString()
    );

    if (!isDeptHOD && req.user.role === 'HOD' && taskClassIds.length > 0) {
      const hodClassRes = await pool.query(
        'SELECT 1 FROM classes WHERE id = ANY($1::uuid[]) AND department_id = $2 LIMIT 1',
        [taskClassIds, req.user.department_id]
      );
      if (hodClassRes.rowCount && hodClassRes.rowCount > 0) {
        isDeptHOD = true;
      }
    }

    if (!isDeptHOD)
      return res.status(403).json({ error: 'Forbidden' });

    // Clean up Cloudinary assets first (both submissions and poster image)
    if (task.poster_cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(task.poster_cloudinary_public_id);
      } catch (err) {
        console.error('Failed to delete task poster image from Cloudinary:', err);
      }
    }

    try {
      const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE task_id = $1 AND cloudinary_public_id IS NOT NULL', [task.id]);
      const cids = subsRes.rows.map(r => r.cloudinary_public_id).filter(Boolean);
      if (cids.length > 0) {
        try {
          await cloudinary.api.delete_resources(cids);
        } catch (err) {
          console.error('Failed to delete task submission images from Cloudinary:', err);
        }
      }
    } catch (err) {
      console.error('Failed to retrieve task submissions for Cloudinary cleanup:', err);
    }

    await pool.query('DELETE FROM task_submissions WHERE task_id = $1', [req.params.id]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  // ── Team Tasks Management APIs ─────────────────────────────────────────────

  // 1. Get eligible classmates for team task (excluding current user and already ACCEPTED team members/leaders)
  app.get('/api/team/classmates/:taskId', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const student = req.user;
    if (!student.class_id) return res.status(400).json({ error: 'You are not assigned to any class.' });

    try {
      const classmatesRes = await pool.query(`
        SELECT u.id, u.full_name, u.register_number, u.username
        FROM users u
        WHERE u.class_id = $1 
          AND u.role = 'STUDENT' 
          AND u.id != $2
          AND u.id NOT IN (
            SELECT tm.student_id 
            FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE t.task_id = $3 AND tm.status = 'ACCEPTED' AND t.status != 'REJECTED'
          )
          AND u.id NOT IN (
            SELECT leader_id FROM teams WHERE task_id = $3 AND status != 'REJECTED'
          )
        ORDER BY u.register_number ASC, u.full_name ASC
      `, [student.class_id, student.id, req.params.taskId]);

      res.json(classmatesRes.rows);
    } catch (err: any) {
      console.error('Error fetching team classmates:', err);
      res.status(500).json({ error: 'Failed to fetch eligible classmates' });
    }
  });

  // 2. POST /api/team/create
  app.post('/api/team/create', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const { taskId, teamName, members } = req.body;
    const student = req.user;

    if (!taskId) return res.status(400).json({ error: 'Task ID is required' });
    if (!teamName || !teamName.trim()) return res.status(400).json({ error: 'Team name is required' });
    if (!student.class_id) return res.status(400).json({ error: 'User is not assigned to a class' });

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [taskId]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.submission_type !== 'TEAM') return res.status(400).json({ error: 'This task is not configured for Team submission' });

    const existingTeamRes = await pool.query(`
      SELECT t.id FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE t.task_id = $1 AND tm.student_id = $2 AND tm.status = 'ACCEPTED' AND t.status != 'REJECTED'
      LIMIT 1
    `, [taskId, student.id]);

    if (existingTeamRes.rowCount && existingTeamRes.rowCount > 0) {
      return res.status(400).json({ error: 'You have already accepted a team for this task' });
    }

    const memberIds: string[] = Array.isArray(members) ? members.filter((m: string) => m && m !== student.id) : [];
    const maxTeamSize = task.max_team_size || 5;
    if (1 + memberIds.length > maxTeamSize) {
      return res.status(400).json({ error: `Team size exceeds maximum limit of ${maxTeamSize} members` });
    }

    if (memberIds.length > 0) {
      const validClassmatesRes = await pool.query(`
        SELECT id FROM users WHERE id = ANY($1) AND class_id = $2 AND role = 'STUDENT'
      `, [memberIds, student.class_id]);

      if (validClassmatesRes.rowCount !== memberIds.length) {
        return res.status(400).json({ error: 'All invited members must belong to your class' });
      }

      const busyMembersRes = await pool.query(`
        SELECT u.full_name FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN users u ON tm.student_id = u.id
        WHERE t.task_id = $1 AND tm.student_id = ANY($2) AND tm.status = 'ACCEPTED' AND t.status != 'REJECTED'
        LIMIT 1
      `, [taskId, memberIds]);

      if (busyMembersRes.rowCount && busyMembersRes.rowCount > 0) {
        const busyName = busyMembersRes.rows[0].full_name || 'One or more invited members';
        return res.status(400).json({ error: `${busyName} has already accepted an invitation for another team for this task.` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const teamInsert = await client.query(`
        INSERT INTO teams (task_id, class_id, leader_id, team_name, status)
        VALUES ($1, $2, $3, $4, 'FORMING')
        RETURNING *
      `, [taskId, student.class_id, student.id, teamName.trim()]);
      const team = teamInsert.rows[0];

      await client.query(`
        INSERT INTO team_members (team_id, student_id, status, accepted_at)
        VALUES ($1, $2, 'ACCEPTED', CURRENT_TIMESTAMP)
      `, [team.id, student.id]);

      for (const mId of memberIds) {
        await client.query(`
          INSERT INTO team_members (team_id, student_id, status)
          VALUES ($1, $2, 'PENDING')
        `, [team.id, mId]);

        await client.query(`
          INSERT INTO team_invitations (team_id, student_id, invited_by, status)
          VALUES ($1, $2, $3, 'PENDING')
        `, [team.id, mId, student.id]);

        await client.query(`
          INSERT INTO notifications (user_id, message, type)
          VALUES ($1, $2, 'TEAM_INVITATION')
        `, [mId, `You have been invited by ${req.user.username} to join team "${team.team_name}" for task "${task.title}"`]);
      }

      await client.query('COMMIT');
      res.json({ success: true, team });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error creating team:', err);
      res.status(500).json({ error: err.message || 'Failed to create team' });
    } finally {
      client.release();
    }
  });

  // 3. POST /api/team/invite
  app.post('/api/team/invite', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const { teamId, studentIds } = req.body;
    const student = req.user;

    if (!teamId) return res.status(400).json({ error: 'Team ID is required' });
    const newStudentIds: string[] = Array.isArray(studentIds) ? studentIds : [studentIds].filter(Boolean);

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() !== student.id.toString()) {
      return res.status(403).json({ error: 'Only the team leader can invite members' });
    }
    if (team.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot invite members after team is approved' });
    }

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [team.task_id]);
    const task = taskRes.rows[0];
    const maxTeamSize = task.max_team_size || 5;

    const currentMembersRes = await pool.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND status IN (\'PENDING\', \'ACCEPTED\')', [teamId]);
    const currentMemberCount = parseInt(currentMembersRes.rows[0].count, 10);

    if (currentMemberCount + newStudentIds.length > maxTeamSize) {
      return res.status(400).json({ error: `Inviting these members exceeds maximum team limit of ${maxTeamSize}` });
    }

    // Check if any target student has already ACCEPTED another team for this task
    if (newStudentIds.length > 0) {
      const busyMembersRes = await pool.query(`
        SELECT u.full_name FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN users u ON tm.student_id = u.id
        WHERE t.task_id = $1 AND tm.student_id = ANY($2) AND tm.status = 'ACCEPTED' AND t.status != 'REJECTED'
        LIMIT 1
      `, [team.task_id, newStudentIds]);

      if (busyMembersRes.rowCount && busyMembersRes.rowCount > 0) {
        const busyName = busyMembersRes.rows[0].full_name || 'One or more invited members';
        return res.status(400).json({ error: `${busyName} has already accepted an invitation for another team for this task.` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const mId of newStudentIds) {
        const userRes = await client.query('SELECT class_id FROM users WHERE id = $1 AND role = \'STUDENT\'', [mId]);
        if (!userRes.rows[0] || userRes.rows[0].class_id?.toString() !== student.class_id?.toString()) {
          continue;
        }

        await client.query(`
          INSERT INTO team_members (team_id, student_id, status)
          VALUES ($1, $2, 'PENDING')
          ON CONFLICT (team_id, student_id) DO UPDATE SET status = 'PENDING'
        `, [teamId, mId]);

        await client.query(`
          INSERT INTO team_invitations (team_id, student_id, invited_by, status)
          VALUES ($1, $2, $3, 'PENDING')
        `, [teamId, mId, student.id]);

        await client.query(`
          INSERT INTO notifications (user_id, message, type)
          VALUES ($1, $2, 'TEAM_INVITATION')
        `, [mId, `You have been invited to join team "${team.team_name}" for task "${task.title}"`]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Invite member error:', err);
      res.status(500).json({ error: err.message || 'Failed to send invitations' });
    } finally {
      client.release();
    }
  });

  // 4. POST /api/team/respond
  app.post('/api/team/respond', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const { invitationId, response } = req.body;
    const student = req.user;

    if (!invitationId || !['ACCEPT', 'DECLINE'].includes(response)) {
      return res.status(400).json({ error: 'Valid invitationId and response (ACCEPT/DECLINE) required' });
    }

    const invRes = await pool.query('SELECT * FROM team_invitations WHERE id = $1 AND student_id = $2 LIMIT 1', [invitationId, student.id]);
    const invitation = invRes.rows[0];
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation has already been responded to' });

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [invitation.team_id]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team no longer exists' });

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [team.task_id]);
    const task = taskRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (response === 'ACCEPT') {
        const busyRes = await client.query(`
          SELECT tm.id FROM team_members tm
          JOIN teams t ON tm.team_id = t.id
          WHERE t.task_id = $1 AND tm.student_id = $2 AND tm.status = 'ACCEPTED' AND t.status != 'REJECTED'
          LIMIT 1
        `, [team.task_id, student.id]);

        if (busyRes.rowCount && busyRes.rowCount > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'You are already an accepted member of another team for this task' });
        }

        await client.query('UPDATE team_invitations SET status = \'ACCEPTED\', responded_at = CURRENT_TIMESTAMP WHERE id = $1', [invitationId]);
        await client.query('UPDATE team_members SET status = \'ACCEPTED\', accepted_at = CURRENT_TIMESTAMP WHERE team_id = $1 AND student_id = $2', [team.id, student.id]);

        // Auto-expire all other pending invitations for this student for this task
        await client.query(`
          UPDATE team_invitations SET status = 'EXPIRED', responded_at = CURRENT_TIMESTAMP
          WHERE student_id = $1 AND status = 'PENDING' AND team_id IN (SELECT id FROM teams WHERE task_id = $2 AND id != $3)
        `, [student.id, team.task_id, team.id]);

        await client.query(`
          UPDATE team_members SET status = 'DECLINED'
          WHERE student_id = $1 AND status = 'PENDING' AND team_id IN (SELECT id FROM teams WHERE task_id = $2 AND id != $3)
        `, [student.id, team.task_id, team.id]);

        const acceptedCountRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [team.id]);
        const acceptedCount = parseInt(acceptedCountRes.rows[0].count, 10);
        const minTeamSize = task.min_team_size || 2;

        if (acceptedCount >= minTeamSize && team.status === 'FORMING') {
          await client.query('UPDATE teams SET status = \'READY\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [team.id]);
        }

        const studentName = student.full_name || student.username;
        await client.query(`
          INSERT INTO notifications (user_id, message, type)
          VALUES ($1, $2, 'TEAM_RESPONSE')
        `, [team.leader_id, `${studentName} accepted your invitation to join team "${team.team_name}".`]);

      } else {
        await client.query('UPDATE team_invitations SET status = \'DECLINED\', responded_at = CURRENT_TIMESTAMP WHERE id = $1', [invitationId]);
        await client.query('UPDATE team_members SET status = \'DECLINED\' WHERE team_id = $1 AND student_id = $2', [team.id, student.id]);

        const studentName = student.full_name || student.username;
        await client.query(`
          INSERT INTO notifications (user_id, message, type)
          VALUES ($1, $2, 'TEAM_RESPONSE')
        `, [team.leader_id, `${studentName} declined your invitation to join team "${team.team_name}".`]);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Respond invitation error:', err);
      res.status(500).json({ error: err.message || 'Failed to respond to invitation' });
    } finally {
      client.release();
    }
  });

  // 5. GET /api/team/my
  app.get('/api/team/my', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const studentId = req.user.id;
    try {
      const myTeamsRes = await pool.query(`
        SELECT DISTINCT t.*, tk.title as task_title, tk.submission_type, tk.min_team_size, tk.max_team_size, u.full_name as leader_name
        FROM teams t
        JOIN tasks tk ON t.task_id = tk.id
        JOIN users u ON t.leader_id = u.id
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.student_id = $1 AND tm.status IN ('ACCEPTED', 'PENDING')
        ORDER BY t.created_at DESC
      `, [studentId]);

      const invitationsRes = await pool.query(`
        SELECT ti.*, t.team_name, tk.title as task_title, u.full_name as inviter_name
        FROM team_invitations ti
        JOIN teams t ON ti.team_id = t.id
        JOIN tasks tk ON t.task_id = tk.id
        JOIN users u ON ti.invited_by = u.id
        WHERE ti.student_id = $1 AND ti.status = 'PENDING'
        ORDER BY ti.created_at DESC
      `, [studentId]);

      res.json({
        teams: myTeamsRes.rows,
        invitations: invitationsRes.rows
      });
    } catch (err: any) {
      console.error('Fetch my teams error:', err);
      res.status(500).json({ error: 'Failed to fetch team details' });
    }
  });

  // 6. DELETE /api/team/:teamId (Leader disbands team before final submission)
  app.delete('/api/team/:teamId', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const teamId = req.params.teamId;
    const student = req.user;

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() !== student.id.toString()) {
      return res.status(403).json({ error: 'Only the team leader can disband the team' });
    }
    if (['SUBMITTED', 'APPROVED'].includes(team.status)) {
      return res.status(400).json({ error: 'Cannot disband team after proof submission' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM team_invitations WHERE team_id = $1', [teamId]);
      await client.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
      await client.query('DELETE FROM team_submissions WHERE team_id = $1', [teamId]);
      await client.query('DELETE FROM teams WHERE id = $1', [teamId]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to disband team' });
    } finally {
      client.release();
    }
  });

  // 7. POST /api/team/leave (Member leaves team before final submission)
  app.post('/api/team/leave', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const { teamId } = req.body;
    const student = req.user;

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() === student.id.toString()) {
      return res.status(400).json({ error: 'Team leaders cannot leave. Use disband team instead.' });
    }
    if (['SUBMITTED', 'APPROVED'].includes(team.status)) {
      return res.status(400).json({ error: 'Cannot leave team after proof submission' });
    }

    await pool.query('DELETE FROM team_members WHERE team_id = $1 AND student_id = $2', [teamId, student.id]);
    await pool.query('UPDATE team_invitations SET status = \'EXPIRED\' WHERE team_id = $1 AND student_id = $2', [teamId, student.id]);
    res.json({ success: true });
  });

  // 8. GET /api/team/task/:taskId
  app.get('/api/team/task/:taskId', authenticate, async (req: any, res) => {
    const taskId = req.params.taskId;
    const userId = req.user.id;

    try {
      const teamRes = await pool.query(`
        SELECT t.*, u.full_name as leader_name, u.register_number as leader_regno,
               tk.min_team_size, tk.max_team_size, tk.title as task_title
        FROM teams t
        JOIN users u ON t.leader_id = u.id
        JOIN tasks tk ON t.task_id = tk.id
        JOIN team_members tm ON tm.team_id = t.id
        WHERE t.task_id = $1 AND tm.student_id = $2 AND tm.status IN ('ACCEPTED', 'PENDING')
        ORDER BY t.created_at DESC LIMIT 1
      `, [taskId, userId]);

      const team = teamRes.rows[0];
      if (!team) {
        return res.json({ team: null });
      }

      const membersRes = await pool.query(`
        SELECT tm.*, u.full_name, u.register_number, u.username, u.email
        FROM team_members tm
        JOIN users u ON tm.student_id = u.id
        WHERE tm.team_id = $1
        ORDER BY tm.joined_at ASC
      `, [team.id]);

      const invitationsRes = await pool.query(`
        SELECT ti.*, u.full_name as student_name
        FROM team_invitations ti
        JOIN users u ON ti.student_id = u.id
        WHERE ti.team_id = $1 AND ti.status = 'PENDING'
      `, [team.id]);

      const subRes = await pool.query(`
        SELECT * FROM team_submissions WHERE team_id = $1 ORDER BY created_at DESC LIMIT 1
      `, [team.id]);

      res.json({
        team: {
          ...team,
          members: membersRes.rows,
          invitations: invitationsRes.rows,
          submission: subRes.rows[0] || null
        }
      });
    } catch (err: any) {
      console.error('Fetch team for task error:', err);
      res.status(500).json({ error: 'Failed to fetch team details' });
    }
  });

  // 7. DELETE /api/team/member/:id
  app.delete('/api/team/member/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const memberId = req.params.id;
    const student = req.user;

    const tmRes = await pool.query('SELECT * FROM team_members WHERE id = $1 LIMIT 1', [memberId]);
    const tm = tmRes.rows[0];
    if (!tm) return res.status(404).json({ error: 'Team member not found' });

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [tm.team_id]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() !== student.id.toString()) {
      return res.status(403).json({ error: 'Only the team leader can remove members' });
    }
    if (tm.student_id.toString() === team.leader_id.toString()) {
      return res.status(400).json({ error: 'Leader cannot be removed from team' });
    }
    if (team.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot remove members after team is approved' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE team_members SET status = \'REMOVED\' WHERE id = $1', [memberId]);
      await client.query('UPDATE team_invitations SET status = \'EXPIRED\' WHERE team_id = $1 AND student_id = $2 AND status = \'PENDING\'', [team.id, tm.student_id]);

      const taskRes = await client.query('SELECT min_team_size FROM tasks WHERE id = $1 LIMIT 1', [team.task_id]);
      const minTeamSize = taskRes.rows[0]?.min_team_size || 2;
      const acceptedCountRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [team.id]);
      const acceptedCount = parseInt(acceptedCountRes.rows[0].count, 10);

      if (acceptedCount < minTeamSize && ['READY', 'SUBMITTED'].includes(team.status)) {
        await client.query('UPDATE teams SET status = \'FORMING\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [team.id]);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Remove member error:', err);
      res.status(500).json({ error: err.message || 'Failed to remove member' });
    } finally {
      client.release();
    }
  });

  // 8. DELETE /api/team/:id
  app.delete('/api/team/:id', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const teamId = req.params.id;
    const student = req.user;

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() !== student.id.toString()) {
      return res.status(403).json({ error: 'Only team leader can delete the team' });
    }
    if (team.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot delete team after approval' });
    }

    try {
      await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete team error:', err);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  });

  // 9. POST /api/team/submit
  app.post('/api/team/submit', authenticate, authorize(['STUDENT']), upload.single('screenshot'), async (req: any, res) => {
    const { teamId, remarks } = req.body;
    const student = req.user;

    if (!teamId) return res.status(400).json({ error: 'Team ID is required' });
    if (!req.file) return res.status(400).json({ error: 'Proof screenshot file is required' });

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [teamId]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.leader_id.toString() !== student.id.toString()) {
      return res.status(403).json({ error: 'Only the team leader can submit proof' });
    }

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [team.task_id]);
    const task = taskRes.rows[0];
    const minTeamSize = task.min_team_size || 2;

    const pendingCountRes = await pool.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND status = \'PENDING\'', [teamId]);
    const pendingCount = parseInt(pendingCountRes.rows[0].count, 10);
    if (pendingCount > 0) {
      return res.status(400).json({ error: `Cannot submit proof while there are ${pendingCount} pending member invitations. All invited members must accept or be removed before submitting.` });
    }

    const acceptedCountRes = await pool.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [teamId]);
    const acceptedCount = parseInt(acceptedCountRes.rows[0].count, 10);

    if (acceptedCount < minTeamSize) {
      return res.status(400).json({ error: `Cannot submit. Minimum ${minTeamSize} accepted members required (currently ${acceptedCount}).` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const subInsert = await client.query(`
        INSERT INTO team_submissions (team_id, submitted_by, proof_url, cloudinary_public_id, remarks, status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING *
      `, [teamId, student.id, req.file.path, req.file.filename, remarks || '']);

      await client.query('UPDATE teams SET status = \'SUBMITTED\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [teamId]);

      const acceptedMembersRes = await client.query('SELECT student_id FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [teamId]);
      for (const m of acceptedMembersRes.rows) {
        await client.query(`
          INSERT INTO notifications (user_id, message, type)
          VALUES ($1, $2, 'TEAM_SUBMITTED')
        `, [m.student_id, `Task submission for team "${team.team_name}" was submitted by team leader.`]);
      }

      await client.query('COMMIT');
      res.json({ success: true, submission: subInsert.rows[0] });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Submit team task error:', err);
      res.status(500).json({ error: err.message || 'Failed to submit team task' });
    } finally {
      client.release();
    }
  });

  // 10. GET /api/team/submissions
  app.get('/api/team/submissions', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    const { taskId, classId } = req.query;

    try {
      let query = `
        SELECT ts.*, t.team_name, t.task_id, t.class_id, tk.title as task_title, u.full_name as leader_name, u.register_number as leader_regno
        FROM team_submissions ts
        JOIN teams t ON ts.team_id = t.id
        JOIN tasks tk ON t.task_id = tk.id
        JOIN users u ON t.leader_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (taskId) {
        params.push(taskId);
        query += ` AND t.task_id = $${params.length}`;
      }

      if (req.user.role === 'STUDENT' || (req.user.role === 'CLASS_ADVISOR' && !req.user.is_year_coordinator)) {
        params.push(req.user.class_id);
        query += ` AND (t.class_id = $${params.length} OR u.class_id = $${params.length})`;
      } else if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
        if (classId) {
          params.push(classId);
          query += ` AND (t.class_id = $${params.length} OR u.class_id = $${params.length})`;
        } else {
          params.push(req.user.department_id);
          params.push(req.user.year_scope);
          query += ` AND (t.class_id IN (SELECT id FROM classes WHERE department_id = $${params.length - 1} AND year = $${params.length}) OR u.class_id IN (SELECT id FROM classes WHERE department_id = $${params.length - 1} AND year = $${params.length}))`;
        }
      } else if (req.user.role === 'HOD') {
        if (classId) {
          params.push(classId);
          query += ` AND (t.class_id = $${params.length} OR u.class_id = $${params.length})`;
        } else {
          params.push(req.user.department_id);
          query += ` AND u.department_id = $${params.length}`;
        }
      } else if (classId) {
        params.push(classId);
        query += ` AND (t.class_id = $${params.length} OR u.class_id = $${params.length})`;
      }
      query += ' ORDER BY ts.created_at DESC';

      const subsRes = await pool.query(query, params);
      const submissions = subsRes.rows;

      const teamIds = submissions.map((s: any) => s.team_id).filter(Boolean);
      if (teamIds.length > 0) {
        const allMembersRes = await pool.query(`
          SELECT tm.*, u.full_name, u.register_number, u.username
          FROM team_members tm
          JOIN users u ON tm.student_id = u.id
          WHERE tm.team_id = ANY($1::uuid[]) AND tm.status = 'ACCEPTED'
        `, [teamIds]);

        const membersByTeam = new Map<string, any[]>();
        allMembersRes.rows.forEach((m: any) => {
          const tid = m.team_id.toString();
          if (!membersByTeam.has(tid)) membersByTeam.set(tid, []);
          membersByTeam.get(tid)!.push(m);
        });

        submissions.forEach((sub: any) => {
          sub.members = membersByTeam.get(sub.team_id.toString()) || [];
        });
      } else {
        submissions.forEach((sub: any) => { sub.members = []; });
      }

      res.json(submissions);
    } catch (err: any) {
      console.error('Fetch team submissions error:', err);
      res.status(500).json({ error: 'Failed to fetch team submissions' });
    }
  });

  // 11. POST /api/team/review
  app.post('/api/team/review', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    if (req.user.role === 'STUDENT' && !req.user.is_coordinator) {
      return res.status(403).json({ error: 'Only student coordinators can review team submissions' });
    }

    const { submissionId, status, feedback } = req.body;

    if (!submissionId || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Valid submissionId and status (APPROVED/REJECTED) required' });
    }

    const subRes = await pool.query('SELECT * FROM team_submissions WHERE id = $1 LIMIT 1', [submissionId]);
    const sub = subRes.rows[0];
    if (!sub) return res.status(404).json({ error: 'Team submission not found' });

    const teamRes = await pool.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [sub.team_id]);
    const team = teamRes.rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [team.task_id]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role === 'STUDENT' || (req.user.role === 'CLASS_ADVISOR' && !req.user.is_year_coordinator)) {
      const userClassId = req.user.class_id?.toString();
      const teamClassId = team.class_id?.toString();
      if (userClassId && teamClassId !== userClassId) {
        const leaderRes = await pool.query('SELECT class_id FROM users WHERE id = $1', [team.leader_id]);
        const leaderClassId = leaderRes.rows[0]?.class_id?.toString();
        if (leaderClassId !== userClassId) {
          return res.status(403).json({ error: 'Forbidden: You can only review team submissions for your class.' });
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (status === 'APPROVED') {
        await client.query(`
          UPDATE team_submissions 
          SET status = 'APPROVED', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [req.user.id, submissionId]);

        await client.query('UPDATE teams SET status = \'APPROVED\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [team.id]);

        const acceptedMembersRes = await client.query('SELECT student_id FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [team.id]);
        for (const m of acceptedMembersRes.rows) {
          const existingSub = await client.query('SELECT id FROM task_submissions WHERE task_id = $1 AND user_id = $2 LIMIT 1', [task.id, m.student_id]);
          if (existingSub.rows.length > 0) {
            await client.query(`
              UPDATE task_submissions 
              SET status = 'VERIFIED', screenshot_url = $1, cloudinary_public_id = $2, verification_note = $3, verified_at = CURRENT_TIMESTAMP
              WHERE id = $4
            `, [sub.proof_url, sub.cloudinary_public_id, feedback || 'Approved team submission', existingSub.rows[0].id]);
          } else {
            await client.query(`
              INSERT INTO task_submissions (task_id, user_id, status, screenshot_url, cloudinary_public_id, verification_note, submitted_at, verified_at)
              VALUES ($1, $2, 'VERIFIED', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [task.id, m.student_id, sub.proof_url, sub.cloudinary_public_id, feedback || 'Approved team submission']);
          }

          await client.query(`
            INSERT INTO notifications (user_id, message, type)
            VALUES ($1, $2, 'TEAM_REVIEW')
          `, [m.student_id, `Your team submission for task "${task.title}" has been APPROVED!`]);
        }
      } else {
        await client.query(`
          UPDATE team_submissions 
          SET status = 'REJECTED', remarks = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [feedback || 'Submission rejected', req.user.id, submissionId]);

        await client.query('UPDATE teams SET status = \'REJECTED\', updated_at = CURRENT_TIMESTAMP WHERE id = $1', [team.id]);

        const acceptedMembersRes = await client.query('SELECT student_id FROM team_members WHERE team_id = $1 AND status = \'ACCEPTED\'', [team.id]);
        for (const m of acceptedMembersRes.rows) {
          await client.query(`
            INSERT INTO notifications (user_id, message, type)
            VALUES ($1, $2, 'TEAM_REVIEW')
          `, [m.student_id, `Your team submission for task "${task.title}" was REJECTED: ${feedback || 'Please resubmit'}`]);
        }
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Team review error:', err);
      res.status(500).json({ error: err.message || 'Failed to review team submission' });
    } finally {
      client.release();
    }
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  // ── Stats: Supreme Admin ──────────────────────────────────────────────────
  app.get('/api/stats/supreme', authenticate, authorize(['SUPREME_ADMIN']), async (req, res) => {
    try {
      const totalDepts = await pool.query('SELECT count(*) FROM departments');
      const totalClasses = await pool.query('SELECT count(*) FROM classes');
      const totalUsers = await pool.query('SELECT count(*) FROM users');
      const activeTasks = await pool.query("SELECT count(*) FROM tasks WHERE status = 'OPEN'");
      const totalSubmissions = await pool.query('SELECT count(*) FROM task_submissions');
      const pendingVerifications = await pool.query("SELECT count(*) FROM task_submissions WHERE status = 'SUBMITTED'");

      res.json({
        total_departments: parseInt(totalDepts.rows[0].count),
        total_classes: parseInt(totalClasses.rows[0].count),
        total_users: parseInt(totalUsers.rows[0].count),
        total_active_tasks: parseInt(activeTasks.rows[0].count),
        total_submissions: parseInt(totalSubmissions.rows[0].count),
        pending_verifications: parseInt(pendingVerifications.rows[0].count),
      });
    } catch (err) {
      console.error('Supreme Stats Error:', err);
      res.status(500).json({ error: 'Failed to fetch Supreme Admin stats' });
    }
  });

  app.get('/api/stats/hod', authenticate, authorize(['HOD']), async (req: any, res) => {
    const deptId = req.user.department_id;

    const classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 ORDER BY year ASC, name ASC', [deptId]);
    const classes = classesRes.rows;
    const classIds = classes.map(c => c.id);

    const deptStudentsRes = await pool.query('SELECT id, full_name, register_number, class_id FROM users WHERE department_id = $1 AND role = \'STUDENT\' ORDER BY register_number ASC', [deptId]);
    const deptStudents = deptStudentsRes.rows;
    const deptStudentIds = deptStudents.map(s => s.id);

    const studentsByClass: Record<string, any[]> = {};
    classes.forEach(c => {
      studentsByClass[c.id.toString()] = deptStudents.filter(s => s.class_id?.toString() === c.id.toString());
    });

    let tasksRes;
    if (classIds.length > 0) {
      tasksRes = await pool.query(`
        SELECT DISTINCT t.*
        FROM tasks t
        LEFT JOIN task_classes tc ON t.id = tc.task_id
        WHERE t.department_id = $1
           OR tc.class_id = ANY($2)
           OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
      `, [deptId, classIds]);
    } else {
      tasksRes = await pool.query(`
        SELECT DISTINCT t.*
        FROM tasks t
        WHERE t.department_id = $1
           OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
      `, [deptId]);
    }
    const tasks = tasksRes.rows;
    const taskIds = tasks.map(t => t.id);

    // ── Batched queries (replaces N+1 — previously 2 queries per task) ────────
    // Fetch ALL submissions for all tasks in one query
    const allSubsRes = taskIds.length > 0
      ? await pool.query('SELECT task_id, user_id, status FROM task_submissions WHERE task_id = ANY($1)', [taskIds])
      : { rows: [] };
    // Group submissions by task_id for O(1) lookup
    const subsByTask = new Map<string, { user_id: string; status: string }[]>();
    allSubsRes.rows.forEach(s => {
      const key = s.task_id.toString();
      if (!subsByTask.has(key)) subsByTask.set(key, []);
      subsByTask.get(key)!.push({ user_id: s.user_id.toString(), status: s.status });
    });

    // Fetch ALL task→class assignments in one query
    const allTcRes = taskIds.length > 0
      ? await pool.query('SELECT task_id, class_id FROM task_classes WHERE task_id = ANY($1)', [taskIds])
      : { rows: [] };
    const tcByTask = new Map<string, string[]>();
    allTcRes.rows.forEach(r => {
      const key = r.task_id.toString();
      if (!tcByTask.has(key)) tcByTask.set(key, []);
      tcByTask.get(key)!.push(r.class_id.toString());
    });

    const taskStats = tasks.map((t) => {
      const subs = subsByTask.get(t.id.toString()) || [];
      const taskClassIds = tcByTask.get(t.id.toString()) || [];

      const class_breakdown = classes.map(c => {
        const isAssigned = taskClassIds.length === 0 || taskClassIds.includes(c.id.toString());
        if (!isAssigned) return { class_name: c.name, total_students: 0, completed: 0, not_completed: 0 };
        const classStudents = studentsByClass[c.id.toString()] || [];
        const classStudentIds = new Set(classStudents.map(s => s.id.toString()));
        const completedStudentIds = new Set(subs.filter(s =>
          (s.status === 'SUBMITTED' || s.status === 'VERIFIED') && classStudentIds.has(s.user_id)
        ).map(s => s.user_id));
        return {
          class_name: c.name,
          total_students: classStudents.length,
          completed: completedStudentIds.size,
          not_completed: classStudents.length - completedStudentIds.size
        };
      });

      const targetStudentIds = taskClassIds.length > 0
        ? new Set(deptStudents.filter(s => taskClassIds.includes(s.class_id?.toString())).map(s => s.id.toString()))
        : new Set(deptStudentIds.map(s => s.toString()));
      const relevantSubs = subs.filter(s => targetStudentIds.has(s.user_id));
      const sMap = new Map<string, string>();
      relevantSubs.forEach(s => sMap.set(s.user_id, s.status));
      const statuses = Array.from(sMap.values());

      return {
        id: t.id, title: t.title,
        submitted: statuses.filter(s => s === 'SUBMITTED').length,
        verified: statuses.filter(s => s === 'VERIFIED').length,
        pending: targetStudentIds.size - sMap.size,
        rejected: statuses.filter(s => s === 'REJECTED').length,
        not_participating: statuses.filter(s => s === 'NOT_PARTICIPATING').length,
        class_breakdown
      };
    });

    // Batch participation count — one query with GROUP BY instead of one per class
    let participationMap = new Map<string, number>();
    if (deptStudentIds.length > 0) {
      const partRes = await pool.query(`
        SELECT u.class_id, count(DISTINCT ts.user_id) as cnt
        FROM task_submissions ts
        JOIN users u ON ts.user_id = u.id
        WHERE u.department_id = $1
        GROUP BY u.class_id
      `, [deptId]);
      partRes.rows.forEach(r => participationMap.set(r.class_id.toString(), parseInt(r.cnt)));
    }

    const classStats = classes.map(c => {
      const classStudents = studentsByClass[c.id.toString()] || [];
      return {
        id: c.id, name: c.name,
        total_students: classStudents.length,
        participating_students: participationMap.get(c.id.toString()) || 0,
      };
    });

    const totalStudentsRes = await pool.query('SELECT count(*) FROM users WHERE department_id = $1 AND role = \'STUDENT\'', [deptId]);
    const totalAdvisorsRes = await pool.query('SELECT count(*) FROM users WHERE department_id = $1 AND role = \'CLASS_ADVISOR\'', [deptId]);
    const totalClassesRes = await pool.query('SELECT count(*) FROM classes WHERE department_id = $1', [deptId]);

    const pendingSubmissionsRes = await pool.query(`
      SELECT count(*) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.department_id = $1 AND ts.status = 'SUBMITTED'
    `, [deptId]);

    const verifiedSubmissionsRes = await pool.query(`
      SELECT count(*) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.department_id = $1 AND ts.status = 'VERIFIED'
    `, [deptId]);

    const notParticipatingSubmissionsRes = await pool.query(`
      SELECT count(*) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.department_id = $1 AND ts.status = 'NOT_PARTICIPATING'
    `, [deptId]);

    res.json({
      taskStats,
      classStats,
      total_students: parseInt(totalStudentsRes.rows[0].count),
      total_advisors: parseInt(totalAdvisorsRes.rows[0].count),
      total_classes: parseInt(totalClassesRes.rows[0].count),
      pending_submissions: parseInt(pendingSubmissionsRes.rows[0].count),
      verified_submissions: parseInt(verifiedSubmissionsRes.rows[0].count)
    });
  });

  app.get('/api/stats/coordinator', authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT' || !req.user.is_coordinator)
      return res.status(403).json({ error: 'Only coordinators can access these stats' });

    const classId = req.user.class_id;
    const deptId = req.user.department_id;

    const tasksRes = await pool.query(`
      SELECT t.*
      FROM tasks t
      LEFT JOIN task_classes tc ON t.id = tc.task_id
      WHERE tc.class_id = $1
         OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
         OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
      GROUP BY t.id
    `, [classId, deptId]);
    const tasks = tasksRes.rows;

    const studentsRes = await pool.query('SELECT id, full_name, register_number FROM users WHERE class_id = $1 AND role = \'STUDENT\' ORDER BY register_number ASC', [classId]);
    const students = studentsRes.rows;
    const studentIds = students.map(s => s.id);
    const taskIds = tasks.map(t => t.id);

    const allSubsRes = (taskIds.length > 0 && studentIds.length > 0)
      ? await pool.query('SELECT task_id, user_id, status FROM task_submissions WHERE task_id = ANY($1) AND user_id = ANY($2)', [taskIds, studentIds])
      : { rows: [] };

    const taskStats = tasks.map(t => {
      const taskSubs = allSubsRes.rows.filter(s => s.task_id.toString() === t.id.toString());
      return {
        id: t.id,
        title: t.title,
        submitted: taskSubs.filter(s => s.status === 'SUBMITTED').length,
        verified: taskSubs.filter(s => s.status === 'VERIFIED').length,
        pending: Math.max(0, studentIds.length - taskSubs.length),
        rejected: taskSubs.filter(s => s.status === 'REJECTED').length,
      };
    });

    const userVerifiedMap = new Map();
    allSubsRes.rows.filter(s => s.status === 'VERIFIED').forEach(s => {
      const uid = s.user_id.toString();
      userVerifiedMap.set(uid, (userVerifiedMap.get(uid) || 0) + 1);
    });

    const totalTaskCount = tasks.length;
    const studentStats = students.map(u => ({
      full_name: u.full_name,
      register_number: u.register_number,
      completed_tasks: userVerifiedMap.get(u.id.toString()) || 0,
      total_tasks: totalTaskCount
    }));

    const totalStudentsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId]);
    const totalBoysRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND UPPER(gender) IN ('MALE', 'BOYS', 'BOY', 'M')", [classId]);
    const totalGirlsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND UPPER(gender) IN ('FEMALE', 'GIRLS', 'GIRL', 'F')", [classId]);

    const pendingReviewsRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'SUBMITTED'
    `, [classId]);
    const verifiedSubmissionsRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'VERIFIED'
    `, [classId]);
    const rejectedSubmissionsRes = await pool.query(`
      SELECT count(*) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'REJECTED'
    `, [classId]);

    const boysVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('MALE', 'BOYS', 'BOY', 'M') AND ts.status = 'VERIFIED'
    `, [classId]);
    const girlsVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('FEMALE', 'GIRLS', 'GIRL', 'F') AND ts.status = 'VERIFIED'
    `, [classId]);

    const boysPendingRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('MALE', 'BOYS', 'BOY', 'M') AND ts.status = 'SUBMITTED'
    `, [classId]);
    const girlsPendingRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('FEMALE', 'GIRLS', 'GIRL', 'F') AND ts.status = 'SUBMITTED'
    `, [classId]);

    const totalBoys = parseInt(totalBoysRes.rows[0].count);
    const totalGirls = parseInt(totalGirlsRes.rows[0].count);
    const boysVerified = parseInt(boysVerifiedRes.rows[0].count);
    const girlsVerified = parseInt(girlsVerifiedRes.rows[0].count);
    const boysPending = parseInt(boysPendingRes.rows[0].count);
    const girlsPending = parseInt(girlsPendingRes.rows[0].count);

    res.json({
      taskStats,
      studentStats,
      class_student_count: parseInt(totalStudentsRes.rows[0].count),
      pending_reviews: parseInt(pendingReviewsRes.rows[0].count),
      verified_submissions: parseInt(verifiedSubmissionsRes.rows[0].count),
      rejected_submissions: parseInt(rejectedSubmissionsRes.rows[0].count),
      total_boys: totalBoys,
      total_girls: totalGirls,
      boys_verified: boysVerified,
      girls_verified: girlsVerified,
      boys_pending: boysPending,
      girls_pending: girlsPending,
      boys_incomplete: Math.max(0, totalBoys - boysVerified),
      girls_incomplete: Math.max(0, totalGirls - girlsVerified),
    });
  });

  // ── Submissions ───────────────────────────────────────────────────────────
  app.get('/api/submissions', authenticate, async (req: any, res) => {
    let subsRes;
    const baseQuery = `
      SELECT ts.*, t.title as task_title, u.full_name as student_name, u.register_number, u.class_id, c.name as class_name, c.year as class_year
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN users u ON ts.user_id = u.id
      LEFT JOIN classes c ON u.class_id = c.id
    `;

    if (req.user.role === 'STUDENT') {
      if (req.user.is_coordinator) {
        const studentsRes = await pool.query('SELECT id FROM users WHERE class_id = $1', [req.user.class_id]);
        const studentIds = studentsRes.rows.map(s => s.id);
        subsRes = await pool.query(`${baseQuery} WHERE ts.user_id = ANY($1)`, [studentIds]);
      } else {
        subsRes = await pool.query(`${baseQuery} WHERE ts.user_id = $1`, [req.user.id]);
      }
    } else if (req.user.role === 'CLASS_ADVISOR') {
      let classIds = [req.user.class_id];
      if (req.user.is_year_coordinator) {
        const yearClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1 AND year = $2', [req.user.department_id, req.user.year_scope]);
        classIds = yearClassesRes.rows.map(c => c.id);
      }
      const studentsRes = await pool.query('SELECT id FROM users WHERE class_id = ANY($1)', [classIds]);
      const studentIds = studentsRes.rows.map(s => s.id);
      subsRes = await pool.query(`${baseQuery} WHERE ts.user_id = ANY($1)`, [studentIds]);
    } else if (req.user.role === 'HOD') {
      const studentsRes = await pool.query('SELECT id FROM users WHERE department_id = $1 AND role = \'STUDENT\'', [req.user.department_id]);
      const studentIds = studentsRes.rows.map(s => s.id);
      subsRes = await pool.query(`${baseQuery} WHERE ts.user_id = ANY($1)`, [studentIds]);
    } else {
      subsRes = await pool.query(baseQuery);
    }

    res.json(subsRes.rows.map((s: any) => ({
      id: s.id,
      task_id: s.task_id,
      task_title: s.task_title,
      user_id: s.user_id,
      student_name: s.student_name,
      register_number: s.register_number,
      class_id: s.class_id,
      class_name: s.class_name,
      class_year: s.class_year,
      status: s.status,
      screenshot_url: s.screenshot_url,
      custom_field_value: s.custom_field_value,
      verification_note: s.verification_note,
      rejection_reason: s.rejection_reason,
      not_participating: s.not_participating,
      not_participating_reason: s.not_participating_reason,
      submitted_at: s.submitted_at,
      verified_at: s.verified_at,
      resubmission_count: s.resubmission_count,
    })));
  });

  // ── Not Participating submission (no screenshot required) ─────────────────
  app.post('/api/submissions/not-participating', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const { task_id, not_participating_reason } = req.body;
    if (!task_id) return res.status(400).json({ error: 'Task ID is required' });
    if (!not_participating_reason || !not_participating_reason.trim())
      return res.status(400).json({ error: 'Please provide a reason for not participating.' });

    try {
      const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [task_id]);
      const task = taskRes.rows[0];
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Check task accessibility
      const accessRes = await pool.query(`
        SELECT 1 FROM tasks t
        LEFT JOIN task_classes tc ON t.id = tc.task_id
        WHERE t.id = $1
          AND (
            (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
            OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
            OR tc.class_id = $3
          )
        LIMIT 1
      `, [task.id, req.user.department_id, req.user.class_id]);
      if (accessRes.rowCount === 0) return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });

      // Check existing submission
      const existingRes = await pool.query('SELECT * FROM task_submissions WHERE task_id = $1 AND user_id = $2 LIMIT 1', [task_id, req.user.id]);
      const existing = existingRes.rows[0];

      if (existing) {
        if (existing.status === 'VERIFIED') return res.status(400).json({ error: 'Task already verified. Cannot mark as not participating.' });
        // Update existing
        await pool.query(`
          UPDATE task_submissions
          SET not_participating = TRUE, not_participating_reason = $1, status = 'NOT_PARTICIPATING',
              screenshot_url = NULL, cloudinary_public_id = NULL, custom_field_value = NULL,
              submitted_at = NOW(), updated_at = NOW()
          WHERE id = $2
        `, [not_participating_reason.trim(), existing.id]);
        return res.json({ success: true, id: existing.id });
      }

      const subRes = await pool.query(`
        INSERT INTO task_submissions (task_id, user_id, status, not_participating, not_participating_reason, submitted_at)
        VALUES ($1, $2, 'NOT_PARTICIPATING', TRUE, $3, NOW())
        RETURNING id
      `, [task_id, req.user.id, not_participating_reason.trim()]);
      return res.json({ success: true, id: subRes.rows[0].id });
    } catch (err: any) {
      if (err.code === '23505') return res.status(400).json({ error: 'You have already submitted a response for this task.' });
      console.error('Not-participating submission error:', err);
      return res.status(500).json({ error: 'Failed to record opt-out' });
    }
  });

  app.post('/api/submissions', authenticate, authorize(['STUDENT']), upload.single('screenshot'), async (req: any, res) => {
    try {
      submissionSchemaValidator.parse(req.body);
    } catch (e: any) {
      console.error("Submission Validation Error:", e);
      let errorMessage = 'Invalid submission data provided';
      if (e && e.name === 'ZodError') {
        errorMessage = e.errors?.[0]?.message || errorMessage;
      } else if (e && e.message) {
        errorMessage = e.message;
      }
      return res.status(400).json({ error: errorMessage });
    }
    const { task_id, custom_field_value } = req.body;
    const screenshot_url = req.file?.path || null; // Cloudinary URL
    const cloudinary_public_id = req.file?.filename || null; // Cloudinary Public ID

    if (!screenshot_url) return res.status(400).json({ error: 'Screenshot is required' });

    try {
      const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [task_id]);
      const task = taskRes.rows[0];
      if (!task) {
        if (cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
        }
        return res.status(404).json({ error: 'Task not found' });
      }

      const accessibilityRes = await pool.query(`
        SELECT 1 FROM tasks t
        LEFT JOIN task_classes tc ON t.id = tc.task_id
        WHERE t.id = $1
          AND (
            (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
            OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
            OR tc.class_id = $3
          )
        LIMIT 1
      `, [task.id, req.user.department_id, req.user.class_id]);

      if (accessibilityRes.rowCount === 0) {
        if (cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
        }
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }
      if (task.deadline && new Date() > new Date(task.deadline)) {
        if (cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
        }
        return res.status(400).json({ error: 'Hard deadline block — no late uploads possible' });
      }

      const existingRes = await pool.query('SELECT * FROM task_submissions WHERE task_id = $1 AND user_id = $2 LIMIT 1', [task_id, req.user.id]);
      const existing = existingRes.rows[0];

      if (existing) {
        if (existing.status === 'VERIFIED') {
          if (cloudinary_public_id) {
            try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
          }
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'REJECTED' && existing.resubmission_count >= 2) {
          if (cloudinary_public_id) {
            try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
          }
          return res.status(400).json({ error: 'Maximum 2 resubmissions allowed. Submission locked.' });
        }

        // Clean up previous Cloudinary asset
        if (existing.cloudinary_public_id) {
          try {
            await cloudinary.uploader.destroy(existing.cloudinary_public_id);
          } catch (err) {
            console.error('Failed to delete old image from Cloudinary:', err);
          }
        }

        const newCount = existing.status === 'REJECTED' ? existing.resubmission_count + 1 : existing.resubmission_count;
        await pool.query(`
          UPDATE task_submissions
          SET status = 'SUBMITTED', screenshot_url = $1, cloudinary_public_id = $2, custom_field_value = $3, submitted_at = NOW(), resubmission_count = $4, updated_at = NOW()
          WHERE id = $5
        `, [screenshot_url, cloudinary_public_id, custom_field_value, newCount, existing.id]);
        return res.json({ success: true, id: existing.id });
      }

      const subRes = await pool.query(`
        INSERT INTO task_submissions (task_id, user_id, status, screenshot_url, cloudinary_public_id, custom_field_value, submitted_at)
        VALUES ($1, $2, 'SUBMITTED', $3, $4, $5, NOW())
        RETURNING id
      `, [task_id, req.user.id, screenshot_url, cloudinary_public_id, custom_field_value]);
      res.json({ success: true, id: subRes.rows[0].id });
    } catch (err: any) {
      // Bug 3: Handle race condition — two simultaneous requests both passed the SELECT check
      // and now one fails on the UNIQUE(task_id, user_id) constraint
      if (err.code === '23505') {
        if (cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
        }
        return res.status(400).json({ error: 'You have already submitted this task.' });
      }
      if (cloudinary_public_id) {
        try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) { }
      }
      console.error('Submission DB Error:', err);
      res.status(500).json({ error: 'Failed to save submission' });
    }
  });

  app.delete('/api/submissions/:id', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    const subId = req.params.id;
    if (req.user.role === 'STUDENT' && !req.user.is_coordinator)
      return res.status(403).json({ error: 'Only coordinators can delete submissions' });

    const subRes = await pool.query(`
      SELECT ts.*, u.class_id, u.department_id
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.id = $1 LIMIT 1
    `, [subId]);
    const sub = subRes.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    if (req.user.role === 'STUDENT' && req.user.is_coordinator) {
      if (sub.class_id?.toString() !== req.user.class_id?.toString())
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'CLASS_ADVISOR') {
      if (req.user.is_year_coordinator) {
        const studentClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [sub.class_id]);
        const studentClass = studentClassRes.rows[0];
        if (!studentClass || studentClass.department_id?.toString() !== req.user.department_id?.toString() || studentClass.year !== req.user.year_scope) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else {
        if (sub.class_id?.toString() !== req.user.class_id?.toString())
          return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (req.user.role === 'HOD') {
      if (sub.department_id?.toString() !== req.user.department_id?.toString())
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Clean up Cloudinary asset
    if (sub.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(sub.cloudinary_public_id);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }

    await pool.query('DELETE FROM task_submissions WHERE id = $1', [subId]);
    res.json({ success: true });
  });

  app.post('/api/submissions/batch-verify', authenticate, authorize(['HOD', 'SUPREME_ADMIN', 'STUDENT', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { submission_ids, verification_note } = req.body;
    if (!Array.isArray(submission_ids) || submission_ids.length === 0) {
      return res.status(400).json({ error: 'submission_ids array is required' });
    }

    if (req.user.role === 'STUDENT' && !req.user.is_coordinator) {
      return res.status(403).json({ error: 'Only student coordinators can verify' });
    }

    const note = verification_note || 'Batch verified';
    await pool.query(`
      UPDATE task_submissions
      SET status = 'VERIFIED', verification_note = $1, verified_at = CURRENT_TIMESTAMP, updated_at = NOW()
      WHERE id = ANY($2) AND status != 'VERIFIED'
    `, [note, submission_ids]);

    res.json({ success: true, count: submission_ids.length });
  });

  app.patch('/api/submissions/:id/verify', authenticate, authorize(['HOD', 'SUPREME_ADMIN', 'STUDENT', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { status, verification_note, rejection_reason } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be VERIFIED or REJECTED.' });
    }

    if (req.user.role === 'STUDENT' && !req.user.is_coordinator)
      return res.status(403).json({ error: 'Only coordinators can verify' });

    const subRes = await pool.query(`
      SELECT ts.*, u.class_id, u.department_id
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.id = $1 LIMIT 1
    `, [req.params.id]);
    const sub = subRes.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    if (sub.status === 'VERIFIED') {
      return res.status(400).json({ error: 'This submission has already been verified and cannot be modified.' });
    }

    // Role-based scope checks
    if (req.user.role === 'STUDENT' && req.user.is_coordinator) {
      if (sub.class_id?.toString() !== req.user.class_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (req.user.role === 'CLASS_ADVISOR') {
      if (req.user.is_year_coordinator) {
        const studentClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [sub.class_id]);
        const studentClass = studentClassRes.rows[0];
        if (!studentClass || studentClass.department_id?.toString() !== req.user.department_id?.toString() || studentClass.year !== req.user.year_scope) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else {
        if (sub.class_id?.toString() !== req.user.class_id?.toString()) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    } else if (req.user.role === 'HOD') {
      if (sub.department_id?.toString() !== req.user.department_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (status === 'REJECTED' && (!rejection_reason || !rejection_reason.trim())) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE task_submissions
        SET status = $1,
            verification_note = $2,
            rejection_reason = $3,
            verified_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
      `, [
        status,
        status === 'VERIFIED' ? verification_note || null : null,
        status === 'REJECTED' ? rejection_reason || null : null,
        req.params.id
      ]);

      await client.query(`
        INSERT INTO submission_reviews (submission_id, reviewer_id, previous_status, new_status, feedback)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.params.id,
        req.user.id,
        sub.status,
        status,
        status === 'VERIFIED' ? (verification_note || null) : (rejection_reason || null)
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Verify Transaction Error:', err);
      return res.status(500).json({ error: 'Database update failed during verification' });
    } finally {
      client.release();
    }

    const taskRes = await pool.query('SELECT title FROM tasks WHERE id = $1 LIMIT 1', [sub.task_id]);
    const taskTitle = taskRes.rows[0] ? taskRes.rows[0].title : 'Task';
    const message = status === 'VERIFIED'
      ? `Your submission for "${taskTitle}" has been verified.${verification_note ? ` Note: ${verification_note}` : ''}`
      : `Your submission for "${taskTitle}" has been rejected. Reason: ${rejection_reason}`;

    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)', [sub.user_id, message, status]);
    res.json({ success: true });
  });

  app.get('/api/submissions/:id/reviews', authenticate, async (req: any, res) => {
    const subId = req.params.id;
    const subRes = await pool.query(`
      SELECT ts.*, u.class_id, u.department_id
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.id = $1 LIMIT 1
    `, [subId]);
    const sub = subRes.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    // Authorization checks
    const isOwner = sub.user_id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'SUPREME_ADMIN';
    const isHOD = req.user.role === 'HOD' && sub.department_id?.toString() === req.user.department_id?.toString();
    const isCoordinator = req.user.role === 'STUDENT' && req.user.is_coordinator && sub.class_id?.toString() === req.user.class_id?.toString();

    let isClassAdvisor = false;
    if (req.user.role === 'CLASS_ADVISOR') {
      if (req.user.is_year_coordinator) {
        const studentClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [sub.class_id]);
        const studentClass = studentClassRes.rows[0];
        if (studentClass && studentClass.department_id?.toString() === req.user.department_id?.toString() && studentClass.year === req.user.year_scope) {
          isClassAdvisor = true;
        }
      } else {
        if (sub.class_id?.toString() === req.user.class_id?.toString()) {
          isClassAdvisor = true;
        }
      }
    }

    if (!isOwner && !isAdmin && !isHOD && !isClassAdvisor && !isCoordinator) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const reviewsRes = await pool.query(`
      SELECT sr.*, u.full_name as reviewer_name, u.role as reviewer_role
      FROM submission_reviews sr
      JOIN users u ON sr.reviewer_id = u.id
      WHERE sr.submission_id = $1
      ORDER BY sr.created_at ASC
    `, [subId]);

    res.json(reviewsRes.rows.map(r => ({
      id: r.id,
      submission_id: r.submission_id,
      reviewer_id: r.reviewer_id,
      reviewer_name: r.reviewer_name,
      reviewer_role: r.reviewer_role,
      previous_status: r.previous_status,
      new_status: r.new_status,
      feedback: r.feedback,
      created_at: r.created_at
    })));
  });



  // ── Notifications ─────────────────────────────────────────────────────────
  app.get('/api/notifications', authenticate, async (req: any, res) => {
    const notifsRes = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(notifsRes.rows.map(n => ({
      id: n.id, message: n.message, type: n.type,
      is_read: n.is_read, created_at: n.created_at,
    })));
  });

  app.patch('/api/notifications/read', authenticate, async (req: any, res) => {
    await pool.query('UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  });

  app.patch('/api/submissions/:id/unlock', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), async (req: any, res) => {
    const subId = req.params.id;
    const subRes = await pool.query(`
      SELECT ts.*, u.class_id, u.department_id
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.id = $1 LIMIT 1
    `, [subId]);
    const sub = subRes.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    // Authorization checks
    let isAuthorized = false;
    if (req.user.role === 'SUPREME_ADMIN') isAuthorized = true;
    else if (req.user.role === 'HOD' && sub.department_id?.toString() === req.user.department_id?.toString()) isAuthorized = true;
    else if (req.user.role === 'CLASS_ADVISOR') {
      if (req.user.is_year_coordinator) {
        const studentClassRes = await pool.query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [sub.class_id]);
        const studentClass = studentClassRes.rows[0];
        if (studentClass && studentClass.department_id?.toString() === req.user.department_id?.toString() && studentClass.year === req.user.year_scope) {
          isAuthorized = true;
        }
      } else {
        if (sub.class_id?.toString() === req.user.class_id?.toString()) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) return res.status(403).json({ error: 'Forbidden' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE task_submissions
        SET resubmission_count = 0, status = 'REJECTED', updated_at = NOW()
        WHERE id = $1
      `, [subId]);

      await client.query(`
        INSERT INTO submission_reviews (submission_id, reviewer_id, previous_status, new_status, feedback)
        VALUES ($1, $2, $3, 'REJECTED', 'Submission unlocked for resubmission')
      `, [subId, req.user.id, sub.status]);

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Unlock Transaction Error:', err);
      res.status(500).json({ error: 'Database update failed during unlock' });
    } finally {
      client.release();
    }
  });

  app.get('/api/team/report', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT 
          t.id as team_id,
          t.team_name,
          t.status as team_status,
          t.created_at,
          t.leader_id,
          tk.id as task_id,
          tk.title as task_title,
          tk.category as task_category,
          tk.custom_field_label,
          leader.full_name as leader_name,
          leader.register_number as leader_regno,
          ts.status as submission_status,
          ts.proof_url,
          ts.remarks
        FROM teams t
        JOIN tasks tk ON t.task_id = tk.id
        JOIN users leader ON t.leader_id = leader.id
        LEFT JOIN team_submissions ts ON t.id = ts.team_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (req.user.role === 'STUDENT' || (req.user.role === 'CLASS_ADVISOR' && !req.user.is_year_coordinator)) {
        params.push(req.user.class_id);
        query += ` AND (t.class_id = $${params.length} OR leader.class_id = $${params.length})`;
      } else if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
        params.push(req.user.department_id);
        params.push(req.user.year_scope);
        query += ` AND (t.class_id IN (SELECT id FROM classes WHERE department_id = $1 AND year = $2) OR leader.class_id IN (SELECT id FROM classes WHERE department_id = $1 AND year = $2))`;
      } else if (req.user.role === 'HOD') {
        params.push(req.user.department_id);
        query += ` AND leader.department_id = $${params.length}`;
      }

      // Optional filters passed from UI report generator (HOD / Year Coordinator / Advisor filters)
      if (req.query.class_ids) {
        const cids = String(req.query.class_ids).split(',').map(s => s.trim()).filter(Boolean);
        if (cids.length > 0) {
          params.push(cids);
          query += ` AND (t.class_id = ANY($${params.length}) OR leader.class_id = ANY($${params.length}))`;
        }
      }

      if (req.query.task_id) {
        params.push(req.query.task_id);
        query += ` AND tk.id = $${params.length}`;
      }

      query += ' ORDER BY tk.title ASC, t.team_name ASC';
      const teamsRes = await pool.query(query, params);

      const teams = teamsRes.rows;
      const teamIds = teams.map(t => t.team_id);

      if (teamIds.length > 0) {
        const membersRes = await pool.query(`
          SELECT tm.team_id, tm.student_id, u.full_name, u.register_number, u.email, tm.status
          FROM team_members tm
          JOIN users u ON tm.student_id = u.id
          WHERE tm.team_id = ANY($1)
          ORDER BY tm.joined_at ASC
        `, [teamIds]);

        const membersByTeam = new Map<string, any[]>();
        membersRes.rows.forEach(m => {
          const key = m.team_id.toString();
          if (!membersByTeam.has(key)) membersByTeam.set(key, []);
          membersByTeam.get(key)!.push({
            student_id: m.student_id,
            full_name: m.full_name,
            register_number: m.register_number,
            email: m.email,
            status: m.status
          });
        });

        teams.forEach(team => {
          team.members = membersByTeam.get(team.team_id.toString()) || [];
        });
      } else {
        teams.forEach(team => { team.members = []; });
      }

      res.json(teams);
    } catch (err) {
      console.error('Error fetching team report data:', err);
      res.status(500).json({ error: 'Failed to fetch team report data' });
    }
  });

  // ── Stats: Advisor ────────────────────────────────────────────────────────
  app.get('/api/stats/advisor', authenticate, authorize(['CLASS_ADVISOR']), async (req: any, res) => {
    let classId = req.user.class_id;
    const deptId = req.user.department_id;

    if (!classId) {
      const clsRes = await pool.query('SELECT id FROM classes WHERE advisor_id = $1 LIMIT 1', [req.user.id]);
      if (clsRes.rows.length > 0) {
        classId = clsRes.rows[0].id;
      }
    }

    if (!classId) {
      return res.json({
        taskStats: [],
        studentStats: [],
        total_students: 0,
        submitted_tasks_count: 0,
        verified_tasks_count: 0,
        rejected_tasks_count: 0,
        pending_tasks_count: 0
      });
    }

    const tasksRes = await pool.query(`
      SELECT t.*, (SELECT array_remove(array_agg(class_id), NULL) FROM task_classes WHERE task_id = t.id) as class_ids
      FROM tasks t
      WHERE EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id AND class_id = $1)
         OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
         OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
    `, [classId, deptId]);
    const tasks = tasksRes.rows;

    const studentsRes = await pool.query('SELECT id, full_name, register_number FROM users WHERE class_id = $1 AND role = \'STUDENT\' ORDER BY register_number ASC', [classId]);
    const students = studentsRes.rows;
    const studentIds = students.map(s => s.id);

    // Batch all submissions for advisor stats in 2 queries (was N+1 per task + N per student)
    const taskIds = tasks.map(t => t.id);
    const allAdvisorSubsRes = (taskIds.length > 0 && studentIds.length > 0)
      ? await pool.query('SELECT task_id, user_id, status FROM task_submissions WHERE task_id = ANY($1) AND user_id = ANY($2)', [taskIds, studentIds])
      : { rows: [] };
    const advisorSubsByTask = new Map<string, { status: string }[]>();
    const advisorVerifiedByUser = new Map<string, number>();
    allAdvisorSubsRes.rows.forEach((s: any) => {
      const tKey = s.task_id.toString();
      if (!advisorSubsByTask.has(tKey)) advisorSubsByTask.set(tKey, []);
      advisorSubsByTask.get(tKey)!.push({ status: s.status });
      if (s.status === 'VERIFIED') {
        const uKey = s.user_id.toString();
        advisorVerifiedByUser.set(uKey, (advisorVerifiedByUser.get(uKey) || 0) + 1);
      }
    });

    const taskStats = tasks.map((t: any) => {
      const subs = advisorSubsByTask.get(t.id.toString()) || [];
      return {
        id: t.id, title: t.title,
        submitted: subs.filter(s => s.status === 'SUBMITTED').length,
        verified: subs.filter(s => s.status === 'VERIFIED').length,
        pending: Math.max(0, studentIds.length - subs.length),
        rejected: subs.filter(s => s.status === 'REJECTED').length,
      };
    });

    const totalTasks = tasks.length;
    const studentStats = students.map((u: any) => ({
      full_name: u.full_name,
      register_number: u.register_number,
      completed_tasks: advisorVerifiedByUser.get(u.id.toString()) || 0,
      total_tasks: totalTasks
    }));

    const totalStudentsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId]);
    const totalBoysRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND UPPER(gender) IN ('MALE', 'BOYS', 'BOY', 'M')", [classId]);
    const totalGirlsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND UPPER(gender) IN ('FEMALE', 'GIRLS', 'GIRL', 'F')", [classId]);

    const submittedCountRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'SUBMITTED'
    `, [classId]);
    const verifiedCountRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'VERIFIED'
    `, [classId]);
    const rejectedCountRes = await pool.query(`
      SELECT count(*) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND ts.status = 'REJECTED'
    `, [classId]);

    const boysVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('MALE', 'BOYS', 'BOY', 'M') AND ts.status = 'VERIFIED'
    `, [classId]);
    const girlsVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND UPPER(u.gender) IN ('FEMALE', 'GIRLS', 'GIRL', 'F') AND ts.status = 'VERIFIED'
    `, [classId]);

    const totalStudents = parseInt(totalStudentsRes.rows[0].count);
    const totalBoys = parseInt(totalBoysRes.rows[0].count);
    const totalGirls = parseInt(totalGirlsRes.rows[0].count);
    const submittedCount = parseInt(submittedCountRes.rows[0].count);
    const verifiedCount = parseInt(verifiedCountRes.rows[0].count);
    const rejectedCount = parseInt(rejectedCountRes.rows[0].count);
    const boysVerified = parseInt(boysVerifiedRes.rows[0].count);
    const girlsVerified = parseInt(girlsVerifiedRes.rows[0].count);

    res.json({
      taskStats,
      studentStats,
      total_students: totalStudents,
      submitted_tasks_count: submittedCount,
      verified_tasks_count: verifiedCount,
      rejected_tasks_count: rejectedCount,
      pending_tasks_count: (totalTasks * totalStudents) - submittedCount - verifiedCount,
      total_boys: totalBoys,
      total_girls: totalGirls,
      boys_verified: boysVerified,
      girls_verified: girlsVerified,
      boys_incomplete: Math.max(0, totalBoys - boysVerified),
      girls_incomplete: Math.max(0, totalGirls - girlsVerified),
    });
  });

  // ── Stats: Year Coordinator ───────────────────────────────────────────────
  app.get('/api/stats/year', authenticate, async (req: any, res) => {
    if (!req.user.is_year_coordinator)
      return res.status(403).json({ error: 'Only year coordinators can access these stats' });

    const yearScope = req.user.year_scope;
    const deptId = req.user.department_id;

    const classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 AND year = $2', [deptId, yearScope]);
    const classes = classesRes.rows;
    const classIds = classes.map(c => c.id);

    let students: any[] = [];
    let studentIds: string[] = [];
    if (classIds.length > 0) {
      const studentsRes = await pool.query('SELECT id, class_id FROM users WHERE class_id = ANY($1) AND role = \'STUDENT\'', [classIds]);
      students = studentsRes.rows;
      studentIds = students.map(s => s.id);
    }

    const tasksRes = await pool.query(`
      SELECT DISTINCT t.*
      FROM tasks t
      LEFT JOIN task_classes tc ON t.id = tc.task_id
      WHERE tc.class_id = ANY($1)
         OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
         OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
    `, [classIds, deptId]);
    const tasks = tasksRes.rows;

    // Batch year-stats queries: 2 queries total instead of N per task + N per class
    const yearTaskIds = tasks.map((t: any) => t.id);
    const allYearSubsRes = (yearTaskIds.length > 0 && studentIds.length > 0)
      ? await pool.query('SELECT task_id, user_id, status FROM task_submissions WHERE task_id = ANY($1) AND user_id = ANY($2)', [yearTaskIds, studentIds])
      : { rows: [] };
    const yearSubsByTask = new Map<string, Map<string, string>>();
    allYearSubsRes.rows.forEach((s: any) => {
      const tKey = s.task_id.toString();
      if (!yearSubsByTask.has(tKey)) yearSubsByTask.set(tKey, new Map());
      yearSubsByTask.get(tKey)!.set(s.user_id.toString(), s.status);
    });

    const taskStats = tasks.map((t: any) => {
      const sMap = yearSubsByTask.get(t.id.toString()) || new Map();
      const statuses = Array.from(sMap.values());
      return {
        id: t.id, title: t.title,
        submitted: statuses.filter(s => s === 'SUBMITTED').length,
        verified: statuses.filter(s => s === 'VERIFIED').length,
        pending: studentIds.length - sMap.size,
        rejected: statuses.filter(s => s === 'REJECTED').length,
      };
    });

    // Batch class participation in one GROUP BY query
    let yearParticipationMap = new Map<string, number>();
    if (studentIds.length > 0) {
      const partRes = await pool.query(`
        SELECT u.class_id, count(DISTINCT ts.user_id) as cnt
        FROM task_submissions ts
        JOIN users u ON ts.user_id = u.id
        WHERE u.class_id = ANY($1)
        GROUP BY u.class_id
      `, [classIds]);
      partRes.rows.forEach((r: any) => yearParticipationMap.set(r.class_id.toString(), parseInt(r.cnt)));
    }

    const classStats = classes.map((c: any) => {
      const classStudents = students.filter((s: any) => s.class_id?.toString() === c.id.toString());
      return {
        id: c.id, name: c.name,
        total_students: classStudents.length,
        participating_students: yearParticipationMap.get(c.id.toString()) || 0,
      };
    });

    res.json({ total_students: students.length, total_classes: classes.length, taskStats, classStats, year: yearScope });
  });

  // ── Stats: Student ────────────────────────────────────────────────────────
  app.get('/api/stats/student', authenticate, authorize(['STUDENT']), async (req: any, res) => {
    const userId = req.user.id;
    const deptId = req.user.department_id;
    const classId = req.user.class_id;

    const tasksRes = await pool.query(`
      SELECT count(DISTINCT t.id) as count
      FROM tasks t
      LEFT JOIN task_classes tc ON t.id = tc.task_id
      WHERE tc.class_id = $1
         OR (t.department_id = $2 AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
         OR (t.department_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_classes WHERE task_id = t.id))
    `, [classId, deptId]);
    const totalTasks = parseInt(tasksRes.rows[0].count);

    const subsRes = await pool.query('SELECT status FROM task_submissions WHERE user_id = $1', [userId]);
    const subs = subsRes.rows;

    res.json({
      total_tasks: totalTasks,
      verified_tasks: subs.filter(s => s.status === 'VERIFIED').length,
      submitted_tasks: subs.filter(s => s.status === 'SUBMITTED').length,
      rejected_tasks: subs.filter(s => s.status === 'REJECTED').length,
    });
  });

  // ── Student Profile Module Endpoints ─────────────────────────────────────
  app.get('/api/student/profile', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
      // Academic identity details from users table
      const userRes = await client.query(`
        SELECT u.id, u.full_name, u.register_number, u.email, u.gender, u.role, u.avatar_url,
               d.name as department_name, c.name as class_name, c.batch, c.year
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.id = $1
      `, [userId]);

      let academic = userRes.rows[0] || {};

      const dirStudent = (academic.register_number && constantStudentByRegNoMap.get(academic.register_number.toLowerCase().trim())) ||
        (academic.email && constantStudentByEmailMap.get(academic.email.toLowerCase().trim()));

      if (dirStudent) {
        academic.full_name = academic.full_name || dirStudent.full_name;
        academic.register_number = academic.register_number || dirStudent.register_number;
        academic.email = academic.email || dirStudent.email;
        academic.gender = (academic.gender && academic.gender !== 'Not Specified') ? academic.gender : (dirStudent.gender || 'Not Specified');
        academic.class_name = academic.class_name || dirStudent.class_name || 'Unassigned Section';
        academic.department_name = academic.department_name || 'Information Technology';
        academic.batch = academic.batch || '2023 - 2027';
        academic.year = academic.year || dirStudent.year || 'III';
      }

      academic.full_name = academic.full_name || req.user.full_name || 'Student';
      academic.register_number = academic.register_number || req.user.register_number || req.user.username || 'N/A';
      academic.email = academic.email || req.user.email || 'N/A';
      academic.gender = (academic.gender && academic.gender !== 'Not Specified') ? academic.gender : 'Not Specified';
      academic.department_name = academic.department_name || 'Information Technology';
      academic.class_name = academic.class_name || 'Unassigned Section';
      academic.batch = academic.batch || '2023 - 2027';
      academic.year = academic.year ? (String(academic.year).startsWith('Year') ? academic.year : `Year ${academic.year}`) : 'Year III';

      const personalRes = await client.query('SELECT * FROM student_profiles WHERE user_id = $1', [userId]);
      const skillsRes = await client.query('SELECT * FROM student_skills WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const projectsRes = await client.query('SELECT * FROM student_projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const internshipsRes = await client.query('SELECT * FROM student_internships WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const certsRes = await client.query('SELECT * FROM student_certifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const codingRes = await client.query('SELECT * FROM student_coding_profiles WHERE user_id = $1', [userId]);
      const resumeRes = await client.query('SELECT * FROM student_resumes WHERE user_id = $1', [userId]);
      const achieveRes = await client.query('SELECT * FROM student_achievements WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const langRes = await client.query('SELECT * FROM student_languages WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const careerRes = await client.query('SELECT * FROM student_career_preferences WHERE user_id = $1', [userId]);

      res.json({
        academic,
        personal: personalRes.rows[0] || null,
        skills: skillsRes.rows,
        projects: projectsRes.rows,
        internships: internshipsRes.rows,
        certifications: certsRes.rows,
        coding_profiles: codingRes.rows[0] || null,
        resume: resumeRes.rows[0] || null,
        achievements: achieveRes.rows,
        languages: langRes.rows,
        career_preferences: careerRes.rows[0] || null
      });
    } finally {
      client.release();
    }
  }));

  // View specific student's profile (HOD/Admin can view all, Advisor/Coordinator can view assigned class/year)
  app.get('/api/student/profile/:studentId', authenticate, asyncHandler(async (req: any, res: Response) => {
    const targetUserId = req.params.studentId;
    const currentUser = req.user;
    const client = await pool.connect();

    try {
      // Fetch target student's academic record
      const targetUserRes = await client.query(`
        SELECT u.id, u.full_name, u.register_number, u.email, u.gender, u.role, u.avatar_url,
               u.department_id, u.class_id, d.name as department_name, c.name as class_name, c.batch, c.year
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.id = $1 AND u.role = 'STUDENT'
      `, [targetUserId]);

      if (targetUserRes.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const academic = targetUserRes.rows[0];

      // Authorization checks:
      const isSelf = currentUser.id?.toString() === targetUserId.toString();
      const isAdmin = currentUser.role === 'ADMIN';
      const isHOD = currentUser.role === 'HOD';
      const isAdvisorOrCoordinator = (currentUser.role === 'ADVISOR' || currentUser.role === 'COORDINATOR' || currentUser.is_coordinator) &&
        currentUser.class_id?.toString() === academic.class_id?.toString();
      const isYearCoordinator = currentUser.is_year_coordinator && currentUser.year_scope === academic.year;

      if (!isSelf && !isAdmin && !isHOD && !isAdvisorOrCoordinator && !isYearCoordinator) {
        return res.status(403).json({ error: 'You do not have permission to view this student profile' });
      }

      const personalRes = await client.query('SELECT * FROM student_profiles WHERE user_id = $1', [targetUserId]);
      const skillsRes = await client.query('SELECT * FROM student_skills WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const projectsRes = await client.query('SELECT * FROM student_projects WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const internshipsRes = await client.query('SELECT * FROM student_internships WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const certsRes = await client.query('SELECT * FROM student_certifications WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const codingRes = await client.query('SELECT * FROM student_coding_profiles WHERE user_id = $1', [targetUserId]);
      const resumeRes = await client.query('SELECT * FROM student_resumes WHERE user_id = $1', [targetUserId]);
      const achieveRes = await client.query('SELECT * FROM student_achievements WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const langRes = await client.query('SELECT * FROM student_languages WHERE user_id = $1 ORDER BY created_at DESC', [targetUserId]);
      const careerRes = await client.query('SELECT * FROM student_career_preferences WHERE user_id = $1', [targetUserId]);

      res.json({
        academic,
        personal: personalRes.rows[0] || null,
        skills: skillsRes.rows,
        projects: projectsRes.rows,
        internships: internshipsRes.rows,
        certifications: certsRes.rows,
        coding_profiles: codingRes.rows[0] || null,
        resume: resumeRes.rows[0] || null,
        achievements: achieveRes.rows,
        languages: langRes.rows,
        career_preferences: careerRes.rows[0] || null
      });
    } finally {
      client.release();
    }
  }));

  // Avatar Upload / Update
  app.post('/api/student/profile/avatar', authenticate, authorize(['STUDENT']), (req: any, res: Response, next: NextFunction) => {
    memoryUpload.single('avatar')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      next();
    });
  }, asyncHandler(async (req: any, res: Response) => {
    let avatarUrl = req.body?.avatar_url;

    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        const cloudRes = await cloudinary.uploader.upload(dataURI, {
          folder: 'student-avatars',
          resource_type: 'image'
        });
        avatarUrl = cloudRes.secure_url;
      } catch (cloudErr) {
        console.warn('[Avatar Upload] Cloudinary upload warning, falling back to data URI:', cloudErr);
        avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    if (req.body?.remove === 'true' || req.body?.remove === true) {
      avatarUrl = null;
    }

    if (!avatarUrl && !req.file && !req.body?.remove) {
      return res.status(400).json({ error: 'Please select an image file or enter an image URL' });
    }

    const updatedUserRes = await pool.query(`
      UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, avatar_url
    `, [avatarUrl, req.user.id]);

    res.json({ message: 'Profile photo updated successfully', avatar_url: avatarUrl, user: updatedUserRes.rows[0] });
  }));

  // 1. Personal Information Update
  app.put('/api/student/profile/personal', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { mobile_number, date_of_birth, semester, cgpa, current_arrears, history_of_arrears, about_me } = req.body;

    const result = await pool.query(`
      INSERT INTO student_profiles (user_id, mobile_number, date_of_birth, semester, cgpa, current_arrears, history_of_arrears, about_me)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        mobile_number = EXCLUDED.mobile_number,
        date_of_birth = EXCLUDED.date_of_birth,
        semester = EXCLUDED.semester,
        cgpa = EXCLUDED.cgpa,
        current_arrears = EXCLUDED.current_arrears,
        history_of_arrears = EXCLUDED.history_of_arrears,
        about_me = EXCLUDED.about_me,
        updated_at = NOW()
      RETURNING *
    `, [userId, mobile_number, date_of_birth, semester, cgpa, current_arrears, history_of_arrears, about_me]);

    res.json({ message: 'Personal profile updated', profile: result.rows[0] });
  }));

  // 2. Skills Add/Delete
  app.post('/api/student/profile/skills', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { skill_name, category, level } = req.body;
    if (!skill_name) return res.status(400).json({ error: 'Skill name is required' });

    const result = await pool.query(`
      INSERT INTO student_skills (user_id, skill_name, category, level)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [userId, skill_name, category || 'Technical', level || 'Intermediate']);

    res.json({ message: 'Skill added', skill: result.rows[0] });
  }));

  app.delete('/api/student/profile/skills/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_skills WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Skill deleted' });
  }));

  // 3. Projects Add/Delete
  app.post('/api/student/profile/projects', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { project_name, description, tech_stack, github_url, live_demo_url } = req.body;
    if (!project_name) return res.status(400).json({ error: 'Project name is required' });

    const result = await pool.query(`
      INSERT INTO student_projects (user_id, project_name, description, tech_stack, github_url, live_demo_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, project_name, description, tech_stack, github_url, live_demo_url]);

    res.json({ message: 'Project added', project: result.rows[0] });
  }));

  app.delete('/api/student/profile/projects/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Project deleted' });
  }));

  // 4. Internships Add/Delete
  app.post('/api/student/profile/internships', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { company, role, duration, mode, certificate_url } = req.body;
    if (!company) return res.status(400).json({ error: 'Company name is required' });

    const result = await pool.query(`
      INSERT INTO student_internships (user_id, company, role, duration, mode, certificate_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, company, role, duration, mode || 'Offline', certificate_url]);

    res.json({ message: 'Internship added', internship: result.rows[0] });
  }));

  app.delete('/api/student/profile/internships/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_internships WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Internship deleted' });
  }));

  // 5. Certifications Add/Delete
  app.post('/api/student/profile/certifications', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { certificate_name, provider, issue_date, credential_id, certificate_url } = req.body;
    if (!certificate_name) return res.status(400).json({ error: 'Certificate name is required' });

    const result = await pool.query(`
      INSERT INTO student_certifications (user_id, certificate_name, provider, issue_date, credential_id, certificate_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId, certificate_name, provider, issue_date, credential_id, certificate_url]);

    res.json({ message: 'Certification added', certification: result.rows[0] });
  }));

  app.delete('/api/student/profile/certifications/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_certifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Certification deleted' });
  }));

  // 6. Coding Profiles Update
  app.put('/api/student/profile/coding-profiles', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio } = req.body;

    const result = await pool.query(`
      INSERT INTO student_coding_profiles (user_id, github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        github = EXCLUDED.github,
        leetcode = EXCLUDED.leetcode,
        hackerrank = EXCLUDED.hackerrank,
        codechef = EXCLUDED.codechef,
        geeksforgeeks = EXCLUDED.geeksforgeeks,
        linkedin = EXCLUDED.linkedin,
        portfolio = EXCLUDED.portfolio,
        updated_at = NOW()
      RETURNING *
    `, [userId, github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio]);

    res.json({ message: 'Coding profiles updated', profiles: result.rows[0] });
  }));

  // 7. Resume Save
  app.post('/api/student/profile/resume', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { resume_url, file_name } = req.body;
    if (!resume_url) return res.status(400).json({ error: 'Resume URL is required' });

    const result = await pool.query(`
      INSERT INTO student_resumes (user_id, resume_url, file_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        resume_url = EXCLUDED.resume_url,
        file_name = EXCLUDED.file_name,
        last_updated = NOW()
      RETURNING *
    `, [userId, resume_url, file_name || 'Resume.pdf']);

    res.json({ message: 'Resume updated', resume: result.rows[0] });
  }));

  // 8. Achievements Add/Delete
  app.post('/api/student/profile/achievements', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { title, category, description, event_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Achievement title is required' });

    const result = await pool.query(`
      INSERT INTO student_achievements (user_id, title, category, description, event_date)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [userId, title, category || 'Hackathons', description, event_date]);

    res.json({ message: 'Achievement added', achievement: result.rows[0] });
  }));

  app.delete('/api/student/profile/achievements/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_achievements WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Achievement deleted' });
  }));

  // 9. Languages Add/Delete
  app.post('/api/student/profile/languages', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { language, proficiency } = req.body;
    if (!language) return res.status(400).json({ error: 'Language is required' });

    const result = await pool.query(`
      INSERT INTO student_languages (user_id, language, proficiency)
      VALUES ($1, $2, $3) RETURNING *
    `, [userId, language, proficiency || 'Fluent']);

    res.json({ message: 'Language added', language: result.rows[0] });
  }));

  app.delete('/api/student/profile/languages/:id', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    await pool.query('DELETE FROM student_languages WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Language deleted' });
  }));

  // 10. Career Preferences Update
  app.put('/api/student/profile/career-preferences', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { preferred_role, preferred_domain, preferred_location, willing_to_relocate, work_mode } = req.body;

    const result = await pool.query(`
      INSERT INTO student_career_preferences (user_id, preferred_role, preferred_domain, preferred_location, willing_to_relocate, work_mode)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_role = EXCLUDED.preferred_role,
        preferred_domain = EXCLUDED.preferred_domain,
        preferred_location = EXCLUDED.preferred_location,
        willing_to_relocate = EXCLUDED.willing_to_relocate,
        work_mode = EXCLUDED.work_mode,
        updated_at = NOW()
      RETURNING *
    `, [userId, preferred_role, preferred_domain, preferred_location, willing_to_relocate ?? true, work_mode || 'Hybrid']);

    res.json({ message: 'Career preferences updated', career: result.rows[0] });
  }));

  // ── Settings: Change Password ──────────────────────────────────────────────
  app.put('/api/settings/change-password', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    let isMatch = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = (currentPassword === user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password changed successfully in database' });
  }));


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MODULE 1 â€” TASK DISCUSSION FORUM
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // GET /api/tasks/:taskId/discussions
  app.get('/api/tasks/:taskId/discussions', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { taskId } = req.params;
    const { sort = 'newest' } = req.query;
    const orderDir = sort === 'oldest' ? 'ASC' : 'DESC';

    const result = await pool.query(`
      SELECT d.id, d.task_id, d.parent_id, d.user_id, d.message,
        d.is_pinned, d.is_edited, d.created_at, d.updated_at, d.deleted_at,
        u.full_name AS author_name, u.role AS author_role,
        COALESCE(u.register_number, u.username) AS author_regno
      FROM task_discussions d
      JOIN users u ON d.user_id = u.id
      WHERE d.task_id = $1 AND d.deleted_at IS NULL
      ORDER BY d.is_pinned DESC, d.created_at ${orderDir}
    `, [taskId]);

    const topLevel = result.rows.filter((r: any) => !r.parent_id);
    const replies = result.rows.filter((r: any) => r.parent_id);
    const threaded = topLevel.map((post: any) => ({
      ...post,
      replies: replies
        .filter((r: any) => r.parent_id === post.id)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      reply_count: replies.filter((r: any) => r.parent_id === post.id).length,
    }));

    res.json(threaded);
  }));

  // POST /api/tasks/:taskId/discussions
  app.post('/api/tasks/:taskId/discussions', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { taskId } = req.params;
    const { message, parent_id } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const result = await pool.query(`
      INSERT INTO task_discussions (task_id, parent_id, user_id, message)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [taskId, parent_id || null, req.user.id, message.trim()]);

    const post = result.rows[0];

    if (!parent_id) {
      const taskRes = await pool.query('SELECT created_by, title FROM tasks WHERE id = $1', [taskId]);
      if (taskRes.rows[0] && String(taskRes.rows[0].created_by) !== String(req.user.id)) {
        await pool.query(
          `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'DISCUSSION_REPLY')`,
          [taskRes.rows[0].created_by, `New question on task "${taskRes.rows[0].title}" by ${req.user.username}`]
        );
      }
    } else {
      const origRes = await pool.query('SELECT user_id FROM task_discussions WHERE id = $1', [parent_id]);
      if (origRes.rows[0] && String(origRes.rows[0].user_id) !== String(req.user.id)) {
        await pool.query(
          `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'DISCUSSION_REPLY')`,
          [origRes.rows[0].user_id, `${req.user.username} replied to your discussion post`]
        );
      }
    }

    res.status(201).json(post);
  }));

  // PATCH /api/discussions/:id â€” edit post (own within 10 min, or staff)
  app.patch('/api/discussions/:id', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const postRes = await pool.query(
      'SELECT * FROM task_discussions WHERE id = $1 AND deleted_at IS NULL', [req.params.id]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];

    const isOwner = String(post.user_id) === String(req.user.id);
    const isStaff = ['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN'].includes(req.user.role);
    const withinWindow = isOwner && (Date.now() - new Date(post.created_at).getTime()) < 10 * 60 * 1000;

    if (!withinWindow && !isStaff) {
      return res.status(403).json({ error: 'You can only edit your own posts within 10 minutes' });
    }

    const updated = await pool.query(
      `UPDATE task_discussions SET message = $1, is_edited = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [message.trim(), req.params.id]
    );
    res.json(updated.rows[0]);
  }));

  // DELETE /api/discussions/:id â€” soft delete
  app.delete('/api/discussions/:id', authenticate, asyncHandler(async (req: any, res: Response) => {
    const postRes = await pool.query(
      'SELECT * FROM task_discussions WHERE id = $1 AND deleted_at IS NULL', [req.params.id]
    );
    if (!postRes.rows[0]) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];

    const isOwner = String(post.user_id) === String(req.user.id);
    const isStaff = ['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN'].includes(req.user.role);
    const withinWindow = isOwner && (Date.now() - new Date(post.created_at).getTime()) < 10 * 60 * 1000;

    if (!withinWindow && !isStaff) {
      return res.status(403).json({ error: 'You can only delete your own posts within 10 minutes' });
    }

    await pool.query(`UPDATE task_discussions SET deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  }));

  // PATCH /api/discussions/:id/pin â€” staff only
  app.patch('/api/discussions/:id/pin', authenticate, authorize(['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN']), asyncHandler(async (req: any, res: Response) => {
    const postRes = await pool.query('SELECT is_pinned FROM task_discussions WHERE id = $1', [req.params.id]);
    if (!postRes.rows[0]) return res.status(404).json({ error: 'Post not found' });

    const updated = await pool.query(
      `UPDATE task_discussions SET is_pinned = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [!postRes.rows[0].is_pinned, req.params.id]
    );
    res.json(updated.rows[0]);
  }));

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MODULE 2 â€” DIGITAL NOTICE BOARD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // GET /api/notices â€” fetch notices visible to the current user
  app.get('/api/notices', authenticate, asyncHandler(async (req: any, res: Response) => {
    const u = req.user;
    const { search, priority, scope: scopeFilter } = req.query as any;
    const params: any[] = [];
    const conditions: string[] = [
      `(n.expire_at IS NULL OR n.expire_at > NOW())`,
      `n.publish_at <= NOW()`,
    ];

    if (u.role === 'SUPREME_ADMIN') {
      // sees everything
    } else if (u.role === 'HOD') {
      params.push(u.department_id);
      conditions.push(
        `(n.scope='ALL' OR (n.scope='DEPARTMENT' AND n.department_id=$${params.length}) OR n.scope='YEAR' OR (n.scope='CLASS' AND (n.department_id=$${params.length} OR c.department_id=$${params.length})))`
      );
    } else if (u.role === 'CLASS_ADVISOR') {
      params.push(u.department_id, u.class_id);
      conditions.push(
        `(n.scope='ALL' OR (n.scope='DEPARTMENT' AND n.department_id=$${params.length - 1}) OR n.scope='YEAR' OR (n.scope='CLASS' AND (n.class_id=$${params.length} OR n.department_id=$${params.length - 1})))`
      );
    } else {
      params.push(u.department_id, u.class_id);
      conditions.push(
        `(n.scope='ALL' OR (n.scope='DEPARTMENT' AND n.department_id=$${params.length - 1}) OR (n.scope='CLASS' AND n.class_id=$${params.length}))`
      );
    }

    if (search) { params.push(`%${search}%`); conditions.push(`(n.title ILIKE $${params.length} OR n.description ILIKE $${params.length})`); }
    if (priority) { params.push(priority); conditions.push(`n.priority=$${params.length}`); }
    if (scopeFilter) { params.push(scopeFilter); conditions.push(`n.scope=$${params.length}`); }

    const result = await pool.query(`
      SELECT n.*, u.full_name AS creator_name, u.role AS creator_role,
        d.name AS department_name, c.name AS class_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      LEFT JOIN departments d ON n.department_id = d.id
      LEFT JOIN classes c ON n.class_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.is_pinned DESC,
        CASE n.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
        n.created_at DESC
    `, params);

    res.json(result.rows);
  }));

  // GET /api/notices/:id — fetch single notice detail
  app.get('/api/notices/:id', authenticate, asyncHandler(async (req: any, res: Response) => {
    const result = await pool.query(`
      SELECT n.*, u.full_name AS creator_name, u.role AS creator_role,
        d.name AS department_name, c.name AS class_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      LEFT JOIN departments d ON n.department_id = d.id
      LEFT JOIN classes c ON n.class_id = c.id
      WHERE n.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Notice not found' });
    res.json(result.rows[0]);
  }));

  // POST /api/notices
  app.post('/api/notices', authenticate, authorize(['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN']), asyncHandler(async (req: any, res: Response) => {
    const u = req.user;
    let { title, description, scope, department_id, class_id, class_ids, year, priority,
      attachment_url, attachment_cloudinary_public_id, publish_at, expire_at } = req.body;

    if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });

    // Enforce role-based scope fallbacks
    if (u.role === 'CLASS_ADVISOR') {
      scope = 'CLASS';
    } else if (u.role === 'HOD') {
      if (scope === 'ALL') scope = 'DEPARTMENT';
    }

    const deptId = u.role === 'CLASS_ADVISOR' ? u.department_id : (department_id || u.department_id || null);

    // Multi-class notice creation handling
    if (scope === 'CLASS' && Array.isArray(class_ids) && class_ids.length > 0) {
      const insertedNotices: any[] = [];
      for (const cid of class_ids) {
        if (!cid) continue;
        const result = await pool.query(`
          INSERT INTO notices
            (title, description, scope, department_id, class_id, year, priority,
             attachment_url, attachment_cloudinary_public_id, created_by, publish_at, expire_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
        `, [
          title.trim(), description.trim(), 'CLASS',
          deptId, cid, year || null, priority || 'NORMAL',
          attachment_url || null, attachment_cloudinary_public_id || null,
          u.id, publish_at || new Date().toISOString(), expire_at || null,
        ]);
        insertedNotices.push(result.rows[0]);
      }
      return res.status(201).json(insertedNotices[0] || { success: true });
    }

    const clsId = u.role === 'CLASS_ADVISOR' ? (class_id || u.class_id || null) : (class_id || null);

    const result = await pool.query(`
      INSERT INTO notices
        (title, description, scope, department_id, class_id, year, priority,
         attachment_url, attachment_cloudinary_public_id, created_by, publish_at, expire_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
      title.trim(), description.trim(), scope || 'DEPARTMENT',
      deptId, clsId, year || null, priority || 'NORMAL',
      attachment_url || null, attachment_cloudinary_public_id || null,
      u.id, publish_at || new Date().toISOString(), expire_at || null,
    ]);

    res.status(201).json(result.rows[0]);
  }));

  // PUT /api/notices/:id
  app.put('/api/notices/:id', authenticate, asyncHandler(async (req: any, res: Response) => {
    const nr = await pool.query('SELECT created_by FROM notices WHERE id = $1', [req.params.id]);
    if (!nr.rows[0]) return res.status(404).json({ error: 'Notice not found' });

    const isCreator = String(nr.rows[0].created_by) === String(req.user.id);
    const isAdmin = req.user.role === 'SUPREME_ADMIN';
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, scope, department_id, class_id, year, priority,
      attachment_url, attachment_cloudinary_public_id, publish_at, expire_at } = req.body;

    const result = await pool.query(`
      UPDATE notices SET
        title=COALESCE($1,title), description=COALESCE($2,description), scope=COALESCE($3,scope),
        department_id=$4, class_id=$5, year=$6, priority=COALESCE($7,priority),
        attachment_url=$8, attachment_cloudinary_public_id=$9,
        publish_at=COALESCE($10,publish_at), expire_at=$11, updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [title, description, scope, department_id || null, class_id || null, year || null, priority,
      attachment_url || null, attachment_cloudinary_public_id || null, publish_at, expire_at || null, req.params.id]);

    res.json(result.rows[0]);
  }));

  // DELETE /api/notices/:id
  app.delete('/api/notices/:id', authenticate, asyncHandler(async (req: any, res: Response) => {
    const nr = await pool.query('SELECT created_by FROM notices WHERE id = $1', [req.params.id]);
    if (!nr.rows[0]) return res.status(404).json({ error: 'Notice not found' });

    const isCreator = String(nr.rows[0].created_by) === String(req.user.id);
    const isAdmin = req.user.role === 'SUPREME_ADMIN';
    if (!isCreator && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('DELETE FROM notices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  }));

  // PATCH /api/notices/:id/pin
  app.patch('/api/notices/:id/pin', authenticate, asyncHandler(async (req: any, res: Response) => {
    const nr = await pool.query('SELECT created_by, is_pinned FROM notices WHERE id = $1', [req.params.id]);
    if (!nr.rows[0]) return res.status(404).json({ error: 'Notice not found' });

    const isCreator = String(nr.rows[0].created_by) === String(req.user.id);
    const isAdmin = req.user.role === 'SUPREME_ADMIN';
    const isHOD = req.user.role === 'HOD';
    if (!isCreator && !isAdmin && !isHOD) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      'UPDATE notices SET is_pinned=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [!nr.rows[0].is_pinned, req.params.id]
    );
    res.json(result.rows[0]);
  }));

  // POST /api/notices/upload â€” Cloudinary attachment upload
  app.post('/api/notices/upload', authenticate, authorize(['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN']),
    upload.single('attachment'), asyncHandler(async (req: any, res: Response) => {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const f = req.file as any;
      res.json({ attachment_url: f.path, attachment_cloudinary_public_id: f.filename });
    })
  );

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MODULE 4 â€” SMART REMINDER SETTINGS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // GET /api/reminders/settings
  app.get('/api/reminders/settings', authenticate, asyncHandler(async (req: any, res: Response) => {
    const result = await pool.query(
      'SELECT * FROM user_notification_settings WHERE user_id = $1', [req.user.id]
    );
    res.json(result.rows[0] || {
      task_reminders: true, event_reminders: true,
      notice_reminders: true,
    });
  }));

  // PUT /api/reminders/settings
  app.put('/api/reminders/settings', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { task_reminders, event_reminders, notice_reminders } = req.body;
    const result = await pool.query(`
      INSERT INTO user_notification_settings
        (user_id, task_reminders, event_reminders, notice_reminders, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        task_reminders=EXCLUDED.task_reminders, event_reminders=EXCLUDED.event_reminders,
        notice_reminders=EXCLUDED.notice_reminders,
        updated_at=NOW()
      RETURNING *
    `, [
      req.user.id,
      task_reminders !== undefined ? Boolean(task_reminders) : true,
      event_reminders !== undefined ? Boolean(event_reminders) : true,
      notice_reminders !== undefined ? Boolean(notice_reminders) : true,
    ]);
    res.json(result.rows[0]);
  }));

  // â”€â”€ Background Reminder Scheduler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const checkAndSendReminders = async () => {
    try {
      // 1. Task deadline tomorrow: notify students who haven't submitted
      const deadlineTasks = await pool.query(`
        SELECT t.id AS task_id, t.title, t.deadline, tc.class_id
        FROM tasks t JOIN task_classes tc ON t.id = tc.task_id
        WHERE t.status = 'OPEN'
          AND t.deadline IS NOT NULL
          AND t.deadline BETWEEN NOW() AND NOW() + INTERVAL '25 hours'
      `);

      for (const task of deadlineTasks.rows) {
        const students = await pool.query(`
          SELECT u.id FROM users u
          WHERE u.class_id = $1 AND u.role = 'STUDENT'
            AND NOT EXISTS (
              SELECT 1 FROM task_submissions ts
              WHERE ts.task_id = $2 AND ts.user_id = u.id
                AND ts.status IN ('SUBMITTED','VERIFIED')
            )
        `, [task.class_id, task.task_id]);

        for (const student of students.rows) {
          const settings = await pool.query(
            'SELECT task_reminders FROM user_notification_settings WHERE user_id = $1', [student.id]
          );
          if (settings.rows[0] && !settings.rows[0].task_reminders) continue;

          // Deduplicate â€” skip if already sent within 20 hours
          const existing = await pool.query(`
            SELECT id FROM scheduled_notifications
            WHERE user_id = $1 AND type = 'TASK_DEADLINE_TOMORROW'
              AND title LIKE $2 AND created_at > NOW() - INTERVAL '20 hours'
          `, [student.id, `%${task.task_id}%`]);
          if (existing.rows.length > 0) continue;

          await pool.query(
            `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'TASK_DEADLINE_TOMORROW')`,
            [student.id, `Deadline tomorrow: "${task.title}" â€” submit before it closes`]
          );
          await pool.query(`
            INSERT INTO scheduled_notifications
              (user_id, type, title, message, scheduled_time, status, sent_at)
            VALUES ($1, 'TASK_DEADLINE_TOMORROW', $2, $3, NOW(), 'SENT', NOW())
          `, [student.id, `Deadline Tomorrow: ${task.task_id}`, `Submit "${task.title}" before it closes`]);
        }
      }

      // 2. Profile incomplete reminder (weekly)
      const incomplete = await pool.query(`
        SELECT u.id FROM users u
        WHERE u.role = 'STUDENT'
          AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = u.id)
          AND NOT EXISTS (
            SELECT 1 FROM scheduled_notifications sn
            WHERE sn.user_id = u.id AND sn.type = 'PROFILE_INCOMPLETE'
              AND sn.created_at > NOW() - INTERVAL '7 days'
          )
        LIMIT 50
      `);

      for (const student of incomplete.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, message, type) VALUES ($1, 'Your student profile is incomplete. Fill it to unlock all features!', 'TASK_CREATED')`,
          [student.id]
        );
        await pool.query(`
          INSERT INTO scheduled_notifications
            (user_id, type, title, message, scheduled_time, status, sent_at)
          VALUES ($1, 'PROFILE_INCOMPLETE', 'Complete Your Profile', 'Profile incomplete', NOW(), 'SENT', NOW())
        `, [student.id]);
      }

      console.log(`[Reminder Scheduler] Completed at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[Reminder Scheduler] Error:', err);
    }
  };

  // Run once on startup, then every hour
  checkAndSendReminders();
  setInterval(checkAndSendReminders, 60 * 60 * 1000);
  // ── LeetCode Targets & Progress API Module ───────────────────────────────────

  // Utility: Extract username from profile URL or username
  function extractLeetCodeUsername(urlOrUsername: string): string {
    const clean = urlOrUsername.trim().replace(/\/$/, '');
    const match = clean.match(/leetcode\.com\/(?:u\/)?([^/]+)/);
    return match && match[1] ? match[1] : clean;
  }

  // Utility: Get date string in IST YYYY-MM-DD
  function getISTDateStr(): string {
    const offset = 5.5 * 60 * 60 * 1000; // IST is UTC +5:30
    const istDate = new Date(Date.now() + offset);
    return istDate.toISOString().split('T')[0];
  }

  // Utility: Get yesterday's date string (YYYY-MM-DD) from a given date string in local/IST time
  function getYesterdayDateStr(dateStr: string): string {
    const parts = dateStr.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() - 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Utility: Get start and end of week (Sunday to Saturday) in IST format
  function getWeekRange(dateStr: string): { start: string; end: string } {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(Date.UTC(year, month, day));
    const dayOfWeek = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ...

    // Get Sunday
    const sunday = new Date(date);
    sunday.setUTCDate(date.getUTCDate() - dayOfWeek);

    // Get Saturday
    const saturday = new Date(sunday);
    saturday.setUTCDate(sunday.getUTCDate() + 6);

    return {
      start: sunday.toISOString().split('T')[0],
      end: saturday.toISOString().split('T')[0]
    };
  }

  // Utility: In-memory target resolver with strict 4-level scope priority
  function resolveTargetInMemory(student: { id: string; class_id?: string; year?: number | null; department_id?: string }, targetRows: any[]) {
    const userId = student.id ? student.id.toString() : '';
    const classId = student.class_id ? student.class_id.toString() : '';
    const year = student.year !== undefined && student.year !== null ? Number(student.year) : null;
    const departmentId = student.department_id ? student.department_id.toString() : '';

    for (const t of targetRows) {
      // Scope Level 1: Individual Student Target
      if (t.user_id && t.user_id.toString() === userId) {
        return t;
      }
      // Scope Level 2: Class Section Target
      if (t.class_id && t.class_id.toString() === classId) {
        return t;
      }
      // Scope Level 3: Year / Batch Target
      if (t.year && year !== null && Number(t.year) === year) {
        if (!t.department_id || (departmentId && t.department_id.toString() === departmentId)) {
          return t;
        }
      }
      // Scope Level 4: Department Target (Only if user_id, class_id, and year are ALL NULL)
      if (t.department_id && !t.user_id && !t.class_id && !t.year && departmentId && t.department_id.toString() === departmentId) {
        return t;
      }
    }

    return {
      id: null,
      daily_target: 0,
      weekly_target: 0,
      start_date: null,
      end_date: null
    };
  }

  // Utility: Retrieve active target configuration for a student on a given date
  async function getActiveTargetForStudent(clientOrPool: any, userId: string, classId: string, year: number | null, departmentId: string, dateStr: string) {
    const targetsRes = await clientOrPool.query(`
      SELECT * FROM leetcode_targets 
      WHERE start_date <= $1 AND end_date >= $1
      ORDER BY 
        CASE 
          WHEN user_id IS NOT NULL THEN 1
          WHEN class_id IS NOT NULL THEN 2
          WHEN year IS NOT NULL THEN 3
          WHEN department_id IS NOT NULL THEN 4
          ELSE 5
        END ASC,
        created_at DESC
    `, [dateStr]);

    return resolveTargetInMemory({ id: userId, class_id: classId, year, department_id: departmentId }, targetsRes.rows);
  }

  interface LeetCodeDetails {
    totalSolved: number;
    recentSubmissions: Array<{ titleSlug: string; timestamp: number }>;
  }

  // Utility: Scrape User Stats & Recent Submissions from LeetCode
  async function fetchLeetCodeStats(profileUrlOrUsername: string): Promise<LeetCodeDetails | null> {
    const username = extractLeetCodeUsername(profileUrlOrUsername);
    if (!username) return null;
    try {
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        body: JSON.stringify({
          query: `
            query userProblemsSolved($username: String!) {
              matchedUser(username: $username) {
                submitStats {
                  acSubmissionNum {
                    difficulty
                    count
                  }
                }
              }
              recentAcSubmissionList(username: $username, limit: 50) {
                title
                titleSlug
                timestamp
              }
            }
          `,
          variables: { username }
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) return null;
      const result: any = await response.json();
      const stats = result.data?.matchedUser?.submitStats?.acSubmissionNum;
      const allStats = stats?.find((s: any) => s.difficulty === 'All');
      const totalSolved = allStats ? Number(allStats.count) : 0;

      const rawSubmissions = result.data?.recentAcSubmissionList || [];
      const recentSubmissions = rawSubmissions.map((s: any) => ({
        titleSlug: s.titleSlug,
        timestamp: Number(s.timestamp)
      }));

      return { totalSolved, recentSubmissions };
    } catch (err) {
      return null;
    }
  }

  // Core Sync Function
  async function syncLeetcodeProgressForScope(scopeFilter?: { departmentId?: string; classId?: string; year?: number; userId?: string }) {
    try {
      let query = `
        SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.batch 
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'STUDENT'
      `;
      const params: any[] = [];
      if (scopeFilter) {
        if (scopeFilter.userId) {
          params.push(scopeFilter.userId);
          query += ` AND u.id = $${params.length}`;
        } else if (scopeFilter.classId) {
          params.push(scopeFilter.classId);
          query += ` AND u.class_id = $${params.length}`;
        } else if (scopeFilter.year) {
          params.push(scopeFilter.year);
          query += ` AND c.year = $${params.length}`;
          if (scopeFilter.departmentId) {
            params.push(scopeFilter.departmentId);
            query += ` AND u.department_id = $${params.length}`;
          }
        } else if (scopeFilter.departmentId) {
          params.push(scopeFilter.departmentId);
          query += ` AND u.department_id = $${params.length}`;
        }
      }

      const students = await pool.query(query, params);
      const todayStr = getISTDateStr();

      // Timestamps for start & end of today in IST (UTC+5:30)
      const todayStartSec = Math.floor(new Date(`${todayStr}T00:00:00+05:30`).getTime() / 1000);
      const todayEndSec = Math.floor(new Date(`${todayStr}T23:59:59+05:30`).getTime() / 1000);

      let synced = 0;
      let failed = 0;

      const chunkSize = 5;
      for (let i = 0; i < students.rows.length; i += chunkSize) {
        const chunk = students.rows.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (student) => {
          const userId = student.id;
          const classId = student.class_id;
          const year = student.year ? Number(student.year) : null;
          const departmentId = student.department_id;
          
          const studentDir = constantStudentByIdMap.get(userId);
          const leetcodeProfile = studentDir?.leetcode || '';

          const activeTarget = await getActiveTargetForStudent(pool, userId, classId, year, departmentId, todayStr);

          let details: LeetCodeDetails | null = null;
          if (leetcodeProfile) {
            details = await fetchLeetCodeStats(leetcodeProfile);
          }

          if (details === null) {
            failed++;
            const existing = await pool.query(
              'SELECT id FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2',
              [userId, todayStr]
            );
            if (existing.rowCount === 0) {
              await pool.query(`
                INSERT INTO leetcode_daily_progress (user_id, date, total_solved, solved_today, daily_target, status)
                VALUES ($1, $2, NULL, 0, $3, 'DATA_UNAVAILABLE')
                ON CONFLICT (user_id, date) DO NOTHING
              `, [userId, todayStr, activeTarget.daily_target]);
            }
          } else {
            synced++;
            const fetchedCount = details.totalSolved;

            // Calculate count of unique accepted problems solved ON current date
            const recentTodayCount = new Set(
              details.recentSubmissions
                .filter(s => s.timestamp >= todayStartSec && s.timestamp <= todayEndSec)
                .map(s => s.titleSlug)
            ).size;

            // 1. Fetch strictly previous date record (yesterday or earlier)
            const prevRes = await pool.query(`
              SELECT total_solved FROM leetcode_daily_progress
              WHERE user_id = $1 AND date < $2 AND total_solved IS NOT NULL
              ORDER BY date DESC LIMIT 1
            `, [userId, todayStr]);

            // 2. Fetch existing today record (if sync was run earlier today)
            const todayRes = await pool.query(`
              SELECT total_solved, solved_today FROM leetcode_daily_progress
              WHERE user_id = $1 AND date = $2 AND total_solved IS NOT NULL
            `, [userId, todayStr]);

            let prevTotal: number | null = null;

            if (prevRes.rowCount > 0 && prevRes.rows[0].total_solved !== null) {
              prevTotal = Number(prevRes.rows[0].total_solved);
            } else if (todayRes.rowCount > 0 && todayRes.rows[0].total_solved !== null) {
              const tSolved = Number(todayRes.rows[0].total_solved);
              const sToday = Number(todayRes.rows[0].solved_today);
              prevTotal = tSolved - sToday;
            }

            let solvedToday = 0;
            if (prevTotal !== null && prevTotal !== undefined) {
              const diffSolved = Math.max(0, fetchedCount - prevTotal);
              solvedToday = Math.max(diffSolved, recentTodayCount);
            } else {
              solvedToday = recentTodayCount;
            }

            // Fetch solved count from yesterday (date = todayStr - 1)
            const yesterdayStr = getYesterdayDateStr(todayStr);
            const yesterdayRes = await pool.query(`
              SELECT solved_today FROM leetcode_daily_progress
              WHERE user_id = $1 AND date = $2
            `, [userId, yesterdayStr]);
            const solvedYesterday = yesterdayRes.rowCount > 0 ? Number(yesterdayRes.rows[0].solved_today) : 0;

            const status = activeTarget.id !== null
              ? (solvedToday >= activeTarget.daily_target ? 'COMPLETED' : 'NOT_COMPLETED')
              : 'COMPLETED';

            await pool.query(`
              INSERT INTO leetcode_daily_progress (user_id, date, total_solved, solved_today, solved_yesterday, daily_target, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (user_id, date) DO UPDATE
              SET total_solved = EXCLUDED.total_solved,
                  solved_today = EXCLUDED.solved_today,
                  solved_yesterday = EXCLUDED.solved_yesterday,
                  daily_target = EXCLUDED.daily_target,
                  status = EXCLUDED.status,
                  updated_at = CURRENT_TIMESTAMP
            `, [userId, todayStr, fetchedCount, solvedToday, solvedYesterday, activeTarget.daily_target, status]);
          }
        }));
      }
      return { success: true, synced, failed };

    } catch (err) {
      console.error('[syncLeetcodeProgressForScope] Error:', err);
      return { success: false, synced: 0, failed: 0 };
    }
  }

  // Recalculate Statuses
  async function recalculateProgressStatuses(startDateStr: string, endDateStr: string, scope: { userId?: string; classId?: string; year?: number; departmentId?: string }) {
    try {
      let query = `
        SELECT u.id, u.class_id, u.department_id, c.year
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'STUDENT'
      `;
      const params: any[] = [];
      if (scope.userId) {
        params.push(scope.userId);
        query += ` AND u.id = $${params.length}`;
      } else if (scope.classId) {
        params.push(scope.classId);
        query += ` AND u.class_id = $${params.length}`;
      } else if (scope.year) {
        params.push(scope.year);
        query += ` AND c.year = $${params.length}`;
        if (scope.departmentId) {
          params.push(scope.departmentId);
          query += ` AND u.department_id = $${params.length}`;
        }
      } else if (scope.departmentId) {
        params.push(scope.departmentId);
        query += ` AND u.department_id = $${params.length}`;
      }

      const students = await pool.query(query, params);
      if (students.rows.length === 0) return;

      const studentIds = students.rows.map(s => s.id);
      
      // Bulk fetch all progress records in this range
      const progressRes = await pool.query(
        'SELECT id, user_id, date, solved_today, total_solved FROM leetcode_daily_progress WHERE user_id = ANY($1) AND date >= $2 AND date <= $3',
        [studentIds, startDateStr, endDateStr]
      );

      // If no progress logs exist at all for the dates, there is nothing to update!
      if (progressRes.rows.length === 0) return;

      const progressMap = new Map();
      for (const row of progressRes.rows) {
        const dateKey = typeof row.date === 'string'
          ? row.date.split('T')[0]
          : new Date(row.date).toISOString().split('T')[0];
        progressMap.set(`${row.user_id}_${dateKey}`, row);
      }

      const startParts = startDateStr.split('-');
      const endParts = endDateStr.split('-');
      const start = new Date(Date.UTC(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2])));
      const end = new Date(Date.UTC(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2])));

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        for (const student of students.rows) {
          const key = `${student.id}_${dateStr}`;
          const progressRow = progressMap.get(key);
          if (progressRow) {
            const activeTarget = await getActiveTargetForStudent(pool, student.id, student.class_id, student.year, student.department_id, dateStr);
            const solvedToday = Number(progressRow.solved_today);
            let status = 'COMPLETED';
            if (progressRow.total_solved === null) {
              status = 'DATA_UNAVAILABLE';
            } else if (activeTarget.id !== null) {
              status = solvedToday >= activeTarget.daily_target ? 'COMPLETED' : 'NOT_COMPLETED';
            }
            await pool.query(
              'UPDATE leetcode_daily_progress SET daily_target = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [activeTarget.daily_target, status, progressRow.id]
            );
          }
        }
      }
    } catch (err) {
      console.error('[recalculateProgressStatuses] Error:', err);
    }
  }

  // Authorization Middlware
  const authorizeTargetManagement = (req: any, res: Response, next: NextFunction) => {
    const role = req.user.role;
    const isCoordinator = req.user.is_coordinator;
    const isYearCoordinator = req.user.is_year_coordinator;
    if (role === 'SUPREME_ADMIN' || role === 'HOD' || role === 'CLASS_ADVISOR' || (role === 'STUDENT' && (isCoordinator || isYearCoordinator))) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: You do not have permissions to manage LeetCode targets' });
  };

  function enforceUserScopeFilter(user: any, filter: any) {
    const role = user.role;
    const isCoordinator = user.is_coordinator;
    const isYearCoordinator = user.is_year_coordinator;
    const scope: { departmentId?: string; classId?: string; year?: number; batch?: string } = {};

    if (role === 'CLASS_ADVISOR' || isCoordinator || (role === 'STUDENT' && isCoordinator)) {
      scope.classId = user.class_id;
      scope.departmentId = user.department_id;
    } else if (isYearCoordinator || (role === 'STUDENT' && isYearCoordinator)) {
      scope.year = user.year_scope || user.year;
      scope.departmentId = user.department_id;
      if (filter.classId && filter.classId !== 'ALL' && filter.classId !== '') scope.classId = filter.classId;
    } else if (role === 'HOD') {
      scope.departmentId = user.department_id;
      if (filter.classId && filter.classId !== 'ALL' && filter.classId !== '') scope.classId = filter.classId;
      if (filter.year && filter.year !== 'ALL' && filter.year !== '' && !isNaN(parseInt(filter.year, 10))) scope.year = parseInt(filter.year, 10);
      if (filter.batch && filter.batch !== 'ALL' && filter.batch !== '') scope.batch = filter.batch;
    } else if (role === 'SUPREME_ADMIN' || role === 'ADMIN') {
      const deptId = filter.departmentId || filter.department_id || filter.deptId;
      if (deptId && deptId !== 'ALL' && deptId !== '' && deptId !== 'undefined' && deptId !== 'null') scope.departmentId = deptId;
      const classId = filter.classId || filter.class_id;
      if (classId && classId !== 'ALL' && classId !== '' && classId !== 'undefined' && classId !== 'null') scope.classId = classId;
      if (filter.year && filter.year !== 'ALL' && filter.year !== '' && !isNaN(parseInt(filter.year, 10))) scope.year = parseInt(filter.year, 10);
      if (filter.batch && filter.batch !== 'ALL' && filter.batch !== '') scope.batch = filter.batch;
    }
    return scope;
  }

  // 1. Fetch Target Configurations
  app.get('/api/leetcode/targets', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    let query = `
      SELECT t.*, 
        u.full_name as student_name, 
        c.name as class_name, 
        d.name as department_name,
        creator.full_name as creator_name
      FROM leetcode_targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (scope.classId) {
      params.push(scope.classId);
      query += ` AND (t.class_id = $${params.length} OR t.user_id IN (SELECT id FROM users WHERE class_id = $${params.length}) OR t.year = (SELECT year FROM classes WHERE id = $${params.length}) OR (t.department_id = (SELECT department_id FROM classes WHERE id = $${params.length}) AND t.class_id IS NULL AND t.year IS NULL AND t.user_id IS NULL))`;
    } else if (scope.year) {
      params.push(scope.year);
      query += ` AND (t.year = $${params.length} OR t.class_id IN (SELECT id FROM classes WHERE year = $${params.length}))`;
    } else if (scope.departmentId) {
      params.push(scope.departmentId);
      query += ` AND (t.department_id = $${params.length} OR t.department_id IS NULL)`;
    }
    query += ` ORDER BY t.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  }));

  // 2. Create Target Configuration
  app.post('/api/leetcode/targets', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const { dailyTarget, weeklyTarget, startDate, endDate, scopeType, targetValue } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and End date are required' });
    }
    const daily = parseInt(dailyTarget, 10) || 0;
    const weekly = parseInt(weeklyTarget, 10) || 0;
    const creatorId = req.user.id;

    let userId: string | null = null;
    let classId: string | null = null;
    let year: number | null = null;
    let departmentId: string | null = req.user.department_id || null;

    if (scopeType === 'STUDENT') {
      userId = targetValue;
      const stdRes = await pool.query('SELECT class_id, department_id FROM users WHERE id = $1', [userId]);
      if (stdRes.rows[0]) {
        classId = stdRes.rows[0].class_id;
        departmentId = stdRes.rows[0].department_id;
      }
    } else if (scopeType === 'CLASS') {
      classId = targetValue;
      const classRes = await pool.query('SELECT department_id FROM classes WHERE id = $1', [classId]);
      if (classRes.rows[0]) {
        departmentId = classRes.rows[0].department_id;
      }
    } else if (scopeType === 'YEAR') {
      year = parseInt(targetValue, 10);
    } else if (scopeType === 'DEPARTMENT') {
      departmentId = targetValue;
    }

    // Boundary check
    if (req.user.role === 'CLASS_ADVISOR' || (req.user.role === 'STUDENT' && req.user.is_coordinator)) {
      if (scopeType === 'STUDENT' && classId?.toString() !== req.user.class_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden: You can only set targets for students in your class' });
      }
      if (scopeType === 'CLASS' && classId?.toString() !== req.user.class_id?.toString()) {
        return res.status(403).json({ error: 'Forbidden: You can only set targets for your class section' });
      }
      if (scopeType === 'YEAR' || scopeType === 'DEPARTMENT') {
        return res.status(403).json({ error: 'Forbidden: You cannot set batch or department-wide targets' });
      }
    } else if (req.user.role === 'STUDENT' && req.user.is_year_coordinator) {
      if (scopeType === 'YEAR' && year !== req.user.year_scope) {
        return res.status(403).json({ error: 'Forbidden: You can only set targets for your year scope' });
      }
      if (scopeType === 'CLASS') {
        const clsRes = await pool.query('SELECT year FROM classes WHERE id = $1', [classId]);
        if (clsRes.rows[0]?.year !== req.user.year_scope) {
          return res.status(403).json({ error: 'Forbidden: You can only set targets for classes in your year' });
        }
      }
    }

    // Deduplication check: Check if a target with the exact scope and date range already exists
    const existingCheck = await pool.query(`
      SELECT id FROM leetcode_targets 
      WHERE start_date = $1 AND end_date = $2 
        AND ((user_id IS NULL AND $3::uuid IS NULL) OR user_id = $3)
        AND ((class_id IS NULL AND $4::uuid IS NULL) OR class_id = $4)
        AND ((year IS NULL AND $5::int IS NULL) OR year = $5)
        AND ((department_id IS NULL AND $6::uuid IS NULL) OR department_id = $6)
      LIMIT 1
    `, [startDate, endDate, userId, classId, year, departmentId]);

    let targetId: string;
    if (existingCheck.rowCount > 0) {
      targetId = existingCheck.rows[0].id;
      await pool.query(`
        UPDATE leetcode_targets 
        SET daily_target = $1, weekly_target = $2, created_by = $3, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $4
      `, [daily, weekly, creatorId, targetId]);
    } else {
      const insertRes = await pool.query(`
        INSERT INTO leetcode_targets (daily_target, weekly_target, start_date, end_date, user_id, class_id, year, department_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [daily, weekly, startDate, endDate, userId, classId, year, departmentId, creatorId]);
      targetId = insertRes.rows[0].id;
    }

    recalculateProgressStatuses(startDate, endDate, { userId: userId || undefined, classId: classId || undefined, year: year || undefined, departmentId: departmentId || undefined }).catch(err => console.error(err));
    res.json({ success: true, targetId });
  }));

  // 3. Delete Target Configuration
  app.delete('/api/leetcode/targets/:id', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const targetId = req.params.id;
    const targetDetails = await pool.query('SELECT * FROM leetcode_targets WHERE id = $1', [targetId]);
    if (targetDetails.rowCount === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    const t = targetDetails.rows[0];

    if (req.user.role === 'CLASS_ADVISOR' || (req.user.role === 'STUDENT' && req.user.is_coordinator)) {
      if (t.class_id?.toString() !== req.user.class_id?.toString() && t.user_id === null) {
        return res.status(403).json({ error: 'Forbidden: You cannot delete this target' });
      }
    }

    await pool.query('DELETE FROM leetcode_targets WHERE id = $1', [targetId]);
    recalculateProgressStatuses(
      new Date(t.start_date).toISOString().split('T')[0],
      new Date(t.end_date).toISOString().split('T')[0],
      { userId: t.user_id || undefined, classId: t.class_id || undefined, year: t.year || undefined, departmentId: t.department_id || undefined }
    ).catch(err => console.error(err));
    res.json({ success: true });
  }));

  // 4. Trigger Progress Sync
  app.post('/api/leetcode/sync', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.body);
    const syncResult = await syncLeetcodeProgressForScope(scope);
    res.json(syncResult);
  }));

  // Helper to enrich student progress in batch (3 DB queries total for N students!)
  async function enrichStudentProgressBatch(students: any[], dateStr: string) {
    if (!students || students.length === 0) return [];

    const week = getWeekRange(dateStr);
    const studentIds = students.map(s => s.id);

    // 1. Fetch all active targets for dateStr
    const targetsRes = await pool.query(`
      SELECT * FROM leetcode_targets 
      WHERE start_date <= $1 AND end_date >= $1
      ORDER BY 
        CASE 
          WHEN user_id IS NOT NULL THEN 1
          WHEN class_id IS NOT NULL THEN 2
          WHEN year IS NOT NULL THEN 3
          WHEN department_id IS NOT NULL THEN 4
          ELSE 5
        END ASC,
        created_at DESC
    `, [dateStr]);
    const activeTargets = targetsRes.rows;

    // 2. Fetch daily progress logs for dateStr
    const dailyRes = await pool.query(`
      SELECT user_id, solved_today, solved_yesterday, status, total_solved 
      FROM leetcode_daily_progress 
      WHERE user_id = ANY($1) AND date = $2
    `, [studentIds, dateStr]);

    const dailyMap = new Map<string, any>();
    for (const row of dailyRes.rows) {
      dailyMap.set(row.user_id, row);
    }

    // 3. Fetch weekly aggregate progress logs
    const weeklyRes = await pool.query(`
      SELECT user_id, SUM(solved_today) as solved_week, COUNT(total_solved) as syncs_count 
      FROM leetcode_daily_progress 
      WHERE user_id = ANY($1) AND date >= $2 AND date <= $3
      GROUP BY user_id
    `, [studentIds, week.start, week.end]);

    const weeklyMap = new Map<string, any>();
    for (const row of weeklyRes.rows) {
      weeklyMap.set(row.user_id, row);
    }

    // 4. Enrich all students in-memory
    return students.map(student => {
      const activeTarget = resolveTargetInMemory(student, activeTargets);
      const studentDir = constantStudentByIdMap.get(student.id);
      const leetcodeUrl = studentDir?.leetcode || '';

      const dailyRow = dailyMap.get(student.id);
      const solvedToday = dailyRow?.total_solved !== null && dailyRow?.total_solved !== undefined
        ? Number(dailyRow.solved_today)
        : 0;

      const solvedYesterday = dailyRow?.total_solved !== null && dailyRow?.total_solved !== undefined
        ? Number(dailyRow.solved_yesterday)
        : 0;

      let dailyStatus = 'NO_TARGET';
      if (activeTarget.id !== null) {
        dailyStatus = dailyRow?.status || (solvedToday >= activeTarget.daily_target ? 'COMPLETED' : 'NOT_COMPLETED');
      }

      const remainingDaily = activeTarget.id !== null
        ? Math.max(0, activeTarget.daily_target - solvedToday)
        : 0;

      const completionDailyPct = activeTarget.daily_target > 0
        ? Math.round((solvedToday / activeTarget.daily_target) * 100)
        : 0;

      const weeklyRow = weeklyMap.get(student.id);
      const solvedThisWeek = Number(weeklyRow?.solved_week) || 0;
      const syncsCount = Number(weeklyRow?.syncs_count) || 0;

      let weeklyStatus = 'NO_TARGET';
      if (activeTarget.id !== null) {
        if (solvedThisWeek >= activeTarget.weekly_target) {
          weeklyStatus = 'COMPLETED';
        } else if (syncsCount === 0) {
          weeklyStatus = 'DATA_UNAVAILABLE';
        } else {
          weeklyStatus = 'NOT_COMPLETED';
        }
      }

      const remainingWeekly = activeTarget.id !== null
        ? Math.max(0, activeTarget.weekly_target - solvedThisWeek)
        : 0;

      const completionWeeklyPct = activeTarget.weekly_target > 0
        ? Math.round((solvedThisWeek / activeTarget.weekly_target) * 100)
        : 0;

      return {
        studentId: student.id,
        registerNumber: student.register_number,
        fullName: student.full_name,
        className: student.class_name || 'Unassigned',
        leetcodeUsername: extractLeetCodeUsername(leetcodeUrl),
        leetcodeUrl: leetcodeUrl,
        dailyTarget: activeTarget.daily_target,
        solvedToday,
        solvedYesterday,
        remainingDaily,
        completionDailyPct,
        dailyStatus,
        weeklyTarget: activeTarget.weekly_target,
        solvedThisWeek,
        remainingWeekly,
        completionWeeklyPct,
        weeklyStatus
      };
    });
  }

  // 5. Dashboard Summary Stats
  app.get('/api/leetcode/stats', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    const totalStudents = studentRows.length;
    let metDaily = 0;
    let inProgressDaily = 0;
    let dailyCompleted = 0;
    let dailyNotCompleted = 0;
    let weeklyCompleted = 0;
    let weeklyNotCompleted = 0;

    for (const item of enrichedList) {
      if (item.dailyStatus === 'COMPLETED') {
        metDaily++;
        dailyCompleted++;
      } else if (item.dailyStatus === 'NOT_COMPLETED' || item.dailyStatus === 'DATA_UNAVAILABLE') {
        if (item.solvedToday > 0) inProgressDaily++;
        dailyNotCompleted++;
      }
      if (item.weeklyStatus === 'COMPLETED') weeklyCompleted++;
      else if (item.weeklyStatus === 'NOT_COMPLETED') weeklyNotCompleted++;
    }

    const completionDailyRate = totalStudents > 0 ? Math.round((metDaily / totalStudents) * 100) : 0;

    res.json({
      totalStudents,
      metDaily,
      inProgressDaily,
      completionDailyRate,
      studentsAssigned: totalStudents,
      dailyCompleted,
      dailyNotCompleted,
      weeklyCompleted,
      weeklyNotCompleted
    });
  }));

  // Optimized in-memory student lookup helper (uses RAM map when available, falls back to DB)
  async function fetchStudentsForScope(scope: { classId?: string; year?: number; departmentId?: string; batch?: string }) {
    let rawStudents: any[] = [];
    if (scope.classId && constantStudentsByClassMap.has(scope.classId.toString())) {
      const cached = constantStudentsByClassMap.get(scope.classId.toString())!;
      rawStudents = cached.map(s => ({
        id: s.id,
        register_number: s.register_number,
        full_name: s.full_name,
        class_id: s.class_id,
        department_id: s.department_id,
        year: s.year,
        batch: s.batch,
        class_name: s.class_name
      }));
    } else {
      let baseQuery = `
        SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.batch, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'STUDENT'
      `;
      const params: any[] = [];
      if (scope.classId) {
        params.push(scope.classId);
        baseQuery += ` AND u.class_id = $${params.length}`;
      }
      if (scope.year) {
        params.push(scope.year);
        baseQuery += ` AND c.year = $${params.length}`;
      }
      if (scope.batch) {
        params.push(scope.batch);
        baseQuery += ` AND c.batch = $${params.length}`;
      }
      if (scope.departmentId) {
        params.push(scope.departmentId);
        baseQuery += ` AND u.department_id = $${params.length}`;
      }
      baseQuery += ` ORDER BY u.register_number ASC, u.full_name ASC`;

      const students = await pool.query(baseQuery, params);
      rawStudents = students.rows;
    }

    // Defensive Deduplication by Student ID
    const seen = new Set<string>();
    const uniqueStudents: any[] = [];
    for (const s of rawStudents) {
      const key = String(s.id || s.register_number);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueStudents.push(s);
      }
    }
    return uniqueStudents;
  }

  // 6. Daily Monitoring Progress
  app.get('/api/leetcode/progress/daily', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;

      if (statusFilter !== 'ALL') {
        const rowStatus = row.dailyStatus.replace('_', ' ').toUpperCase();
        const filterUpper = statusFilter.replace('_', ' ').toUpperCase();
        return rowStatus === filterUpper;
      }
      return true;
    });

    res.json(filtered);
  }));

  // 7. Weekly Monitoring Progress
  app.get('/api/leetcode/progress/weekly', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;

      if (statusFilter !== 'ALL') {
        const rowStatus = row.weeklyStatus.replace('_', ' ').toUpperCase();
        const filterUpper = statusFilter.replace('_', ' ').toUpperCase();
        return rowStatus === filterUpper;
      }
      return true;
    });

    res.json(filtered);
  }));

  // 8. Student Personal Progress Card Details
  app.get('/api/leetcode/progress/my', authenticate, asyncHandler(async (req: any, res: Response) => {
    const studentId = req.user.id;
    const dateStr = getISTDateStr();
    const stdRes = await pool.query(`
      SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1 LIMIT 1
    `, [studentId]);

    if (stdRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const enriched = (await enrichStudentProgressBatch([stdRes.rows[0]], dateStr))[0];
    res.json(enriched);
  }));

  // 9. Specific Student Progress History & Modal Details
  app.get('/api/leetcode/progress/student/:studentId', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { studentId } = req.params;
    const dateStr = getISTDateStr();

    const stdRes = await pool.query(`
      SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.name as class_name
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1 LIMIT 1
    `, [studentId]);

    if (stdRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = stdRes.rows[0];
    const enriched = (await enrichStudentProgressBatch([student], dateStr))[0];

    const dailyHistory = await pool.query(`
      SELECT date, solved_today, daily_target, status
      FROM leetcode_daily_progress
      WHERE user_id = $1 AND total_solved IS NOT NULL
      ORDER BY date DESC LIMIT 30
    `, [studentId]);

    const weeklyHistoryQuery = `
      SELECT 
        DATE_TRUNC('week', date) as week_start,
        SUM(solved_today) as solved_week,
        MAX(daily_target) * 5 as weekly_target_estimated
      FROM leetcode_daily_progress
      WHERE user_id = $1 AND total_solved IS NOT NULL
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start DESC LIMIT 4
    `;
    const weeklyHistoryRes = await pool.query(weeklyHistoryQuery, [studentId]);

    const dailyPoints = dailyHistory.rows.map(r => ({
      date: new Date(r.date).toISOString().split('T')[0],
      actual: Number(r.solved_today),
      target: Number(r.daily_target)
    })).reverse();

    const weeklyPoints: any[] = [];
    const activeTarget = await getActiveTargetForStudent(pool, student.id, student.class_id, student.year ? Number(student.year) : null, student.department_id, dateStr);
    
    const baseISTDateStr = getISTDateStr();
    for (let k = 0; k < 4; k++) {
      const parts = baseISTDateStr.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const offsetDate = new Date(Date.UTC(y, m, d));
      offsetDate.setUTCDate(offsetDate.getUTCDate() - k * 7);
      const week = getWeekRange(offsetDate.toISOString().split('T')[0]);
      
      const dataRes = await pool.query(`
        SELECT SUM(solved_today) as actual_total, MAX(daily_target) * 5 as target_total
        FROM leetcode_daily_progress
        WHERE user_id = $1 AND date >= $2 AND date <= $3 AND total_solved IS NOT NULL
      `, [studentId, week.start, week.end]);

      weeklyPoints.push({
        week: `Week ${4-k}`,
        start: week.start,
        end: week.end,
        actual: Number(dataRes.rows[0]?.actual_total) || 0,
        target: Number(dataRes.rows[0]?.target_total) || 0
      });
    }

    res.json({ daily: dailyPoints, weekly: weeklyPoints });
  }));

  // ─── LeetCode Excel Exports ─────────────────────────────────────────────────

  // 1. Daily Excel Report
  app.get('/api/leetcode/export/daily', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL') {
        const rowStatus = row.dailyStatus.replace('_', ' ').toUpperCase();
        const filterUpper = statusFilter.replace('_', ' ').toUpperCase();
        return rowStatus === filterUpper;
      }
      return true;
    });

    const excelData = filtered.map(row => ({
      'Register No': row.registerNumber,
      'Student Name': row.fullName,
      'Section': row.className,
      'LeetCode Profile': row.leetcodeUrl,
      'Daily Target': row.dailyTarget,
      'Solved Today': row.solvedToday,
      'Remaining': row.remainingDaily,
      'Completion %': `${row.completionDailyPct}%`,
      'Status': row.dailyStatus.replace('_', ' ')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Auto-size columns
    const colWidths = Object.keys(excelData[0] || {}).map(key => {
      let maxLen = key.length;
      for (const row of excelData) {
        const val = (row as any)[key];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: maxLen + 3 };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Daily LeetCode Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Daily_Report_${dateStr}.xlsx`);
    res.send(buf);
  }));

  // 2. Weekly Excel Report
  app.get('/api/leetcode/export/weekly', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';
    const week = getWeekRange(dateStr);

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL') {
        const rowStatus = row.weeklyStatus.replace('_', ' ').toUpperCase();
        const filterUpper = statusFilter.replace('_', ' ').toUpperCase();
        return rowStatus === filterUpper;
      }
      return true;
    });

    const excelData = filtered.map(row => ({
      'Register No': row.registerNumber,
      'Student Name': row.fullName,
      'Section': row.className,
      'Weekly Target': row.weeklyTarget,
      'Solved This Week': row.solvedThisWeek,
      'Remaining': row.remainingWeekly,
      'Completion %': `${row.completionWeeklyPct}%`,
      'Status': row.weeklyStatus.replace('_', ' ')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = Object.keys(excelData[0] || {}).map(key => {
      let maxLen = key.length;
      for (const row of excelData) {
        const val = (row as any)[key];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: maxLen + 3 };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Weekly LeetCode Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Weekly_Report_${week.start}_to_${week.end}.xlsx`);
    res.send(buf);
  }));

  // 3. Weekly Detailed Excel Report (Sunday -> Saturday breakdown)
  app.get('/api/leetcode/export/weekly-detailed', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';
    const week = getWeekRange(dateStr);

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      return row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
    });

    const weekProgressRes = await pool.query(
      'SELECT user_id, date, solved_today FROM leetcode_daily_progress WHERE user_id = ANY($1) AND date >= $2 AND date <= $3',
      [studentRows.map(s => s.id), week.start, week.end]
    );
    const dayMap = new Map();
    for (const r of weekProgressRes.rows) {
      const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      dayMap.set(`${r.user_id}_${dStr}`, Number(r.solved_today) || 0);
    }

    const getUTCDayStr = (startStr: string, offsetDays: number): string => {
      const parts = startStr.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const date = new Date(Date.UTC(y, m, d));
      date.setUTCDate(date.getUTCDate() + offsetDays);
      return date.toISOString().split('T')[0];
    };

    const detailedList = filtered.map(row => {
      const studentId = row.studentId;
      const sun = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 0)}`) || 0;
      const mon = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 1)}`) || 0;
      const tue = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 2)}`) || 0;
      const wed = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 3)}`) || 0;
      const thu = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 4)}`) || 0;
      const fri = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 5)}`) || 0;
      const sat = dayMap.get(`${studentId}_${getUTCDayStr(week.start, 6)}`) || 0;

      return {
        'Register No': row.registerNumber,
        'Student Name': row.fullName,
        'Section': row.className,
        'Day 1': sun,
        'Day 2': mon,
        'Day 3': tue,
        'Day 4': wed,
        'Day 5': thu,
        'Day 6': fri,
        'Day 7': sat,
        'Weekly Solved': row.solvedThisWeek,
        'Weekly Target': row.weeklyTarget,
        'Completion %': `${row.completionWeeklyPct}%`,
        'Status': row.weeklyStatus.replace('_', ' ')
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(detailedList);
    
    const colWidths = Object.keys(detailedList[0] || {}).map(key => {
      let maxLen = key.length;
      for (const row of detailedList) {
        const val = (row as any)[key];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: maxLen + 3 };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Detailed Weekly Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Weekly_Detailed_${week.start}_to_${week.end}.xlsx`);
    res.send(buf);
  }));

  // 4. Incomplete Students Excel Report
  app.get('/api/leetcode/export/incomplete', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);

    let filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;
      return row.dailyStatus === 'NOT_COMPLETED' || row.weeklyStatus === 'NOT_COMPLETED';
    });

    const excelData = filtered.map(row => ({
      'Register No': row.registerNumber,
      'Student Name': row.fullName,
      'Section': row.className,
      'Daily Target': row.dailyTarget,
      'Solved Today': row.solvedToday,
      'Daily Status': row.dailyStatus.replace('_', ' '),
      'Weekly Target': row.weeklyTarget,
      'Solved This Week': row.solvedThisWeek,
      'Weekly Status': row.weeklyStatus.replace('_', ' ')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = Object.keys(excelData[0] || {}).map(key => {
      let maxLen = key.length;
      for (const row of excelData) {
        const val = (row as any)[key];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: maxLen + 3 };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Defaulters Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Defaulters_${dateStr}.xlsx`);
    res.send(buf);
  }));

  // Daily LeetCode Sync Daemon at 8:00 AM IST and 11:50 PM IST
  function scheduleDailySync() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    
    // Target 1: 8:00 AM IST today
    const target8AM = new Date(nowIST);
    target8AM.setUTCHours(8, 0, 0, 0);
    
    // Target 2: 11:50 PM IST today
    const target1150PM = new Date(nowIST);
    target1150PM.setUTCHours(23, 50, 0, 0);
    
    // Determine the next target time
    let nextTarget: Date;
    if (nowIST.getTime() < target8AM.getTime()) {
      nextTarget = target8AM;
    } else if (nowIST.getTime() < target1150PM.getTime()) {
      nextTarget = target1150PM;
    } else {
      // After 11:50 PM, the next target is 8:00 AM tomorrow
      const tomorrow = new Date(nowIST.getTime() + 24 * 60 * 60 * 1000);
      tomorrow.setUTCHours(8, 0, 0, 0);
      nextTarget = tomorrow;
    }
    
    const timeUntilSync = nextTarget.getTime() - nowIST.getTime();
    const targetTimeStr = `${nextTarget.getUTCHours().toString().padStart(2, '0')}:${nextTarget.getUTCMinutes().toString().padStart(2, '0')}`;
    console.log(`[LeetCode Sync Daemon] Scheduled next sync at ${targetTimeStr} IST (in ${Math.round(timeUntilSync / 1000 / 60)} minutes).`);
    
    setTimeout(async () => {
      console.log(`[LeetCode Sync Daemon] Running scheduled sync...`);
      try {
        await syncLeetcodeProgressForScope();
        console.log('[LeetCode Sync Daemon] Sync completed.');
      } catch (err) {
        console.error('[LeetCode Sync Daemon] Scheduled sync failed:', err);
      }
      scheduleDailySync();
    }, timeUntilSync);
  }

  // Trigger startup sync & start daemon scheduler
  syncLeetcodeProgressForScope().catch(err => console.error('[LeetCode Sync] Startup sync error:', err));
  scheduleDailySync();

  // ── GitHub Targets & Progress API Module ─────────────────────────────────────

  // Utility: Extract GitHub username from profile URL or raw username
  function extractGitHubUsername(urlOrUsername: string): string {
    if (!urlOrUsername || !urlOrUsername.trim()) return '';
    const clean = urlOrUsername.trim().replace(/\/$/, '');
    const match = clean.match(/github\.com\/([^/?#]+)/);
    return match && match[1] ? match[1] : clean;
  }

  // Utility: Fetch GitHub stats (commits today + total public repos)
  async function fetchGitHubStats(usernameOrUrl: string, dateStr: string): Promise<{ totalRepos: number; commitsToday: number } | null> {
    const username = extractGitHubUsername(usernameOrUrl);
    if (!username) return null;

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('[GitHub] GITHUB_TOKEN not set — GitHub tracking disabled');
      return null;
    }

    const query = `
      query($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          repositories(privacy: PUBLIC, first: 1, ownerAffiliations: OWNER) {
            totalCount
          }
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const fromISO = `${dateStr}T00:00:00Z`;
    const toISO = `${dateStr}T23:59:59Z`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'IT-TaskManager-CodingTracker/1.0',
          },
          body: JSON.stringify({ query, variables: { username, from: fromISO, to: toISO } }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            console.error(`[GitHub] Auth error for ${username}: ${response.status}`);
            return null;
          }
          if (response.status === 429 && attempt < 3) {
            await new Promise(res => setTimeout(res, 2000 * attempt));
            continue;
          }
          return null;
        }

        const data: any = await response.json();
        if (data.errors) {
          const notFound = data.errors.some((e: any) => e.type === 'NOT_FOUND' || e.message?.includes('Could not resolve'));
          if (notFound) return null;
          if (attempt < 3) {
            await new Promise(res => setTimeout(res, 2000));
            continue;
          }
          return null;
        }

        const user = data?.data?.user;
        if (!user) return null;

        const totalRepos = Number(user.repositories?.totalCount) || 0;

        // Sum commits on the target date
        let commitsToday = 0;
        const weeks = user.contributionsCollection?.contributionCalendar?.weeks || [];
        for (const week of weeks) {
          for (const day of (week.contributionDays || [])) {
            if (day.date === dateStr) {
              commitsToday = Number(day.contributionCount) || 0;
              break;
            }
          }
        }

        return { totalRepos, commitsToday };
      } catch (err: any) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          if (attempt < 3) { await new Promise(res => setTimeout(res, 2000)); continue; }
          return null;
        }
        if (attempt < 3) { await new Promise(res => setTimeout(res, 2000)); continue; }
        return null;
      }
    }
    return null;
  }

  // Utility: Resolve active GitHub target for a student (4-level priority)
  async function getActiveGitHubTargetForStudent(
    client: any,
    userId: string,
    classId: string | null,
    year: number | null,
    departmentId: string | null,
    dateStr: string
  ) {
    const nullTarget = { id: null, daily_commit_target: 0, weekly_commit_target: 0, daily_repo_target: 0, weekly_repo_target: 0 };
    try {
      // Level 1: Student-level
      if (userId) {
        const r = await client.query(
          `SELECT * FROM github_targets WHERE user_id = $1 AND start_date <= $2 AND end_date >= $2 ORDER BY created_at DESC LIMIT 1`,
          [userId, dateStr]
        );
        if (r.rows.length > 0) return r.rows[0];
      }
      // Level 2: Class-level
      if (classId) {
        const r = await client.query(
          `SELECT * FROM github_targets WHERE class_id = $1 AND user_id IS NULL AND start_date <= $2 AND end_date >= $2 ORDER BY created_at DESC LIMIT 1`,
          [classId, dateStr]
        );
        if (r.rows.length > 0) return r.rows[0];
      }
      // Level 3: Year-level
      if (year !== null && departmentId) {
        const r = await client.query(
          `SELECT * FROM github_targets WHERE year = $1 AND department_id = $2 AND user_id IS NULL AND class_id IS NULL AND start_date <= $3 AND end_date >= $3 ORDER BY created_at DESC LIMIT 1`,
          [year, departmentId, dateStr]
        );
        if (r.rows.length > 0) return r.rows[0];
      }
      // Level 4: Department-level
      if (departmentId) {
        const r = await client.query(
          `SELECT * FROM github_targets WHERE department_id = $1 AND user_id IS NULL AND class_id IS NULL AND year IS NULL AND start_date <= $2 AND end_date >= $2 ORDER BY created_at DESC LIMIT 1`,
          [departmentId, dateStr]
        );
        if (r.rows.length > 0) return r.rows[0];
      }
      return nullTarget;
    } catch {
      return nullTarget;
    }
  }

  // Utility: Resolve GitHub target in-memory from a pre-fetched targets list
  function resolveGitHubTargetInMemory(student: any, activeTargets: any[]) {
    const nullTarget = { id: null, daily_commit_target: 0, weekly_commit_target: 0, daily_repo_target: 0, weekly_repo_target: 0 };

    // Level 1: Student
    const studentTarget = activeTargets.find(t => t.user_id === student.id);
    if (studentTarget) return studentTarget;

    // Level 2: Class
    const classTarget = activeTargets.find(t => !t.user_id && t.class_id && t.class_id === student.class_id);
    if (classTarget) return classTarget;

    // Level 3: Year (must also match department)
    const yearTarget = activeTargets.find(t =>
      !t.user_id && !t.class_id && t.year !== null &&
      t.year === Number(student.year) && t.department_id === student.department_id
    );
    if (yearTarget) return yearTarget;

    // Level 4: Department (only if user_id, class_id, year are all null)
    const deptTarget = activeTargets.find(t =>
      !t.user_id && !t.class_id && t.year === null &&
      t.department_id === student.department_id
    );
    if (deptTarget) return deptTarget;

    return nullTarget;
  }

  // Core: Sync GitHub progress for all (or scoped) students
  async function syncGitHubProgressForScope(scopeFilter?: { departmentId?: string; classId?: string; year?: number; userId?: string }) {
    const dateStr = getISTDateStr();
    let synced = 0, failed = 0;

    try {
      let query = `
        SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'STUDENT'
      `;
      const params: any[] = [];

      if (scopeFilter?.userId) {
        params.push(scopeFilter.userId); query += ` AND u.id = $${params.length}`;
      } else if (scopeFilter?.classId) {
        params.push(scopeFilter.classId); query += ` AND u.class_id = $${params.length}`;
      } else if (scopeFilter?.year) {
        params.push(scopeFilter.year); query += ` AND c.year = $${params.length}`;
        if (scopeFilter.departmentId) { params.push(scopeFilter.departmentId); query += ` AND u.department_id = $${params.length}`; }
      } else if (scopeFilter?.departmentId) {
        params.push(scopeFilter.departmentId); query += ` AND u.department_id = $${params.length}`;
      }

      const students = (await pool.query(query, params)).rows;
      const total = students.length;
      console.log(`[GitHub Sync] Starting sync for ${total} students on ${dateStr}...`);

      // Process in batches of 10 (GitHub GraphQL rate limit: 5000 pts/hr)
      const BATCH_SIZE = 10;
      const BATCH_DELAY_MS = 500;

      for (let i = 0; i < students.length; i += BATCH_SIZE) {
        const batch = students.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (student) => {
          const studentDir = constantStudentByIdMap.get(student.id);
          const githubProfile = studentDir?.github || '';

          if (!githubProfile) {
            // No GitHub username — record as DATA_UNAVAILABLE
            await pool.query(`
              INSERT INTO github_daily_progress
                (user_id, date, github_username, commits_today, new_repos_today, total_repos, commit_status, repo_status, sync_status)
              VALUES ($1, $2, '', 0, 0, NULL, 'DATA_UNAVAILABLE', 'DATA_UNAVAILABLE', 'NO_PROFILE')
              ON CONFLICT (user_id, date) DO UPDATE
                SET sync_status = 'NO_PROFILE', commit_status = 'DATA_UNAVAILABLE', repo_status = 'DATA_UNAVAILABLE', updated_at = CURRENT_TIMESTAMP
            `, [student.id, dateStr]);
            return;
          }

          try {
            const stats = await fetchGitHubStats(githubProfile, dateStr);

            if (stats === null) {
              // Fetch failed — preserve existing data, mark FETCH_FAILED
              await pool.query(`
                INSERT INTO github_daily_progress
                  (user_id, date, github_username, commits_today, new_repos_today, total_repos, commit_status, repo_status, sync_status, error_message)
                VALUES ($1, $2, $3, 0, 0, NULL, 'FETCH_FAILED', 'FETCH_FAILED', 'ERROR', 'GitHub API fetch failed')
                ON CONFLICT (user_id, date) DO UPDATE
                  SET sync_status = 'ERROR', commit_status = CASE WHEN github_daily_progress.commit_status = 'NO_TARGET' THEN 'FETCH_FAILED' ELSE github_daily_progress.commit_status END,
                      error_message = 'GitHub API fetch failed', updated_at = CURRENT_TIMESTAMP
              `, [student.id, dateStr, extractGitHubUsername(githubProfile)]);
              failed++;
              return;
            }

            const { totalRepos, commitsToday } = stats;

            // Calculate new repos today (baseline-aware)
            const prevDayDate = new Date(dateStr + 'T00:00:00Z');
            prevDayDate.setUTCDate(prevDayDate.getUTCDate() - 1);
            const prevDateStr = prevDayDate.toISOString().split('T')[0];

            const prevRes = await pool.query(
              `SELECT total_repos FROM github_daily_progress WHERE user_id = $1 AND date = $2`,
              [student.id, prevDateStr]
            );

            // Check if there's a same-day existing record
            const todayRes = await pool.query(
              `SELECT total_repos, new_repos_today FROM github_daily_progress WHERE user_id = $1 AND date = $2`,
              [student.id, dateStr]
            );

            let newReposToday = 0;
            if (todayRes.rows.length > 0 && todayRes.rows[0].total_repos !== null) {
              // Same-day re-sync: diff from today's opening snapshot
              const baselineRepos = todayRes.rows[0].total_repos - todayRes.rows[0].new_repos_today;
              newReposToday = Math.max(0, totalRepos - baselineRepos);
            } else if (prevRes.rows.length > 0 && prevRes.rows[0].total_repos !== null) {
              // New day: diff from yesterday
              newReposToday = Math.max(0, totalRepos - Number(prevRes.rows[0].total_repos));
            } else {
              // First-ever sync — establish baseline
              newReposToday = 0;
            }

            // Resolve active target
            const activeTarget = await getActiveGitHubTargetForStudent(pool, student.id, student.class_id, student.year ? Number(student.year) : null, student.department_id, dateStr);

            const commitTarget = Number(activeTarget.daily_commit_target) || 0;
            const repoTarget = Number(activeTarget.daily_repo_target) || 0;
            const weeklyCommitTarget = Number(activeTarget.weekly_commit_target) || 0;
            const weeklyRepoTarget = Number(activeTarget.weekly_repo_target) || 0;

            let commitStatus = 'NO_TARGET';
            let repoStatus = 'NO_TARGET';

            if (activeTarget.id !== null) {
              commitStatus = commitsToday >= commitTarget ? 'COMPLETED' : 'NOT_COMPLETED';
              if (repoTarget > 0) {
                repoStatus = newReposToday >= repoTarget ? 'COMPLETED' : 'NOT_COMPLETED';
              } else {
                repoStatus = 'NO_TARGET';
              }
            }

            await pool.query(`
              INSERT INTO github_daily_progress
                (user_id, date, github_username, total_repos, new_repos_today, commits_today,
                 commit_target, repo_target, weekly_commit_target, weekly_repo_target,
                 commit_status, repo_status, sync_status, error_message)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SUCCESS', NULL)
              ON CONFLICT (user_id, date) DO UPDATE
                SET github_username = EXCLUDED.github_username,
                    total_repos = EXCLUDED.total_repos,
                    new_repos_today = EXCLUDED.new_repos_today,
                    commits_today = EXCLUDED.commits_today,
                    commit_target = EXCLUDED.commit_target,
                    repo_target = EXCLUDED.repo_target,
                    weekly_commit_target = EXCLUDED.weekly_commit_target,
                    weekly_repo_target = EXCLUDED.weekly_repo_target,
                    commit_status = EXCLUDED.commit_status,
                    repo_status = EXCLUDED.repo_status,
                    sync_status = 'SUCCESS',
                    error_message = NULL,
                    updated_at = CURRENT_TIMESTAMP
            `, [student.id, dateStr, extractGitHubUsername(githubProfile), totalRepos, newReposToday,
                commitsToday, commitTarget, repoTarget, weeklyCommitTarget, weeklyRepoTarget,
                commitStatus, repoStatus]);

            synced++;
          } catch (err: any) {
            console.error(`[GitHub Sync] Error for student ${student.register_number}:`, err.message);
            failed++;
          }
        }));

        if (i + BATCH_SIZE < students.length) {
          await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
        }
      }

      console.log(`[GitHub Sync] Completed. Synced: ${synced}, Failed: ${failed}, Total: ${total}`);
      return { synced, failed, total };
    } catch (err) {
      console.error('[syncGitHubProgressForScope] Error:', err);
      throw err;
    }
  }

  // Enrich student list with GitHub progress data (batch-optimized for 400 students)
  async function enrichStudentGitHubProgressBatch(students: any[], dateStr: string) {
    if (!students || students.length === 0) return [];

    const week = getWeekRange(dateStr);
    const studentIds = students.map(s => s.id);

    // 1. Fetch all active GitHub targets
    const targetsRes = await pool.query(`
      SELECT * FROM github_targets
      WHERE start_date <= $1 AND end_date >= $1
      ORDER BY
        CASE
          WHEN user_id IS NOT NULL THEN 1
          WHEN class_id IS NOT NULL THEN 2
          WHEN year IS NOT NULL THEN 3
          WHEN department_id IS NOT NULL THEN 4
          ELSE 5
        END ASC,
        created_at DESC
    `, [dateStr]);
    const activeTargets = targetsRes.rows;

    // 2. Fetch daily GitHub progress for all students
    const dailyRes = await pool.query(`
      SELECT user_id, github_username, total_repos, new_repos_today, commits_today,
             commit_target, repo_target, commit_status, repo_status, sync_status
      FROM github_daily_progress
      WHERE user_id = ANY($1) AND date = $2
    `, [studentIds, dateStr]);
    const dailyMap = new Map<string, any>();
    for (const row of dailyRes.rows) dailyMap.set(row.user_id, row);

    // 3. Fetch weekly GitHub aggregate
    const weeklyRes = await pool.query(`
      SELECT user_id,
             SUM(commits_today) as commits_week,
             SUM(new_repos_today) as repos_week
      FROM github_daily_progress
      WHERE user_id = ANY($1) AND date >= $2 AND date <= $3
      GROUP BY user_id
    `, [studentIds, week.start, week.end]);
    const weeklyMap = new Map<string, any>();
    for (const row of weeklyRes.rows) weeklyMap.set(row.user_id, row);

    // 4. Enrich each student
    return students.map(student => {
      const activeTarget = resolveGitHubTargetInMemory(student, activeTargets);
      const studentDir = constantStudentByIdMap.get(student.id);
      const githubUrl = studentDir?.github || '';
      const githubUsername = extractGitHubUsername(githubUrl);

      const dailyRow = dailyMap.get(student.id);
      const commitsToday = dailyRow?.sync_status === 'SUCCESS' ? Number(dailyRow.commits_today) || 0 : 0;
      const newReposToday = dailyRow?.sync_status === 'SUCCESS' ? Number(dailyRow.new_repos_today) || 0 : 0;

      let commitStatus = 'NO_TARGET';
      let repoStatus = 'NO_TARGET';
      if (dailyRow) {
        commitStatus = dailyRow.commit_status || 'NO_TARGET';
        repoStatus = dailyRow.repo_status || 'NO_TARGET';
      } else if (activeTarget.id !== null) {
        commitStatus = 'DATA_UNAVAILABLE';
        repoStatus = 'DATA_UNAVAILABLE';
      }

      const commitTarget = activeTarget.id !== null ? Number(activeTarget.daily_commit_target) || 0 : 0;
      const repoTarget = activeTarget.id !== null ? Number(activeTarget.daily_repo_target) || 0 : 0;
      const weeklyCommitTarget = activeTarget.id !== null ? Number(activeTarget.weekly_commit_target) || 0 : 0;
      const weeklyRepoTarget = activeTarget.id !== null ? Number(activeTarget.weekly_repo_target) || 0 : 0;

      const remainingCommits = commitTarget > 0 ? Math.max(0, commitTarget - commitsToday) : 0;
      const completionCommitPct = commitTarget > 0 ? Math.round((commitsToday / commitTarget) * 100) : 0;

      const weeklyRow = weeklyMap.get(student.id);
      const commitsThisWeek = Number(weeklyRow?.commits_week) || 0;
      const reposThisWeek = Number(weeklyRow?.repos_week) || 0;

      let weeklyCommitStatus = 'NO_TARGET';
      if (activeTarget.id !== null) {
        weeklyCommitStatus = commitsThisWeek >= weeklyCommitTarget ? 'COMPLETED' : 'NOT_COMPLETED';
      }

      const remainingWeeklyCommits = weeklyCommitTarget > 0 ? Math.max(0, weeklyCommitTarget - commitsThisWeek) : 0;
      const completionWeeklyCommitPct = weeklyCommitTarget > 0 ? Math.round((commitsThisWeek / weeklyCommitTarget) * 100) : 0;

      return {
        studentId: student.id,
        registerNumber: student.register_number,
        fullName: student.full_name,
        className: student.class_name || student.class_id || 'Unassigned',
        githubUrl,
        githubUsername,
        commitsToday,
        newReposToday,
        commitTarget,
        repoTarget,
        weeklyCommitTarget,
        weeklyRepoTarget,
        remainingCommits,
        completionCommitPct,
        commitStatus,
        repoStatus,
        commitsThisWeek,
        reposThisWeek,
        remainingWeeklyCommits,
        completionWeeklyCommitPct,
        weeklyCommitStatus,
        syncStatus: dailyRow?.sync_status || 'NOT_SYNCED',
      };
    });
  }

  // ── GitHub REST API Routes ───────────────────────────────────────────────────

  app.get('/api/github/targets', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    let query = `
      SELECT t.*, u.full_name as student_name, c.name as class_name,
             d.name as dept_name, cb.full_name as created_by_name
      FROM github_targets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users cb ON t.created_by = cb.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (scope.classId) {
      params.push(scope.classId);
      query += ` AND (t.class_id = $${params.length} OR t.user_id IN (SELECT id FROM users WHERE class_id = $${params.length}) OR t.year = (SELECT year FROM classes WHERE id = $${params.length}) OR (t.department_id = (SELECT department_id FROM classes WHERE id = $${params.length}) AND t.class_id IS NULL AND t.year IS NULL AND t.user_id IS NULL))`;
    } else if (scope.year) {
      params.push(scope.year);
      query += ` AND (t.year = $${params.length} OR t.class_id IN (SELECT id FROM classes WHERE year = $${params.length}))`;
    } else if (scope.departmentId) {
      params.push(scope.departmentId);
      query += ` AND (t.department_id = $${params.length} OR t.department_id IS NULL)`;
    }
    query += ` ORDER BY t.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  }));

  // 2. Create / Update GitHub Target (upsert by scope+dates)
  app.post('/api/github/targets', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const { daily_commit_target, weekly_commit_target, daily_repo_target, weekly_repo_target,
            start_date, end_date, user_id, class_id, year, department_id } = req.body;

    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });

    const existingRes = await pool.query(`
      SELECT id FROM github_targets
      WHERE start_date = $1 AND end_date = $2
        AND COALESCE(user_id::text, '') = COALESCE($3::text, '')
        AND COALESCE(class_id::text, '') = COALESCE($4::text, '')
        AND COALESCE(year::text, '') = COALESCE($5::text, '')
        AND COALESCE(department_id::text, '') = COALESCE($6::text, '')
      LIMIT 1
    `, [start_date, end_date, user_id || null, class_id || null, year || null, department_id || null]);

    let target;
    if (existingRes.rows.length > 0) {
      const upd = await pool.query(`
        UPDATE github_targets SET
          daily_commit_target = $1, weekly_commit_target = $2,
          daily_repo_target = $3, weekly_repo_target = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 RETURNING *
      `, [daily_commit_target || 0, weekly_commit_target || 0, daily_repo_target || 0, weekly_repo_target || 0, existingRes.rows[0].id]);
      target = upd.rows[0];
    } else {
      const ins = await pool.query(`
        INSERT INTO github_targets
          (daily_commit_target, weekly_commit_target, daily_repo_target, weekly_repo_target,
           start_date, end_date, user_id, class_id, year, department_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [daily_commit_target || 0, weekly_commit_target || 0, daily_repo_target || 0, weekly_repo_target || 0,
          start_date, end_date, user_id || null, class_id || null, year || null, department_id || null, req.user.id]);
      target = ins.rows[0];
    }
    res.json({ success: true, target });
  }));

  // 3. Delete GitHub Target
  app.delete('/api/github/targets/:id', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const { id } = req.params;
    const chk = await pool.query('SELECT id FROM github_targets WHERE id = $1', [id]);
    if (chk.rowCount === 0) return res.status(404).json({ error: 'Target not found' });
    await pool.query('DELETE FROM github_targets WHERE id = $1', [id]);
    res.json({ success: true });
  }));

  // 4. Manual GitHub Sync Trigger
  app.post('/api/github/sync', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const { departmentId, classId, year, userId } = req.body || {};
    const scope = enforceUserScopeFilter(req.user, { departmentId, classId, year, userId });
    res.json({ message: 'GitHub sync started in background' });
    syncGitHubProgressForScope(scope).catch(err => console.error('[GitHub Sync] Manual sync error:', err));
  }));

  app.get('/api/github/stats', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);

    const week = getWeekRange(dateStr);
    const weeklyAgg = await pool.query(`
      SELECT SUM(commits_today) as total_commits, SUM(new_repos_today) as total_repos
      FROM github_daily_progress
      WHERE user_id = ANY($1) AND date >= $2 AND date <= $3
    `, [studentRows.map(s => s.id), week.start, week.end]);

    const totalStudents = studentRows.length;
    let metDaily = 0;
    let inProgressDaily = 0;
    let dailyCompleted = 0;
    let dailyNotCompleted = 0;
    let weeklyCompleted = 0;
    let weeklyNotCompleted = 0;
    let commitsToday = 0;
    let newReposToday = 0;

    for (const item of enrichedList) {
      commitsToday += item.commitsToday;
      newReposToday += item.newReposToday;
      if (item.commitsToday > 0) inProgressDaily++;
      if (item.commitStatus === 'COMPLETED') {
        metDaily++;
        dailyCompleted++;
      } else if (item.commitStatus === 'NOT_COMPLETED' || item.commitStatus === 'DATA_UNAVAILABLE') {
        dailyNotCompleted++;
      }
      if (item.weeklyCommitStatus === 'COMPLETED') weeklyCompleted++;
      else if (item.weeklyCommitStatus === 'NOT_COMPLETED') weeklyNotCompleted++;
    }

    const completionDailyRate = totalStudents > 0 ? Math.round((metDaily / totalStudents) * 100) : 0;

    res.json({
      totalStudents,
      metDaily,
      inProgressDaily,
      completionDailyRate,
      commitsToday,
      commitsThisWeek: Number(weeklyAgg.rows[0]?.total_commits) || 0,
      newReposToday,
      newReposThisWeek: Number(weeklyAgg.rows[0]?.total_repos) || 0,
      dailyCompleted,
      dailyNotCompleted,
      weeklyCompleted,
      weeklyNotCompleted
    });
  }));

  // 6. GitHub Daily Progress Grid
  app.get('/api/github/progress/daily', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);

    const filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search) || row.githubUsername.toLowerCase().includes(search);
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL') return row.commitStatus.toUpperCase() === statusFilter.toUpperCase();
      return true;
    });

    res.json(filtered);
  }));

  // 7. GitHub Weekly Progress Grid
  app.get('/api/github/progress/weekly', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const statusFilter = req.query.status ? req.query.status.toString() : 'ALL';
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);

    const filtered = enrichedList.filter(row => {
      const matchSearch = row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
      if (!matchSearch) return false;
      if (statusFilter !== 'ALL') return row.weeklyCommitStatus.toUpperCase() === statusFilter.toUpperCase();
      return true;
    });

    res.json(filtered);
  }));

  // 8. Student's own GitHub progress
  app.get('/api/github/progress/my', authenticate, asyncHandler(async (req: any, res: Response) => {
    const studentId = req.user.id;
    const dateStr = getISTDateStr();
    const stdRes = await pool.query(`
      SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.name as class_name
      FROM users u LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1 LIMIT 1
    `, [studentId]);
    if (stdRes.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    const enriched = (await enrichStudentGitHubProgressBatch([stdRes.rows[0]], dateStr))[0];
    res.json(enriched);
  }));

  // 9. Specific student GitHub progress history
  app.get('/api/github/progress/student/:studentId', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { studentId } = req.params;
    const dateStr = getISTDateStr();
    const stdRes = await pool.query(`
      SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.name as class_name
      FROM users u LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1 LIMIT 1
    `, [studentId]);
    if (stdRes.rowCount === 0) return res.status(404).json({ error: 'Student not found' });

    const enriched = (await enrichStudentGitHubProgressBatch([stdRes.rows[0]], dateStr))[0];

    const history = await pool.query(`
      SELECT date, commits_today, new_repos_today, commit_target, commit_status, repo_status, sync_status
      FROM github_daily_progress
      WHERE user_id = $1
      ORDER BY date DESC LIMIT 30
    `, [studentId]);

    const dailyPoints = history.rows.map(r => ({
      date: typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0],
      commits: Number(r.commits_today),
      repos: Number(r.new_repos_today),
      target: Number(r.commit_target),
      status: r.commit_status,
    })).reverse();

    res.json({ ...enriched, history: dailyPoints });
  }));

  // ── Combined Coding Progress (LeetCode + GitHub) ─────────────────────────────

  app.get('/api/coding/progress/combined', authenticate, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    let baseQuery = `
      SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, c.year, c.batch, c.name as class_name
      FROM users u LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.role = 'STUDENT'
    `;
    const params: any[] = [];
    if (scope.classId) { params.push(scope.classId); baseQuery += ` AND u.class_id = $${params.length}`; }
    if (scope.year) { params.push(scope.year); baseQuery += ` AND c.year = $${params.length}`; }
    if (scope.departmentId) { params.push(scope.departmentId); baseQuery += ` AND u.department_id = $${params.length}`; }
    baseQuery += ` ORDER BY u.register_number ASC`;

    const students = await pool.query(baseQuery, params);

    const [lcList, ghList] = await Promise.all([
      enrichStudentProgressBatch(students.rows, dateStr),
      enrichStudentGitHubProgressBatch(students.rows, dateStr),
    ]);

    const ghMap = new Map(ghList.map(g => [g.studentId, g]));
    const combined = lcList.map(lc => {
      const gh = ghMap.get(lc.studentId) || {};
      return { ...lc, ...gh, studentId: lc.studentId };
    }).filter(row => {
      return !search || row.fullName.toLowerCase().includes(search) || row.registerNumber.toLowerCase().includes(search);
    });

    res.json(combined);
  }));

  // ── GitHub Excel Exports ─────────────────────────────────────────────────────

  // Daily GitHub Report
  app.get('/api/github/export/daily', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
    const filtered = enrichedList.filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search));

    const excelData = filtered.map(r => ({
      'Register No': r.registerNumber, 'Student Name': r.fullName, 'Section': r.className,
      'GitHub Username': r.githubUsername,
      'Commit Target': r.commitTarget, 'Commits Today': r.commitsToday,
      'Remaining': r.remainingCommits, 'Commit %': `${r.completionCommitPct}%`,
      'Commit Status': r.commitStatus.replace('_', ' '),
      'Repo Target': r.repoTarget, 'New Repos Today': r.newReposToday,
      'Repo Status': r.repoStatus.replace('_', ' '),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = Object.keys(excelData[0] || {}).map(k => { let m = k.length; for (const r of excelData) { const v = (r as any)[k]; if (v) m = Math.max(m, String(v).length); } return { wch: m + 3 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'GitHub Daily Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Daily_Report_${dateStr}.xlsx`);
    res.send(buf);
  }));

  // Weekly GitHub Report
  app.get('/api/github/export/weekly', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';
    const week = getWeekRange(dateStr);

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
    const filtered = enrichedList.filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search));

    const excelData = filtered.map(r => ({
      'Register No': r.registerNumber, 'Student Name': r.fullName, 'Section': r.className,
      'GitHub Username': r.githubUsername,
      'Weekly Commit Target': r.weeklyCommitTarget, 'Commits This Week': r.commitsThisWeek,
      'Remaining': r.remainingWeeklyCommits, 'Commit %': `${r.completionWeeklyCommitPct}%`,
      'Weekly Commit Status': r.weeklyCommitStatus.replace('_', ' '),
      'Weekly Repo Target': r.weeklyRepoTarget, 'New Repos This Week': r.reposThisWeek,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = Object.keys(excelData[0] || {}).map(k => { let m = k.length; for (const r of excelData) { const v = (r as any)[k]; if (v) m = Math.max(m, String(v).length); } return { wch: m + 3 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'GitHub Weekly Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Weekly_Report_${week.start}_to_${week.end}.xlsx`);
    res.send(buf);
  }));

  // Weekly Detailed GitHub Report (Sunday -> Saturday breakdown)
  app.get('/api/github/export/weekly-detailed', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';
    const week = getWeekRange(dateStr);

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
    const filtered = enrichedList.filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search));

    const weekProgressRes = await pool.query(
      'SELECT user_id, date, commits_today, new_repos_today FROM github_daily_progress WHERE user_id = ANY($1) AND date >= $2 AND date <= $3',
      [studentRows.map(s => s.id), week.start, week.end]
    );
    const dayMap = new Map<string, { commits: number; repos: number }>();
    for (const r of weekProgressRes.rows) {
      const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      dayMap.set(`${r.user_id}_${dStr}`, { commits: Number(r.commits_today) || 0, repos: Number(r.new_repos_today) || 0 });
    }

    const getDay = (id: string, offset: number) => {
      const parts = week.start.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const date = new Date(Date.UTC(y, m, d));
      date.setUTCDate(date.getUTCDate() + offset);
      return dayMap.get(`${id}_${date.toISOString().split('T')[0]}`) || { commits: 0, repos: 0 };
    };

    const detailedList = filtered.map(r => {
      const id = r.studentId;
      return {
        'Register No': r.registerNumber, 'Student Name': r.fullName, 'Section': r.className,
        'GitHub': r.githubUsername,
        'Day 1 Commits': getDay(id, 0).commits,
        'Day 2 Commits': getDay(id, 1).commits,
        'Day 3 Commits': getDay(id, 2).commits,
        'Day 4 Commits': getDay(id, 3).commits,
        'Day 5 Commits': getDay(id, 4).commits,
        'Day 6 Commits': getDay(id, 5).commits,
        'Day 7 Commits': getDay(id, 6).commits,
        'Total Commits': r.commitsThisWeek, 'Commit Target': r.weeklyCommitTarget,
        'Commit %': `${r.completionWeeklyCommitPct}%`, 'Status': r.weeklyCommitStatus.replace('_', ' '),
        'New Repos This Week': r.reposThisWeek,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(detailedList);
    ws['!cols'] = Object.keys(detailedList[0] || {}).map(k => { let m = k.length; for (const r of detailedList) { const v = (r as any)[k]; if (v) m = Math.max(m, String(v).length); } return { wch: m + 3 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'GitHub Detailed Weekly');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Weekly_Detailed_${week.start}_to_${week.end}.xlsx`);
    res.send(buf);
  }));

  // GitHub Defaulters Excel Report
  app.get('/api/github/export/incomplete', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';

    const studentRows = await fetchStudentsForScope(scope);
    const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
    const filtered = enrichedList.filter(r => {
      const matchSearch = !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search);
      return matchSearch && (r.commitStatus === 'NOT_COMPLETED' || r.weeklyCommitStatus === 'NOT_COMPLETED');
    });

    const excelData = filtered.map(r => ({
      'Register No': r.registerNumber, 'Student Name': r.fullName, 'Section': r.className,
      'GitHub': r.githubUsername,
      'Daily Commit Target': r.commitTarget, 'Commits Today': r.commitsToday,
      'Daily Status': r.commitStatus.replace('_', ' '),
      'Weekly Commit Target': r.weeklyCommitTarget, 'Commits This Week': r.commitsThisWeek,
      'Weekly Status': r.weeklyCommitStatus.replace('_', ' '),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = Object.keys(excelData[0] || {}).map(k => { let m = k.length; for (const r of excelData) { const v = (r as any)[k]; if (v) m = Math.max(m, String(v).length); } return { wch: m + 3 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'GitHub Defaulters');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Defaulters_${dateStr}.xlsx`);
    res.send(buf);
  }));

  // Export Excel for Coding Progress
  app.get('/api/coding/export-excel', authenticate, authorizeTargetManagement, asyncHandler(async (req: any, res: Response) => {
    const scope = enforceUserScopeFilter(req.user, req.query);
    const dateStr = req.query.date ? req.query.date.toString() : getISTDateStr();
    const search = req.query.search ? req.query.search.toString().toLowerCase() : '';
    const view = req.query.view ? req.query.view.toString() : 'LEETCODE';

    const studentRows = await fetchStudentsForScope(scope);
    const studentIds = studentRows.map(s => s.id);
    const week = getWeekRange(dateStr);
    
    // Calculate previous week range (subtract 7 days from start and end)
    const prevWeekStart = new Date(week.start + 'T00:00:00Z');
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
    const prevWeekEnd = new Date(week.end + 'T00:00:00Z');
    prevWeekEnd.setUTCDate(prevWeekEnd.getUTCDate() - 7);
    
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];
    const prevWeekEndStr = prevWeekEnd.toISOString().split('T')[0];

    let excelData: any[] = [];

    if (view === 'GITHUB_DAILY') {
      const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
      let sno = 1;
      excelData = enrichedList
        .filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search))
        .map(gh => ({
          'S.No': sno++,
          'Name': gh.fullName,
          'Reg No': gh.registerNumber,
          'GitHub ID': gh.githubUsername || '',
          'Daily Commit Target': gh.commitTarget,
          'Commits Today': gh.commitsToday,
          'Remaining': gh.remainingCommits,
          'Completion %': `${gh.completionCommitPct}%`,
          'Status': gh.commitStatus ? gh.commitStatus.replace('_', ' ') : 'NO_TARGET'
        }));
    } else if (view === 'GITHUB' || view === 'GITHUB_WEEKLY') {
      const enrichedList = await enrichStudentGitHubProgressBatch(studentRows, dateStr);
      
      const prevWeeklyRes = await pool.query(`
        SELECT user_id, SUM(commits_today) as commits_prev_week
        FROM github_daily_progress 
        WHERE user_id = ANY($1) AND date >= $2 AND date <= $3
        GROUP BY user_id
      `, [studentIds, prevWeekStartStr, prevWeekEndStr]);
      
      const prevWeeklyMap = new Map();
      for (const row of prevWeeklyRes.rows) prevWeeklyMap.set(row.user_id, Number(row.commits_prev_week) || 0);

      let sno = 1;
      excelData = enrichedList
        .filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search))
        .map(gh => ({
          'S.No': sno++,
          'Name': gh.fullName,
          'Reg No': gh.registerNumber,
          'GitHub ID': gh.githubUsername || '',
          'Previous Week Progress Count': prevWeeklyMap.get(gh.studentId) || 0,
          'This Week Progress Count': gh.commitsThisWeek || 0
        }));
    } else if (view === 'DAILY' || view === 'LEETCODE_DAILY') {
      const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);
      let sno = 1;
      excelData = enrichedList
        .filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search))
        .map(lc => ({
          'S.No': sno++,
          'Name': lc.fullName,
          'Reg No': lc.registerNumber,
          'LeetCode ID': lc.leetcodeUrl ? lc.leetcodeUrl.split('/').filter(Boolean).pop() : '',
          'Daily Target': lc.dailyTarget,
          'Solved Today': lc.solvedToday,
          'Remaining': lc.remainingDaily,
          'Completion %': `${lc.completionDailyPct}%`,
          'Status': lc.dailyStatus ? lc.dailyStatus.replace('_', ' ') : 'NO_TARGET'
        }));
    } else {
      const enrichedList = await enrichStudentProgressBatch(studentRows, dateStr);
      
      const prevWeeklyRes = await pool.query(`
        SELECT user_id, SUM(solved_today) as solved_prev_week
        FROM leetcode_daily_progress 
        WHERE user_id = ANY($1) AND date >= $2 AND date <= $3
        GROUP BY user_id
      `, [studentIds, prevWeekStartStr, prevWeekEndStr]);
      
      const prevWeeklyMap = new Map();
      for (const row of prevWeeklyRes.rows) prevWeeklyMap.set(row.user_id, Number(row.solved_prev_week) || 0);

      let sno = 1;
      excelData = enrichedList
        .filter(r => !search || r.fullName.toLowerCase().includes(search) || r.registerNumber.toLowerCase().includes(search))
        .map(lc => ({
          'S.No': sno++,
          'Name': lc.fullName,
          'Reg No': lc.registerNumber,
          'LeetCode ID': lc.leetcodeUrl ? lc.leetcodeUrl.split('/').filter(Boolean).pop() : '',
          'Previous Week Progress Count': prevWeeklyMap.get(lc.studentId) || 0,
          'This Week Progress Count': lc.solvedThisWeek || 0
        }));
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = Object.keys(excelData[0] || {}).map(k => { let m = k.length; for (const r of excelData) { const v = (r as any)[k]; if (v) m = Math.max(m, String(v).length); } return { wch: m + 3 }; });
    XLSX.utils.book_append_sheet(wb, ws, `${view} Report`);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${view}_Progress_Report_${dateStr}.xlsx`);
    res.send(buf);
  }));

  // ── GitHub Nightly Sync Daemon at 23:55 IST ──────────────────────────────────
  function scheduleGitHubDailySync() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const targetIST = new Date(nowIST);
    targetIST.setUTCHours(18, 25, 0, 0); // 23:55 IST = 18:25 UTC
    if (nowIST.getTime() >= targetIST.getTime()) {
      targetIST.setUTCDate(targetIST.getUTCDate() + 1);
    }
    const timeUntilSync = targetIST.getTime() - nowIST.getTime();
    console.log(`[GitHub Sync Daemon] Scheduled next sync in ${Math.round(timeUntilSync / 1000 / 60)} minutes.`);
    setTimeout(async () => {
      console.log('[GitHub Sync Daemon] Running scheduled daily sync...');
      try {
        const result = await syncGitHubProgressForScope();
        console.log(`[GitHub Sync Daemon] Done. Synced: ${result.synced}, Failed: ${result.failed}`);
      } catch (err) {
        console.error('[GitHub Sync Daemon] Error:', err);
      }
      scheduleGitHubDailySync();
    }, timeUntilSync);
  }

  // GitHub startup sync + schedule daemon
  if (process.env.GITHUB_TOKEN) {
    syncGitHubProgressForScope().catch(err => console.error('[GitHub Sync] Startup sync error:', err));
    scheduleGitHubDailySync();
  }

  // ── Protected Cron Webhook (Render / External Cron Support) ─────────────────
  app.post('/api/cron/sync-coding-progress', asyncHandler(async (req: Request, res: Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization || req.headers['x-cron-secret'];
      if (authHeader !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized cron request: Invalid secret key' });
      }
    }

    console.log('[Cron Webhook] Executing on-demand daily sync for LeetCode & GitHub...');
    const leetcodeRes = await syncLeetcodeProgressForScope();
    let githubRes = null;
    if (process.env.GITHUB_TOKEN) {
      githubRes = await syncGitHubProgressForScope();
    }
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      leetcode: leetcodeRes,
      github: githubRes
    });
  }));

  // ── API 404 Fallback ──────────────────────────────────────────────────────
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found` });
  });


  // ── Vite & Static Serving ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist'), {
      maxAge: '1y',
      immutable: true,
      index: false,
    }));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
  }

  // ── Global Error Handler ───────────────────────────────────────────────────
  // Must be registered AFTER all routes. Catches errors forwarded by asyncHandler
  // or any synchronous throw inside a route. Returns clean JSON instead of crashing.
  app.use((err: any, req: any, res: any, _next: NextFunction) => {
    console.error('[Unhandled Route Error]', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  let PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const startApp = (port: number) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        if (process.env.NODE_ENV === 'production') {
          console.error(`FATAL: Port ${port} is already in use.`);
          process.exit(1);
        } else {
          process.stdout.write(`\rPort ${port} in use, trying ${port + 1}...\n`);
          startApp(port + 1);
        }
      } else {
        console.error(err);
      }
    });
  };

  startApp(PORT);

  // ── Graceful Shutdown Handler for Render redeployments ────────────────────
  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] ${signal} received. Closing HTTP server and PostgreSQL pool gracefully...`);
    pool.end().then(() => {
      console.log('[Server] Database pool closed. Exiting process cleanly.');
      process.exit(0);
    }).catch((err) => {
      console.error('[Server] Error during database pool shutdown:', err);
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}

export const appPromise = startServer();
export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
