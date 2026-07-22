import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
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
    resource_type: 'auto',
  } as any,
});

const upload = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Express App ──────────────────────────────────────────────────────────────
async function startServer() {
  // Initialize PostgreSQL database schemas and tables
  await initDB();

  const app = express();

  // Enable trust proxy so express-rate-limit correctly identifies individual client IPs behind reverse proxies (Render, Cloudflare, Nginx)
  app.set('trust proxy', 1);

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
  app.use(express.json());
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

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const dbUserRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.id]);
      const dbUser = dbUserRes.rows[0];
      if (!dbUser) return res.status(401).json({ error: 'Unauthorized: User not found' });
      
      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        department_id: dbUser.department_id,
        class_id: dbUser.class_id,
        is_coordinator: Boolean(dbUser.is_coordinator),
        is_year_coordinator: Boolean(dbUser.is_year_coordinator),
        year_scope: dbUser.year_scope,
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Login accepts `email` field for HOD/Advisor accounts.
  // Students may still log in using their Registration Number (intentional).
  app.post('/api/auth/login', async (req, res) => {
    const { email, username, password } = req.body;
    // Accept either `email` (new) or `username` (legacy) field from the client
    const loginId = (email || username || '').trim();
    if (!loginId) return res.status(401).json({ error: 'Invalid credentials' });

    const userRes = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(register_number) = LOWER($1) LIMIT 1',
      [loginId]
    );
    const user = userRes.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
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
        department_id: user.department_id,
        class_id: user.class_id,
        is_coordinator: Boolean(user.is_coordinator),
        is_year_coordinator: Boolean(user.is_year_coordinator),
        year_scope: user.year_scope,
      }
    });
  });

  app.get('/api/auth/me', authenticate, async (req: any, res) => {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      department_id: user.department_id,
      class_id: user.class_id,
      is_coordinator: Boolean(user.is_coordinator),
      is_year_coordinator: Boolean(user.is_year_coordinator),
      year_scope: user.year_scope,
    });
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
    try {
      const classesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1', [deptId]);
      const classIds = classesRes.rows.map(c => c.id);

      const usersRes = await pool.query('SELECT id FROM users WHERE department_id = $1 OR class_id = ANY($2)', [deptId, classIds]);
      const userIds = usersRes.rows.map(u => u.id);

      if (userIds.length > 0) {
        const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = ANY($1)', [userIds]);
        for (const r of subsRes.rows) {
          if (r.cloudinary_public_id) {
            try {
              await cloudinary.uploader.destroy(r.cloudinary_public_id);
            } catch (err) {
              console.error('Failed to delete department submission image from Cloudinary:', err);
            }
          }
        }
        await pool.query('DELETE FROM task_submissions WHERE user_id = ANY($1)', [userIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      }
      
      await pool.query('DELETE FROM classes WHERE department_id = $1', [deptId]);

      const tasksRes = await pool.query('SELECT id FROM tasks WHERE department_id = $1', [deptId]);
      const taskIds = tasksRes.rows.map(t => t.id);
      if (taskIds.length > 0) {
        await pool.query('DELETE FROM task_classes WHERE task_id = ANY($1)', [taskIds]);
        await pool.query('DELETE FROM tasks WHERE id = ANY($1)', [taskIds]);
      }

      await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to delete department:', err);
      res.status(500).json({ error: 'Failed to delete department' });
    }
  });

  // ── Classes ───────────────────────────────────────────────────────────────
  app.get('/api/classes', authenticate, async (req: any, res) => {
    let classesRes;
    if (req.user.role === 'SUPREME_ADMIN') {
      classesRes = await pool.query(`
        SELECT c.*, d.name as department_name
        FROM classes c
        LEFT JOIN departments d ON c.department_id = d.id
        ORDER BY c.created_at ASC
      `);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
        department_name: c.department_name,
      })));
    } else if (req.user.role === 'HOD') {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 ORDER BY year ASC', [req.user.department_id]);
      return res.json(classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      })));
    } else if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 AND year = $2 ORDER BY name ASC', [req.user.department_id, req.user.year_scope]);
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
    const studentsRes = await pool.query('SELECT id FROM users WHERE class_id = $1 AND role = \'STUDENT\'', [classId]);
    const studentIds = studentsRes.rows.map(s => s.id);
    if (studentIds.length > 0) {
      try {
        const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = ANY($1)', [studentIds]);
        for (const r of subsRes.rows) {
          if (r.cloudinary_public_id) {
            try {
              await cloudinary.uploader.destroy(r.cloudinary_public_id);
            } catch (err) {
              console.error('Failed to delete student submission image from Cloudinary:', err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to retrieve class student submissions for Cloudinary cleanup:', err);
      }
      await pool.query('DELETE FROM task_submissions WHERE user_id = ANY($1)', [studentIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [studentIds]);
    }
    await pool.query(
      'UPDATE users SET class_id = NULL, is_year_coordinator = FALSE, year_scope = NULL, updated_at = NOW() WHERE class_id = $1 AND role = \'CLASS_ADVISOR\'',
      [classId]
    );
    await pool.query('DELETE FROM task_classes WHERE class_id = $1', [classId]);
    await pool.query('DELETE FROM classes WHERE id = $1', [classId]);
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
        SELECT u.*, d.name as department_name, c.name as class_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role != 'SUPREME_ADMIN'
        ORDER BY u.role ASC, u.register_number ASC NULLS LAST, u.full_name ASC
      `);
    } else if (req.user.role === 'HOD') {
      usersRes = await pool.query(`
        SELECT u.*, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.department_id = $1 AND u.role != 'SUPREME_ADMIN'
        ORDER BY u.role ASC, u.register_number ASC NULLS LAST, u.full_name ASC
      `, [req.user.department_id]);
    } else if (req.user.role === 'CLASS_ADVISOR' || (req.user.role === 'STUDENT' && req.user.is_coordinator)) {
      usersRes = await pool.query(`
        SELECT u.*, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.class_id = $1 AND u.role = 'STUDENT'
        ORDER BY u.register_number ASC, u.full_name ASC
      `, [req.user.class_id]);
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

    const finalPassword = password || register_number || username;
    const hashed = bcrypt.hashSync(finalPassword, 10);

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

    const finalPassword = password || registrationNumber;
    const hashed = bcrypt.hashSync(finalPassword, 10);

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
    const hashed = bcrypt.hashSync(finalPassword, 10);

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

    let success = 0, failed = 0;
    for (const s of students) {
      try {
        const regNo = String(s.register_number).trim();
        const hashed = bcrypt.hashSync(regNo, 10);
        await pool.query(`
          INSERT INTO users (
            username, password, role, department_id, class_id, full_name, email, register_number
          ) VALUES ($1, $2, 'STUDENT', $3, $4, $5, $6, $7)
        `, [regNo, hashed, deptId, classId, s.name?.trim(), s.email?.trim() || null, regNo]);
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

    if (is_coordinator && target.class_id) {
      const countRes = await pool.query('SELECT count(*) FROM users WHERE class_id = $1 AND is_coordinator = TRUE AND id != $2', [target.class_id, req.params.id]);
      if (parseInt(countRes.rows[0].count) >= 2) return res.status(400).json({ error: 'Maximum 2 coordinators allowed per class' });
    }

    await pool.query('UPDATE users SET is_coordinator = $1, updated_at = NOW() WHERE id = $2', [is_coordinator, req.params.id]);
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

  app.patch('/api/users/:id/status', authenticate, authorize(['CLASS_ADVISOR', 'HOD', 'SUPREME_ADMIN']), async (req: any, res) => {
    const { is_active } = req.body;
    const targetRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    const targetUser = targetRes.rows[0];
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'HOD' && targetUser.department_id?.toString() !== req.user.department_id?.toString())
      return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'CLASS_ADVISOR' && targetUser.class_id?.toString() !== req.user.class_id?.toString())
      return res.status(403).json({ error: 'Forbidden' });

    await pool.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [is_active, req.params.id]);
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
    const hashed = bcrypt.hashSync(newPass, 10);
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
      const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE user_id = $1', [req.params.id]);
      for (const r of subsRes.rows) {
        if (r.cloudinary_public_id) {
          try {
            await cloudinary.uploader.destroy(r.cloudinary_public_id);
          } catch (err) {
            console.error('Failed to delete user submission image from Cloudinary:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to retrieve user submissions for Cloudinary cleanup:', err);
    }

    await pool.query('DELETE FROM task_submissions WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────
  app.get('/api/tasks', authenticate, async (req: any, res) => {
    const dbUserRes = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const dbUser = dbUserRes.rows[0];
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
      const countsRes = await pool.query(`
        SELECT task_id, count(*) as count
        FROM task_submissions
        WHERE task_id = ANY($1) AND status IN ('SUBMITTED', 'VERIFIED')
        GROUP BY task_id
      `, [taskIds]);
      countsRes.rows.forEach(c => {
        countsMap[c.task_id] = parseInt(c.count);
      });
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
  });

  const submissionSchemaValidator = z.object({
    task_id: z.string().min(1, 'Task ID is required'),
    custom_field_value: z.string().optional()
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
    const { title, description, category, external_link, deadline, screenshot_instruction, custom_field_label, department_id, class_ids, poster_url, poster_cloudinary_public_id } = req.body;

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const taskInsertRes = await client.query(`
        INSERT INTO tasks (
          title, description, category, external_link, deadline,
          screenshot_instruction, custom_field_label, created_by, department_id, status,
          poster_url, poster_cloudinary_public_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', $10, $11)
        RETURNING *
      `, [
        title, description, category, external_link, deadline ? new Date(deadline) : null,
        screenshot_instruction, custom_field_label, dbUser.id, deptId,
        poster_url || null, poster_cloudinary_public_id || null
      ]);
      const t = taskInsertRes.rows[0];

      for (const cid of clsIds) {
        await client.query('INSERT INTO task_classes (task_id, class_id) VALUES ($1, $2)', [t.id, cid]);
      }

      if (clsIds.length > 0) {
        const targetStudentsRes = await client.query("SELECT id FROM users WHERE class_id = ANY($1) AND role = 'STUDENT'", [clsIds]);
        for (const s of targetStudentsRes.rows) {
          await client.query(
            'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
            [s.id, `New task posted by ${dbUser.full_name || 'HOD'}: "${t.title}"`, 'NEW_TASK']
          );
        }
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

  app.patch('/api/tasks/:id/status', authenticate, authorize(['SUPREME_ADMIN', 'HOD']), async (req: any, res) => {
    const { status } = req.body;
    if (req.user.role === 'HOD') {
      const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [req.params.id]);
      const task = taskRes.rows[0];
      if (!task || task.department_id?.toString() !== req.user.department_id?.toString())
        return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  });

  app.delete('/api/tasks/:id', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'STUDENT']), async (req: any, res) => {
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const task = taskRes.rows[0];
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isOwner = task.created_by.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'SUPREME_ADMIN';
    const isDeptHOD = req.user.role === 'HOD' && task.department_id?.toString() === req.user.department_id?.toString();

    const tcRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [task.id]);
    const taskClassIds = tcRes.rows.map(r => r.class_id.toString());

    const isClassAdvisor = req.user.role === 'CLASS_ADVISOR' && taskClassIds.includes(req.user.class_id?.toString());
    const isCoordinator = req.user.role === 'STUDENT' && req.user.is_coordinator && taskClassIds.includes(req.user.class_id?.toString());

    if (!isOwner && !isAdmin && !isDeptHOD && !isClassAdvisor && !isCoordinator)
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
      const subsRes = await pool.query('SELECT cloudinary_public_id FROM task_submissions WHERE task_id = $1', [task.id]);
      for (const r of subsRes.rows) {
        if (r.cloudinary_public_id) {
          try {
            await cloudinary.uploader.destroy(r.cloudinary_public_id);
          } catch (err) {
            console.error('Failed to delete task submission image from Cloudinary:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to retrieve task submissions for Cloudinary cleanup:', err);
    }

    await pool.query('DELETE FROM task_submissions WHERE task_id = $1', [req.params.id]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
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

    const classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1', [deptId]);
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

    const taskStats = await Promise.all(tasks.map(async (t) => {
      const subsRes = await pool.query('SELECT user_id, status FROM task_submissions WHERE task_id = $1', [t.id]);
      const subs = subsRes.rows;

      const tcTaskRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [t.id]);
      const taskClassIds = tcTaskRes.rows.map(r => r.class_id.toString());

      const class_breakdown = classes.map(c => {
        const isAssigned = taskClassIds.length === 0 || taskClassIds.includes(c.id.toString());
        if (!isAssigned) {
          return {
            class_name: c.name,
            total_students: 0,
            completed: 0,
            not_completed: 0
          };
        }
        const classStudents = studentsByClass[c.id.toString()] || [];
        const classStudentIds = classStudents.map(s => s.id.toString());
        const completedStudentIds = new Set(subs.filter(s =>
          (s.status === 'SUBMITTED' || s.status === 'VERIFIED') &&
          s.user_id && classStudentIds.includes(s.user_id.toString())
        ).map(s => s.user_id.toString()));

        return {
          class_name: c.name,
          total_students: classStudents.length,
          completed: completedStudentIds.size,
          not_completed: classStudents.length - completedStudentIds.size
        };
      });

      const targetStudentIds = taskClassIds.length > 0
        ? deptStudents.filter(s => taskClassIds.includes(s.class_id?.toString())).map(s => s.id.toString())
        : deptStudentIds.map(s => s.id.toString());
      const studentStatuses = subs.filter(s => s.user_id && targetStudentIds.includes(s.user_id.toString()));
      const sMap = new Map();
      studentStatuses.forEach(s => sMap.set(s.user_id.toString(), s.status));
      const statuses = Array.from(sMap.values());

      return {
        id: t.id, title: t.title,
        submitted: statuses.filter(s => s === 'SUBMITTED').length,
        verified: statuses.filter(s => s === 'VERIFIED').length,
        pending: targetStudentIds.length - statuses.length,
        rejected: statuses.filter(s => s === 'REJECTED').length,
        class_breakdown
      };
    }));

    const classStats = await Promise.all(classes.map(async (c) => {
      const classStudents = studentsByClass[c.id.toString()] || [];
      const classStudentIds = classStudents.map(s => s.id);
      let participatingCount = 0;
      if (classStudentIds.length > 0) {
        const partRes = await pool.query('SELECT count(DISTINCT user_id) FROM task_submissions WHERE user_id = ANY($1)', [classStudentIds]);
        participatingCount = parseInt(partRes.rows[0].count);
      }
      return {
        id: c.id, name: c.name,
        total_students: classStudents.length,
        participating_students: participatingCount,
      };
    }));

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

    const taskStats = await Promise.all(tasks.map(async (t) => {
      let subs: any[] = [];
      if (studentIds.length > 0) {
        const subsRes = await pool.query('SELECT user_id, status FROM task_submissions WHERE task_id = $1 AND user_id = ANY($2)', [t.id, studentIds]);
        subs = subsRes.rows;
      }
      const sMap = new Map();
      subs.forEach(s => sMap.set(s.user_id.toString(), s.status));
      const statuses = Array.from(sMap.values());

      return {
        id: t.id, title: t.title,
        submitted: statuses.filter(s => s === 'SUBMITTED').length,
        verified: statuses.filter(s => s === 'VERIFIED').length,
        pending: studentIds.length - statuses.length,
        rejected: statuses.filter(s => s === 'REJECTED').length,
      };
    }));

    const totalTaskCount = tasks.length;
    const studentStats = await Promise.all(students.map(async (u) => {
      const completedRes = await pool.query('SELECT count(*) FROM task_submissions WHERE user_id = $1 AND status = \'VERIFIED\'', [u.id]);
      return { full_name: u.full_name, register_number: u.register_number, completed_tasks: parseInt(completedRes.rows[0].count), total_tasks: totalTaskCount };
    }));

    const totalStudentsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId]);
    const totalBoysRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND (gender = 'MALE' OR gender = 'BOYS')", [classId]);
    const totalGirlsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND (gender = 'FEMALE' OR gender = 'GIRLS')", [classId]);

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
      WHERE u.class_id = $1 AND (u.gender = 'MALE' OR u.gender = 'BOYS') AND ts.status = 'VERIFIED'
    `, [classId]);
    const girlsVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND (u.gender = 'FEMALE' OR u.gender = 'GIRLS') AND ts.status = 'VERIFIED'
    `, [classId]);

    const boysPendingRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND (u.gender = 'MALE' OR u.gender = 'BOYS') AND ts.status = 'SUBMITTED'
    `, [classId]);
    const girlsPendingRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND (u.gender = 'FEMALE' OR u.gender = 'GIRLS') AND ts.status = 'SUBMITTED'
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
      submitted_at: s.submitted_at,
      verified_at: s.verified_at,
      resubmission_count: s.resubmission_count,
    })));
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
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
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
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
        }
        return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
      }
      if (task.deadline && new Date() > new Date(task.deadline)) {
        if (cloudinary_public_id) {
          try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
        }
        return res.status(400).json({ error: 'Hard deadline block — no late uploads possible' });
      }

      const existingRes = await pool.query('SELECT * FROM task_submissions WHERE task_id = $1 AND user_id = $2 LIMIT 1', [task_id, req.user.id]);
      const existing = existingRes.rows[0];

      if (existing) {
        if (existing.status === 'VERIFIED') {
          if (cloudinary_public_id) {
            try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
          }
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'REJECTED' && existing.resubmission_count >= 2) {
          if (cloudinary_public_id) {
            try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
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
    } catch (err) {
      if (cloudinary_public_id) {
        try { await cloudinary.uploader.destroy(cloudinary_public_id); } catch (e) {}
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

  app.patch('/api/submissions/:id/verify', authenticate, authorize(['HOD', 'SUPREME_ADMIN', 'STUDENT', 'CLASS_ADVISOR']), async (req: any, res) => {
    const { status, verification_note, rejection_reason } = req.body;

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

  // ── Stats: Advisor ────────────────────────────────────────────────────────
  app.get('/api/stats/advisor', authenticate, authorize(['CLASS_ADVISOR']), async (req: any, res) => {
    const classId = req.user.class_id;
    const deptId = req.user.department_id;

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

    const taskStats = await Promise.all(tasks.map(async (t) => {
      let subs: any[] = [];
      if (studentIds.length > 0) {
        const subsRes = await pool.query('SELECT status FROM task_submissions WHERE task_id = $1 AND user_id = ANY($2)', [t.id, studentIds]);
        subs = subsRes.rows;
      }
      return {
        id: t.id, title: t.title,
        submitted: subs.filter(s => s.status === 'SUBMITTED').length,
        verified: subs.filter(s => s.status === 'VERIFIED').length,
        pending: studentIds.length - subs.length,
        rejected: subs.filter(s => s.status === 'REJECTED').length,
      };
    }));

    const totalTasks = tasks.length;
    const studentStats = await Promise.all(students.map(async (u) => {
      const compRes = await pool.query('SELECT count(*) FROM task_submissions WHERE user_id = $1 AND status = \'VERIFIED\'', [u.id]);
      return { full_name: u.full_name, register_number: u.register_number, completed_tasks: parseInt(compRes.rows[0].count), total_tasks: totalTasks };
    }));

    const totalStudentsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT'", [classId]);
    const totalBoysRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND (gender = 'MALE' OR gender = 'BOYS')", [classId]);
    const totalGirlsRes = await pool.query("SELECT count(*) FROM users WHERE class_id = $1 AND role = 'STUDENT' AND (gender = 'FEMALE' OR gender = 'GIRLS')", [classId]);

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
      WHERE u.class_id = $1 AND (u.gender = 'MALE' OR u.gender = 'BOYS') AND ts.status = 'VERIFIED'
    `, [classId]);
    const girlsVerifiedRes = await pool.query(`
      SELECT count(DISTINCT ts.user_id) FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      WHERE u.class_id = $1 AND (u.gender = 'FEMALE' OR u.gender = 'GIRLS') AND ts.status = 'VERIFIED'
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

    const taskStats = await Promise.all(tasks.map(async (t) => {
      let subs: any[] = [];
      if (studentIds.length > 0) {
        const subsRes = await pool.query('SELECT user_id, status FROM task_submissions WHERE task_id = $1 AND user_id = ANY($2)', [t.id, studentIds]);
        subs = subsRes.rows;
      }
      const sMap = new Map();
      subs.forEach(s => sMap.set(s.user_id.toString(), s.status));
      const statuses = Array.from(sMap.values());

      return {
        id: t.id, title: t.title,
        submitted: statuses.filter(s => s === 'SUBMITTED').length,
        verified: statuses.filter(s => s === 'VERIFIED').length,
        pending: studentIds.length - statuses.length,
        rejected: statuses.filter(s => s === 'REJECTED').length,
      };
    }));

    const classStats = await Promise.all(classes.map(async (c) => {
      const classStudents = students.filter(s => s.class_id?.toString() === c.id.toString());
      const classStudentIds = classStudents.map(s => s.id);
      let participatingCount = 0;
      if (classStudentIds.length > 0) {
        const partRes = await pool.query('SELECT count(DISTINCT user_id) FROM task_submissions WHERE user_id = ANY($1)', [classStudentIds]);
        participatingCount = parseInt(partRes.rows[0].count);
      }
      return {
        id: c.id, name: c.name,
        total_students: classStudents.length,
        participating_students: participatingCount,
      };
    }));

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

  // ── Vite Middleware ───────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
  }

  let PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const startApp = (port: number) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        process.stdout.write(`\rPort ${port} in use, trying ${port + 1}...\n`);
        startApp(port + 1);
      } else {
        console.error(err);
      }
    });
  };

  startApp(PORT);
}

startServer();
