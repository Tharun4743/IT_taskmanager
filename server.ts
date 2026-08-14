import dotenv from 'dotenv';
dotenv.config();

import ExcelJS from 'exceljs';

import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

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
import { syncAndGenerateStudentDirectory, updateStudentCodingProfileInDirectory, constantStudentByIdMap, constantStudentByRegNoMap, constantStudentByEmailMap, constantStudentsByClassMap, updateGitHubFileViaAPI } from './studentDirectoryService.js';
import { cleanupOnlyTaskScreenshots } from './imageCleanupService.js';
import { generateDatabaseSnapshot } from './dbBackupService.js';
import { initSentry } from './sentryService.js';
import {
  startTelegramPoller,
  sendGroupSummary,
  triggerPendingTaskReminders,
  getTelegramStats,
  setGroupChatId,
  sendTelegramMessage,
  notifyNewTaskCreated,
  notifyTaskSubmissionReceived,
  notifySubmissionVerifiedOrRejected,
  notifySubmissionBatchVerified
} from './telegramService.js';
import * as XLSX from 'xlsx';

function isValidStrictUrl(urlString: string | null | undefined): boolean {
  if (!urlString) return true;
  const trimmed = urlString.trim();
  if (trimmed === '') return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidLink(urlString: string | null | undefined): boolean {
  if (!urlString) return true;
  const trimmed = urlString.trim();
  if (trimmed === '') return true;

  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes(':')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

const WATERMARK_BASE64 = "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";

async function injectWatermarkImage(xlsxBuffer: Buffer): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer as any);
    
    const imageId = workbook.addImage({
      base64: WATERMARK_BASE64,
      extension: 'png',
    });

    workbook.eachSheet((worksheet) => {
      (worksheet as any).addBackgroundImage(imageId);
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  } catch (err) {
    console.error('[Excel Watermark Injection Error]:', err);
    return xlsxBuffer;
  }
}



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

  // Initialize Telegram Bot update poller for automated student 1-click account linking
  try {
    startTelegramPoller();
  } catch (tgErr) {
    console.error('[Telegram] Failed to start poller:', tgErr);
  }

  // Schedule automated daily Telegram notifications:
  // 1. 8:00 PM IST -> 1-to-1 Private Reminders to students with pending deadlines
  // 2. 9:00 PM IST -> Formatted Group Summary to the Department Telegram Group
  let lastRemindersDate = '';
  let lastGroupSummaryDate = '';

  setInterval(() => {
    try {
      const now = new Date();
      const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const istDate = new Date(istString);
      const todayStr = istDate.toISOString().slice(0, 10);
      const hours = istDate.getHours();
      const minutes = istDate.getMinutes();

      // 8:00 PM IST (20:00) -> Private Reminders (once per day)
      if (hours === 20 && minutes >= 0 && minutes <= 5 && lastRemindersDate !== todayStr) {
        lastRemindersDate = todayStr;
        console.log('[Telegram Scheduler] 📢 Running automated 8:00 PM IST student deadline reminders...');
        triggerPendingTaskReminders().catch(err => console.error('[Telegram Scheduler] Error sending reminders:', err));
      }

      // 9:00 PM IST (21:00) -> Group Summary (once per day)
      if (hours === 21 && minutes >= 0 && minutes <= 5 && lastGroupSummaryDate !== todayStr) {
        lastGroupSummaryDate = todayStr;
        console.log('[Telegram Scheduler] 📊 Running automated 9:00 PM IST daily group summary...');
        sendGroupSummary().catch(err => console.error('[Telegram Scheduler] Error sending group summary:', err));
      }
    } catch (schedErr) {
      console.error('[Telegram Scheduler] Check error:', schedErr);
    }
  }, 60 * 1000);

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

  // ── High-Speed In-Memory User Auth Cache (TTL: 45s) ──────────────────────
  interface CachedAuthUser {
    user: any;
    cachedAt: number;
  }
  const userAuthCache = new Map<string, CachedAuthUser>();

  const invalidateUserAuthCache = (userId?: string) => {
    if (userId) {
      userAuthCache.delete(String(userId));
    } else {
      userAuthCache.clear();
    }
  };

  // ── High-Speed In-Memory Cache for Read-Heavy Static/Semi-Static Data ─────
  interface CachedApiEntry {
    data: any;
    expiresAt: number;
  }
  const apiMemoryCache = new Map<string, CachedApiEntry>();

  const getApiCache = <T = any>(key: string): T | null => {
    const item = apiMemoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      apiMemoryCache.delete(key);
      return null;
    }
    return item.data as T;
  };

  const setApiCache = (key: string, data: any, ttlSeconds = 30): void => {
    apiMemoryCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  };

  const invalidateApiCache = (prefix?: string): void => {
    if (!prefix) {
      apiMemoryCache.clear();
      return;
    }
    for (const key of apiMemoryCache.keys()) {
      if (key.startsWith(prefix)) {
        apiMemoryCache.delete(key);
      }
    }
  };

  // Auth Middleware - Fetches dynamic permissions with 45s in-memory caching
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      let user: any = null;
      const cached = userAuthCache.get(userId);
      const now = Date.now();
      if (cached && (now - cached.cachedAt) < 45000) {
        user = cached.user;
      } else {
        const dbUserRes = await pool.query(
          'SELECT id, username, role, department_id, class_id, is_coordinator, is_year_coordinator, year_scope, register_number FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        user = dbUserRes.rows[0];
        if (user) {
          userAuthCache.set(userId, { user, cachedAt: now });
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

  // ── Telegram Bot Notification Endpoints ─────────────────────────────────────
  // 1. Get Telegram Bot Status & Stats
  app.get('/api/telegram/status', authenticate, asyncHandler(async (req: any, res: Response) => {
    const stats = await getTelegramStats();
    
    // Check if the current requesting user has telegram linked
    const userRes = await pool.query('SELECT telegram_chat_id, telegram_username, telegram_linked_at FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    
    res.json({
      ...stats,
      currentUserLinked: Boolean(user?.telegram_chat_id),
      currentUserTelegram: user?.telegram_username || null,
      currentUserLinkedAt: user?.telegram_linked_at || null
    });
  }));

  // 2. Set Department/Class Group Chat ID
  app.post('/api/telegram/set-group-chat', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), asyncHandler(async (req: any, res: Response) => {
    const { chatId } = req.body;
    if (!chatId || typeof chatId !== 'string') {
      return res.status(400).json({ error: 'Valid Telegram Chat ID is required' });
    }
    await setGroupChatId(chatId.trim());
    res.json({ success: true, message: `Group Chat ID updated to ${chatId.trim()}` });
  }));

  // 3. Trigger Instant Group Summary Notification
  app.post('/api/telegram/send-group-summary', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), asyncHandler(async (req: any, res: Response) => {
    const { targetChatId } = req.body;
    const result = await sendGroupSummary(targetChatId);
    res.json(result);
  }));

  // 4. Trigger Instant 1-to-1 Private Reminders to Pending Students
  app.post('/api/telegram/send-reminders', authenticate, authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR']), asyncHandler(async (req: any, res: Response) => {
    const result = await triggerPendingTaskReminders();
    res.json(result);
  }));

  // 5. Send Test Notification to User or Group
  app.post('/api/telegram/test', authenticate, asyncHandler(async (req: any, res: Response) => {
    const { targetChatId } = req.body;
    let chatId = targetChatId;
    if (!chatId) {
      const userRes = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [req.user.id]);
      chatId = userRes.rows[0]?.telegram_chat_id;
    }

    if (!chatId) {
      return res.status(400).json({ error: 'No Telegram Chat ID found. Please connect your Telegram account first or provide a target Chat ID.' });
    }

    const testMsg = `🔔 *IT TaskManager — Test Notification*\n\n✅ Your connection to the IT TaskManager Telegram Bot is working perfectly!\n📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
    const result = await sendTelegramMessage(chatId, testMsg, { parse_mode: 'Markdown' });
    
    if (result.ok) {
      res.json({ success: true, message: 'Test message sent successfully!' });
    } else {
      res.status(500).json({ error: result.description || 'Failed to send test message via Telegram API' });
    }
  }));

  // 6. Unlink Telegram from Student Profile
  app.delete('/api/student/unlink-telegram', authenticate, asyncHandler(async (req: any, res: Response) => {
    await pool.query('UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Telegram account unlinked successfully.' });
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
        telegram_chat_id: user.telegram_chat_id || null,
        telegram_username: user.telegram_username || null,
      }
    });
  }));

  app.get('/api/auth/me', authenticate, asyncHandler(async (req: any, res: Response) => {
    const userRes = await pool.query(`
      SELECT 
        u.id, u.username, u.role, u.full_name, u.email, u.register_number, u.gender,
        u.phone, u.bio, u.github_url, u.linkedin_url, u.avatar_url,
        u.telegram_chat_id, u.telegram_username, u.telegram_linked_at,
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
      telegram_chat_id: user.telegram_chat_id || null,
      telegram_username: user.telegram_username || null,
      telegram_linked_at: user.telegram_linked_at || null,
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





  // ── Departments ───────────────────────────────────────────────────────────
  app.get('/api/departments', authenticate, async (req, res) => {
    const cached = getApiCache('departments_all');
    if (cached) return res.json(cached);

    const deptsRes = await pool.query('SELECT * FROM departments ORDER BY created_at ASC');
    const data = deptsRes.rows.map(d => ({ id: d.id, name: d.name, created_at: d.created_at }));
    setApiCache('departments_all', data, 60);
    res.json(data);
  });

  app.post('/api/departments', authenticate, authorize(['SUPREME_ADMIN']), async (req, res) => {
    const { name } = req.body;
    if (name !== 'Information Technology') {
      return res.status(400).json({ error: 'Only Information Technology department is allowed.' });
    }
    try {
      const resDept = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
      const d = resDept.rows[0];
      invalidateApiCache('departments');
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
      invalidateApiCache('departments');
      invalidateApiCache('classes');
      invalidateUserAuthCache();
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
    const cacheKey = `classes_${req.user.role}_${req.user.department_id || 'all'}_${req.user.class_id || 'all'}_${req.user.year_scope || 'all'}`;
    const cached = getApiCache(cacheKey);
    if (cached) return res.json(cached);

    let classesRes;
    if (req.user.role === 'SUPREME_ADMIN') {
      classesRes = await pool.query(`
        SELECT c.*, d.name as department_name
        FROM classes c
        LEFT JOIN departments d ON c.department_id = d.id
        ORDER BY c.year ASC, c.name ASC
      `);
      const data = classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
        department_name: c.department_name,
      }));
      setApiCache(cacheKey, data, 30);
      return res.json(data);
    } else if (req.user.role === 'HOD') {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 ORDER BY year ASC, name ASC', [req.user.department_id]);
      const data = classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      }));
      setApiCache(cacheKey, data, 30);
      return res.json(data);
    } else if (req.user.role === 'CLASS_ADVISOR' && req.user.is_year_coordinator) {
      classesRes = await pool.query('SELECT * FROM classes WHERE department_id = $1 AND year = $2 ORDER BY year ASC, name ASC', [req.user.department_id, req.user.year_scope]);
      const data = classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      }));
      setApiCache(cacheKey, data, 30);
      return res.json(data);
    } else {
      if (!req.user.class_id) {
        return res.json([]);
      }
      classesRes = await pool.query('SELECT * FROM classes WHERE id = $1', [req.user.class_id]);
      const data = classesRes.rows.map((c: any) => ({
        id: c.id, name: c.name, year: c.year, batch: c.batch,
        department_id: c.department_id,
      }));
      setApiCache(cacheKey, data, 30);
      return res.json(data);
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
    invalidateApiCache('classes');
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
      invalidateApiCache('classes');
      invalidateUserAuthCache();
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
        usersRes = await pool.query(`
          SELECT u.*, c.name as class_name
          FROM users u
          LEFT JOIN classes c ON u.class_id = c.id
          WHERE u.class_id = $1 AND u.role = 'STUDENT'
          ORDER BY u.register_number ASC, u.full_name ASC
        `, [req.user.class_id]);
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
    invalidateUserAuthCache(req.params.id);

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
    invalidateUserAuthCache(req.params.id);
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
    invalidateUserAuthCache(req.params.id);
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
    invalidateUserAuthCache(req.params.id);
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

    const cacheKey = `tasks_${dbUser.role}_${dbUser.id}_${dbUser.class_id || 'all'}_${dbUser.department_id || 'all'}_${dbUser.year_scope || 'all'}`;
    const cached = getApiCache(cacheKey);
    if (cached) return res.json(cached);

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

    const responseData = tasks.map((t: any) => ({
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
    }));

    setApiCache(cacheKey, responseData, 5);
    res.json(responseData);
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
    external_link: z.string().refine(val => !val || isValidStrictUrl(val), { message: 'Invalid external link URL' }).optional().nullable(),
    deadline: z.string().optional().nullable(),
    screenshot_instruction: z.string().optional().nullable(),
    custom_field_label: z.string().optional().nullable(),
    department_id: z.union([z.string(), z.number(), z.null()]).optional(),
    class_ids: z.array(z.any()).optional().nullable(),
    poster_url: z.string().refine(val => !val || isValidStrictUrl(val), { message: 'Invalid poster URL' }).optional().nullable(),
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
      invalidateApiCache('tasks_');

      // Dispatch real-time Telegram notification to assigned classes & group
      notifyNewTaskCreated({
        id: t.id,
        title: t.title,
        category: t.category,
        deadline: t.deadline,
        creator_name: dbUser.full_name
      }, clsIds).catch(err => console.error('[Telegram Notify Task Error]:', err));

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
    invalidateApiCache('tasks_');
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

    invalidateApiCache('tasks_');
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
    invalidateApiCache('tasks_');
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

        notifyTaskSubmissionReceived(req.user.id, task_id).catch(err => console.error('[Telegram Notify Submission Error]:', err));
        invalidateApiCache('tasks_');
        return res.json({ success: true, id: existing.id });
      }

      const subRes = await pool.query(`
        INSERT INTO task_submissions (task_id, user_id, status, screenshot_url, cloudinary_public_id, custom_field_value, submitted_at)
        VALUES ($1, $2, 'SUBMITTED', $3, $4, $5, NOW())
        RETURNING id
      `, [task_id, req.user.id, screenshot_url, cloudinary_public_id, custom_field_value]);

      notifyTaskSubmissionReceived(req.user.id, task_id).catch(err => console.error('[Telegram Notify Submission Error]:', err));
      invalidateApiCache('tasks_');
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

    notifySubmissionBatchVerified(submission_ids).catch(err => console.error('[Telegram Batch Verify Error]:', err));
    invalidateApiCache('tasks_');
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

    notifySubmissionVerifiedOrRejected(req.params.id, status, status === 'VERIFIED' ? verification_note : rejection_reason).catch(err => console.error('[Telegram Notify Verify Error]:', err));
    invalidateApiCache('tasks_');

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

    if (github_url && !isValidStrictUrl(github_url)) {
      return res.status(400).json({ error: 'Invalid GitHub URL format' });
    }
    if (live_demo_url && !isValidStrictUrl(live_demo_url)) {
      return res.status(400).json({ error: 'Invalid Live Demo URL format' });
    }

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

    if (certificate_url && !isValidStrictUrl(certificate_url)) {
      return res.status(400).json({ error: 'Invalid Internship Certificate URL format' });
    }

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

    if (certificate_url && !isValidStrictUrl(certificate_url)) {
      return res.status(400).json({ error: 'Invalid Certificate URL format' });
    }

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

    const profileFields = { github, leetcode, hackerrank, codechef, geeksforgeeks, linkedin, portfolio };
    for (const [key, value] of Object.entries(profileFields)) {
      if (value && !isValidLink(value)) {
        return res.status(400).json({ error: `Invalid URL or username format for ${key}` });
      }
    }

    // 1. Update student_coding_profiles table
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

    // 2. Update users table with leetcode_url & github_url
    await pool.query(`
      UPDATE users 
      SET leetcode_url = $1, github_url = $2, updated_at = NOW()
      WHERE id = $3
    `, [leetcode || '', github || '', userId]);

    // 3. Update in-memory caches and write to studentDirectory JSON/CSV on disk
    updateStudentCodingProfileInDirectory(userId, leetcode || '', github || '');

    // 4. Trigger immediate background sync for LeetCode & GitHub for this student
    syncLeetcodeProgressForScope({ userId }).catch(err => console.error('[LeetCode Sync] Immediate sync error on profile update:', err));
    syncGitHubProgressForScope({ userId }).catch(err => console.error('[GitHub Sync] Immediate sync error on profile update:', err));

    res.json({ message: 'Coding profiles updated', profiles: result.rows[0] });
  }));

  // 7. Resume Save
  app.post('/api/student/profile/resume', authenticate, authorize(['STUDENT']), asyncHandler(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { resume_url, file_name } = req.body;
    if (!resume_url) return res.status(400).json({ error: 'Resume URL is required' });

    if (resume_url && !isValidStrictUrl(resume_url)) {
      return res.status(400).json({ error: 'Invalid Resume URL format' });
    }

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

  // GET /api/notices — fetch notices visible to the current user
  app.get('/api/notices', authenticate, asyncHandler(async (req: any, res: Response) => {
    const u = req.user;
    const { search, priority, scope: scopeFilter } = req.query as any;

    const cacheKey = `notices_${u.role}_${u.department_id || 'all'}_${u.class_id || 'all'}_${search || ''}_${priority || ''}_${scopeFilter || ''}`;
    const cached = getApiCache(cacheKey);
    if (cached) return res.json(cached);

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

    setApiCache(cacheKey, result.rows, 15);
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
      invalidateApiCache('notices_');
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

    invalidateApiCache('notices_');
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

    invalidateApiCache('notices_');
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
    invalidateApiCache('notices_');
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
    invalidateApiCache('notices_');
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
        SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, u.leetcode_url, u.github_url, c.year, c.batch 
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
          const leetcodeProfile = studentDir?.leetcode || student.leetcode_url || '';

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

            // Filter today's submissions
            const todaySubmissions = details.recentSubmissions
                .filter(s => s.timestamp >= todayStartSec && s.timestamp <= todayEndSec);

            // Calculate count of unique accepted problems solved ON current date
            const recentTodayCount = new Set(
              todaySubmissions.map(s => s.titleSlug)
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
              if (todaySubmissions.length < 50) {
                // If today's submissions are less than the 50 limit returned by LeetCode,
                // then recentTodayCount is exactly correct. Ignore diffSolved to avoid anomalies.
                solvedToday = recentTodayCount;
              } else {
                // If they hit the 50 limit today, diffSolved might be higher and more accurate.
                solvedToday = Math.max(diffSolved, recentTodayCount);
              }
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

  // TEMPORARY ADMIN ROUTE: Fix Anomalous Historical LeetCode Data
  app.get('/api/admin/fix-anomalous-data', asyncHandler(async (req: any, res: Response) => {
    // The previous sync bug caused total_solved to be incorrectly inserted into solved_today 
    // when a user first connected or their total count jumped. 
    // Since LeetCode's recent submissions maxes at 50, any solved_today > 30 is highly likely 
    // to be this bug (unless they genuinely grinded 30+ problems in one day, which is rare, 
    // but resetting it to 0 is the safest way to repair weekly/monthly aggregates).
    
    const result = await pool.query(`
      UPDATE leetcode_daily_progress 
      SET solved_today = 0, updated_at = CURRENT_TIMESTAMP
      WHERE solved_today > 25
    `);
    
    // Also recalculate progress statuses for the last 30 days to fix daily status texts
    const today = new Date();
    const endDateStr = today.toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    await recalculateProgressStatuses(startDateStr, endDateStr, {}).catch(err => console.error(err));
    
    res.json({ 
      success: true, 
      message: "Anomalous historical data has been fixed and statuses recalculated.", 
      fixedRows: result.rowCount 
    });
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
        totalSolved: dailyRow?.total_solved || null,
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

    const stdRes = await pool.query(`
      SELECT id FROM users WHERE id = $1 AND role = 'STUDENT'
    `, [studentId]);

    if (stdRes.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const dailyHistory = await pool.query(`
      SELECT date, solved_today, daily_target
      FROM leetcode_daily_progress
      WHERE user_id = $1 AND total_solved IS NOT NULL
      ORDER BY date DESC LIMIT 30
    `, [studentId]);

    const dailyPoints = dailyHistory.rows.map(r => ({
      date: new Date(r.date).toISOString().split('T')[0],
      actual: Number(r.solved_today),
      target: Number(r.daily_target)
    })).reverse();

    const weeklyPoints: any[] = [];
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
    const finalBuf = await injectWatermarkImage(buf);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Daily_Report_${dateStr}.xlsx`);
    res.send(finalBuf);
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
    const finalBuf = await injectWatermarkImage(buf);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Weekly_Report_${week.start}_to_${week.end}.xlsx`);
    res.send(finalBuf);
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

    const dateSun = `${getUTCDayStr(week.start, 0)} (Sun)`;
    const dateMon = `${getUTCDayStr(week.start, 1)} (Mon)`;
    const dateTue = `${getUTCDayStr(week.start, 2)} (Tue)`;
    const dateWed = `${getUTCDayStr(week.start, 3)} (Wed)`;
    const dateThu = `${getUTCDayStr(week.start, 4)} (Thu)`;
    const dateFri = `${getUTCDayStr(week.start, 5)} (Fri)`;
    const dateSat = `${getUTCDayStr(week.start, 6)} (Sat)`;

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
        [dateSun]: sun,
        [dateMon]: mon,
        [dateTue]: tue,
        [dateWed]: wed,
        [dateThu]: thu,
        [dateFri]: fri,
        [dateSat]: sat,
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
    const finalBuf = await injectWatermarkImage(buf);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Weekly_Detailed_${week.start}_to_${week.end}.xlsx`);
    res.send(finalBuf);
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
    const finalBuf = await injectWatermarkImage(buf);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Leetcode_Defaulters_${dateStr}.xlsx`);
    res.send(finalBuf);
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
        SELECT u.id, u.register_number, u.full_name, u.class_id, u.department_id, u.leetcode_url, u.github_url, c.year, c.name as class_name
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
          const githubProfile = studentDir?.github || student.github_url || '';

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
    const finalBuf = await injectWatermarkImage(buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Daily_Report_${dateStr}.xlsx`);
    res.send(finalBuf);
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
    const finalBuf = await injectWatermarkImage(buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Weekly_Report_${week.start}_to_${week.end}.xlsx`);
    res.send(finalBuf);
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

    const getUTCDayStr = (startStr: string, offsetDays: number): string => {
      const parts = startStr.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const date = new Date(Date.UTC(y, m, d));
      date.setUTCDate(date.getUTCDate() + offsetDays);
      return date.toISOString().split('T')[0];
    };

    const dateSun = `${getUTCDayStr(week.start, 0)} (Sun)`;
    const dateMon = `${getUTCDayStr(week.start, 1)} (Mon)`;
    const dateTue = `${getUTCDayStr(week.start, 2)} (Tue)`;
    const dateWed = `${getUTCDayStr(week.start, 3)} (Wed)`;
    const dateThu = `${getUTCDayStr(week.start, 4)} (Thu)`;
    const dateFri = `${getUTCDayStr(week.start, 5)} (Fri)`;
    const dateSat = `${getUTCDayStr(week.start, 6)} (Sat)`;

    const detailedList = filtered.map(r => {
      const id = r.studentId;
      return {
        'Register No': r.registerNumber, 'Student Name': r.fullName, 'Section': r.className,
        'GitHub': r.githubUsername,
        [`${dateSun} Commits`]: getDay(id, 0).commits,
        [`${dateMon} Commits`]: getDay(id, 1).commits,
        [`${dateTue} Commits`]: getDay(id, 2).commits,
        [`${dateWed} Commits`]: getDay(id, 3).commits,
        [`${dateThu} Commits`]: getDay(id, 4).commits,
        [`${dateFri} Commits`]: getDay(id, 5).commits,
        [`${dateSat} Commits`]: getDay(id, 6).commits,
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
    const finalBuf = await injectWatermarkImage(buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Weekly_Detailed_${week.start}_to_${week.end}.xlsx`);
    res.send(finalBuf);
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
    const finalBuf = await injectWatermarkImage(buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GitHub_Defaulters_${dateStr}.xlsx`);
    res.send(finalBuf);
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
    const finalBuf = await injectWatermarkImage(buf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${view}_Progress_Report_${dateStr}.xlsx`);
    res.send(finalBuf);
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

      try {
        const todayStr = getISTDateStr();
        await syncLeetcodeProgressForScope();
        await exportAndPushLeetcodeDailyProgress(todayStr);
      } catch (err) {
        console.error('[GitHub Sync Daemon LeetCode Export Error]:', err);
      }

      scheduleGitHubDailySync();
    }, timeUntilSync);
  }

  // Auto-generate date-wise and year-wise LeetCode progress JSON files and push to GitHub
  async function exportAndPushLeetcodeDailyProgress(dateStr: string) {
    try {
      console.log(`[LeetCode AutoSync] Generating date-wise year-wise exports for date: ${dateStr}...`);
      const leetcodeBaseDir = path.join(process.cwd(), 'leetcode');
      const dateDir = path.join(leetcodeBaseDir, dateStr);
      
      if (!fs.existsSync(leetcodeBaseDir)) {
        fs.mkdirSync(leetcodeBaseDir, { recursive: true });
      }
      if (!fs.existsSync(dateDir)) {
        fs.mkdirSync(dateDir, { recursive: true });
      }

      const studentRes = await pool.query(`
        SELECT u.id, COALESCE(u.register_number, u.username) AS register_number, u.full_name, u.class_id, u.email, c.year, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'STUDENT'
      `);
      const allStudents = studentRes.rows;

      const yearGroups: Record<string, any[]> = {};
      for (const student of allStudents) {
        const yearKey = String(student.year || 0);
        if (!yearGroups[yearKey]) {
          yearGroups[yearKey] = [];
        }
        yearGroups[yearKey].push(student);
      }

      const filesToSync: string[] = [];

      for (const [yearKey, studentsInYear] of Object.entries(yearGroups)) {
        if (yearKey === '0') continue;

        const enrichedList = await enrichStudentProgressBatch(studentsInYear, dateStr);
        
        const progressData = enrichedList.map(item => {
          const studentInfo = studentsInYear.find(s => String(s.id) === String(item.studentId));
          return {
            'Register No': item.registerNumber,
            'Student Name': item.fullName,
            'Class': item.className || '—',
            'Email ID': studentInfo?.email || '—',
            'LeetCode ID': item.leetcodeUrl ? item.leetcodeUrl.split('/').filter(Boolean).pop() : '',
            'LeetCode URL': item.leetcodeUrl || '',
            'Daily Target': item.dailyTarget,
            'Solved Today': item.solvedToday,
            'Daily Status': item.dailyStatus ? item.dailyStatus.replace('_', ' ') : 'NO_TARGET',
            'Total Solved': item.totalSolved || 0,
            'Solved This Week': item.solvedThisWeek,
            'Weekly Target': item.weeklyTarget,
            'Weekly Status': item.weeklyStatus ? item.weeklyStatus.replace('_', ' ') : 'NO_TARGET'
          };
        });

        const fileName = `Year_${yearKey}.json`;
        const filePath = path.join(dateDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(progressData, null, 2), 'utf-8');
        filesToSync.push(filePath);
        console.log(`[LeetCode AutoSync] Wrote local file: ${filePath}`);
      }

      const commitMsg = `chore(leetcode): auto-sync daily progress for date ${dateStr}`;

      if (process.env.GITHUB_TOKEN && filesToSync.length > 0) {
        console.log('[LeetCode AutoSync] Syncing files to GitHub via Content API...');
        for (const fPath of filesToSync) {
          await updateGitHubFileViaAPI(fPath, commitMsg);
        }
      }

      try {
        await execPromise('git add leetcode/');
        const statusRes = await execPromise('git status --porcelain leetcode/');
        if (statusRes.stdout.trim()) {
          await execPromise(`git commit -m "${commitMsg}"`);
          await execPromise('git push origin main');
          console.log(`[LeetCode AutoSync] 🚀 Auto-pushed leetcode progress to GitHub via Git CLI: ${commitMsg}`);
        }
      } catch (err: any) {
        console.warn('[LeetCode AutoSync] Local Git CLI push warning (ignored if Content API worked):', err.message);
      }

    } catch (err: any) {
      console.error('[LeetCode AutoSync] Error executing daily sync & export:', err);
    }
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

    const todayStr = getISTDateStr();
    await exportAndPushLeetcodeDailyProgress(todayStr).catch(err => console.error('[Cron Webhook LeetCode Export Error]:', err));

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
    // High-concurrency reverse-proxy keepalive settings (prevent socket hangup behind Render / Cloudflare / Nginx)
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

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
