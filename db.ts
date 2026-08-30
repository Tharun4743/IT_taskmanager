import * as dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  console.error("FATAL DATABASE ERROR: DATABASE_URL environment variable is missing!");
  process.exit(1);
}

// Automatically upgrade Supabase pooler from Session mode (port 5432, hard limit 15 clients)
// to Transaction mode (port 6543, unlimited concurrent clients) to prevent EMAXCONNSESSION crashes
let databaseUrl = rawDatabaseUrl;
if (databaseUrl.includes('pooler.supabase.com:5432')) {
  console.log('[PostgreSQL Pool] Automatically routing Supabase connection to Port 6543 (Transaction Mode) to eliminate EMAXCONNSESSION limit.');
  databaseUrl = databaseUrl.replace('pooler.supabase.com:5432', 'pooler.supabase.com:6543');
}

const poolMax = process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : (process.env.PGMAXCONNECTIONS ? parseInt(process.env.PGMAXCONNECTIONS, 10) : 25);
const poolMin = process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : 2;
const connectionTimeoutMillis = process.env.DB_CONNECTION_TIMEOUT_MS ? parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) : 20000;
const idleTimeoutMillis = process.env.DB_IDLE_TIMEOUT_MS ? parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) : 30000;
const statementTimeout = process.env.DB_STATEMENT_TIMEOUT_MS ? parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10) : 30000;
const maxUses = process.env.DB_POOL_MAX_USES ? parseInt(process.env.DB_POOL_MAX_USES, 10) : 7500;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: poolMax,
  min: poolMin,
  idleTimeoutMillis: idleTimeoutMillis,
  connectionTimeoutMillis: connectionTimeoutMillis,
  statement_timeout: statementTimeout,
  maxUses: maxUses,
  keepAlive: true,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

pool.on('error', (err: any) => {
  console.error('[PostgreSQL Pool] Unexpected error on idle client:', err?.message || err);
});

export function getPoolStatus() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: poolMax,
    min: poolMin,
  };
}

export async function initDB() {
  let client;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      client = await pool.connect();
      break;
    } catch (err: any) {
      if (attempt === 5) throw err;
      console.warn(`[initDB] Connection attempt ${attempt} failed (${err.message}). Retrying in 1.5s...`);
      await new Promise(res => setTimeout(res, 1500));
    }
  }
  if (!client) throw new Error("Failed to connect to database pool.");

  try {
    // Enable uuid extension if available
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    } catch (e) {
      console.log('Note: uuid-ossp extension could not be enabled, using built-in gen_random_uuid() or standard UUIDs');
    }

    // 1. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
        year INT,
        batch VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'SUPREME_ADMIN','HOD','CLASS_ADVISOR','STUDENT'
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
        full_name VARCHAR(255),
        email VARCHAR(255),
        register_number VARCHAR(255),
        is_coordinator BOOLEAN DEFAULT FALSE,
        is_year_coordinator BOOLEAN DEFAULT FALSE,
        year_scope INT DEFAULT NULL,
        gender VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_email UNIQUE (email),
        CONSTRAINT unique_register UNIQUE (register_number)
      );
    `);

    // Ensure gender and profile columns exist if table was already created
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1000);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP;`);

    // Clean up any improperly saved Telegram group IDs from individual user accounts
    await client.query(`UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL WHERE telegram_chat_id LIKE '-%';`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        external_link VARCHAR(1000),
        deadline TIMESTAMP,
        screenshot_instruction TEXT,
        custom_field_label VARCHAR(255),
        created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'OPEN',
        poster_url VARCHAR(1000),
        poster_cloudinary_public_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_classes (
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, class_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        custom_field_value TEXT,
        status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING','SUBMITTED','VERIFIED','REJECTED'
        screenshot_url VARCHAR(1000),
        cloudinary_public_id VARCHAR(255),
        verification_note TEXT,
        rejection_reason TEXT,
        resubmission_count INT DEFAULT 0,
        submitted_at TIMESTAMP,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (task_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE NOT NULL,
        reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(100) NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Web Push Subscriptions for Mobile / PWA Lock-screen Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
    `);

    // Team Tasks Feature Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
        leader_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        team_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'FORMING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        accepted_at TIMESTAMP,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_team_student UNIQUE (team_id, student_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        invited_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
        submitted_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        proof_url VARCHAR(1000),
        cloudinary_public_id VARCHAR(255),
        remarks TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ─── Student Profile Module Tables ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        mobile_number VARCHAR(50),
        date_of_birth VARCHAR(50),
        semester INT,
        cgpa NUMERIC(4,2),
        current_arrears INT DEFAULT 0,
        history_of_arrears INT DEFAULT 0,
        about_me TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        skill_name VARCHAR(100) NOT NULL,
        category VARCHAR(100) DEFAULT 'Technical',
        level VARCHAR(50) DEFAULT 'Intermediate',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        description TEXT,
        tech_stack VARCHAR(500),
        github_url VARCHAR(500),
        live_demo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_internships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        company VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        duration VARCHAR(100),
        mode VARCHAR(50) DEFAULT 'Offline',
        certificate_url VARCHAR(1000),
        cloudinary_public_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_certifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        certificate_name VARCHAR(255) NOT NULL,
        provider VARCHAR(255),
        issue_date VARCHAR(50),
        credential_id VARCHAR(255),
        certificate_url VARCHAR(1000),
        cloudinary_public_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_coding_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        github VARCHAR(500),
        leetcode VARCHAR(500),
        hackerrank VARCHAR(500),
        codechef VARCHAR(500),
        geeksforgeeks VARCHAR(500),
        linkedin VARCHAR(500),
        portfolio VARCHAR(500),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        resume_url VARCHAR(1000),
        cloudinary_public_id VARCHAR(255),
        file_name VARCHAR(255),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Hackathons',
        description TEXT,
        event_date VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_languages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        language VARCHAR(100) NOT NULL,
        proficiency VARCHAR(50) DEFAULT 'Fluent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_career_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        preferred_role VARCHAR(255),
        preferred_domain VARCHAR(255),
        preferred_location VARCHAR(255),
        willing_to_relocate BOOLEAN DEFAULT TRUE,
        work_mode VARCHAR(50) DEFAULT 'Hybrid',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ─── Module 2: Digital Notice Board ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        scope VARCHAR(50) DEFAULT 'ALL',
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
        year INT,
        priority VARCHAR(50) DEFAULT 'NORMAL',
        attachment_url VARCHAR(1000),
        attachment_cloudinary_public_id VARCHAR(255),
        created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        publish_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expire_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);



    // ─── Module 4: Smart Reminder System ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notification_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        task_reminders BOOLEAN DEFAULT TRUE,
        event_reminders BOOLEAN DEFAULT TRUE,
        notice_reminders BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        attempts INT DEFAULT 0,
        used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_deadline_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) DEFAULT '2_HOUR',
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, user_id, alert_type)
      );
    `);

    // Schema Migrations
    await client.query(`
      ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS poster_url VARCHAR(1000);
    `);
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS poster_cloudinary_public_id VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS not_participating BOOLEAN DEFAULT FALSE;
    `);
    await client.query(`
      ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS not_participating_reason TEXT;
    `);
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submission_type VARCHAR(50) DEFAULT 'INDIVIDUAL';
    `);
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS min_team_size INT DEFAULT 2;
    `);
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS max_team_size INT DEFAULT 5;
    `);
    await client.query(`
      ALTER TABLE leetcode_daily_progress ADD COLUMN IF NOT EXISTS solved_yesterday INT NOT NULL DEFAULT 0;
    `);

    // Create indexes — original tables
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_task_user ON task_submissions(task_id, user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_class_role ON users(class_id, role);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_dept_role ON users(department_id, role);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_classes_class ON task_classes(class_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(LOWER(username));`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_lower_regno ON users(LOWER(register_number));`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_task_class ON teams(task_id, class_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_student ON team_members(student_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_team_status ON team_members(team_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_invitations_student_status ON team_invitations(student_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_invitations_team_student ON team_invitations(team_id, student_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_submissions_team ON team_submissions(team_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);

    // Create indexes — new module tables
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notices_scope_dept ON notices(scope, department_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notices_class ON notices(class_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notices_publish ON notices(publish_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notices_created_by ON notices(created_by);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_notifs_user ON scheduled_notifications(user_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_notifs_time ON scheduled_notifications(scheduled_time, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON tasks(status, deadline);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline_dept ON tasks(status, deadline, department_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON task_submissions(submitted_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_verified_at ON task_submissions(verified_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_cloudinary ON task_submissions(cloudinary_public_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_user_status ON task_submissions(user_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_submissions_task_status ON task_submissions(task_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_coding_user ON student_coding_profiles(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_lookup ON password_resets(email, otp_code, used);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_deadline_alerts ON task_deadline_alerts(task_id, user_id, alert_type);`);

    // ─── Module 5: LeetCode Targets & Progress Tracking ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS leetcode_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        daily_target INT NOT NULL DEFAULT 0,
        weekly_target INT NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        year INT,
        department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leetcode_daily_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        date DATE NOT NULL,
        total_solved INT,
        solved_today INT NOT NULL DEFAULT 0,
        solved_yesterday INT NOT NULL DEFAULT 0,
        daily_target INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL, -- 'COMPLETED', 'INCOMPLETE', 'DATA_UNAVAILABLE'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_targets_scope ON leetcode_targets(user_id, class_id, year, department_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_targets_dates ON leetcode_targets(start_date, end_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_progress_date ON leetcode_daily_progress(user_id, date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_progress_date_range ON leetcode_daily_progress(date, user_id);`);

    // ─── Module 6: GitHub Daily Commit Count Tracking ─────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_daily_commits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        github_username TEXT,
        date DATE NOT NULL,
        daily_commit_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, date)
      );
    `);

    // Safely migrate existing records from legacy github_daily_progress if present
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'github_daily_progress') THEN
          INSERT INTO github_daily_commits (student_id, github_username, date, daily_commit_count, created_at, updated_at)
          SELECT user_id, github_username, date, COALESCE(commits_today, 0), created_at, updated_at
          FROM github_daily_progress
          ON CONFLICT (student_id, date) DO UPDATE
            SET daily_commit_count = EXCLUDED.daily_commit_count,
                github_username = EXCLUDED.github_username,
                updated_at = EXCLUDED.updated_at;
        END IF;
      END $$;
    `);

    // Drop legacy & obsolete tables
    await client.query(`DROP TABLE IF EXISTS github_daily_progress CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS github_targets CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS system_vapid_keys CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS user_push_subscriptions CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS email_notifications CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS task_discussions CASCADE;`);

    // Ensure leetcode_url and github_url columns exist on users table
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS leetcode_url VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url VARCHAR(255);`);

    // GitHub Daily Commits table indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_student_date ON github_daily_commits(student_id, date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_date ON github_daily_commits(date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_username ON github_daily_commits(github_username);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_date_commits ON github_daily_commits(date, daily_commit_count);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_progress_status_date ON leetcode_daily_progress(status, date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_daily_user_date_status ON leetcode_daily_progress(user_id, date, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_daily_progress_date_solved ON leetcode_daily_progress(date, solved_today);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_class_dept_role ON users(class_id, department_id, role);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_regno_username ON users(register_number, username);`);

    // Clean up duplicate target configuration rows if any exist
    await client.query(`
      DELETE FROM leetcode_targets t1
      USING leetcode_targets t2
      WHERE t1.created_at < t2.created_at
        AND t1.start_date = t2.start_date
        AND t1.end_date = t2.end_date
        AND COALESCE(t1.user_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t2.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(t1.class_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t2.class_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(t1.year, -1) = COALESCE(t2.year, -1)
        AND COALESCE(t1.department_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t2.department_id, '00000000-0000-0000-0000-000000000000'::uuid);
    `);

    // ─── Module 7: Placement Skill Assessments & Mock Test Question Banks ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option INTEGER NOT NULL,
        category VARCHAR(100) NOT NULL,
        skill_tag VARCHAR(100),
        difficulty VARCHAR(20) DEFAULT 'MEDIUM',
        explanation TEXT,
        track_type VARCHAR(50) DEFAULT 'GENERAL_APTITUDE',
        track_title VARCHAR(150) DEFAULT 'General Aptitude Benchmark',
        cutoff_percentage NUMERIC(5,2) DEFAULT 60.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS student_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        student_name VARCHAR(255),
        register_number VARCHAR(100),
        total_questions INTEGER NOT NULL DEFAULT 10,
        correct_count INTEGER NOT NULL DEFAULT 0,
        score_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
        category_breakdown JSONB,
        answers_summary JSONB,
        strengths JSONB,
        gaps JSONB,
        time_taken_seconds INTEGER DEFAULT 0,
        proctor_photo_url VARCHAR(1000),
        track_type VARCHAR(50) DEFAULT 'GENERAL_APTITUDE',
        track_title VARCHAR(150) DEFAULT 'General Aptitude Benchmark',
        cutoff_percentage NUMERIC(5,2) DEFAULT 60.00,
        is_passed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS assessment_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        track_type VARCHAR(100) NOT NULL,
        track_title VARCHAR(255) NOT NULL,
        target_year VARCHAR(20) NOT NULL DEFAULT 'ALL',
        target_class_id VARCHAR(100) NOT NULL DEFAULT 'ALL',
        custom_instructions TEXT,
        deadline TIMESTAMPTZ,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_assessment_q_track ON assessment_questions(track_type, is_active);
      CREATE INDEX IF NOT EXISTS idx_student_assessments_track ON student_assessments(user_id, track_type);
      CREATE INDEX IF NOT EXISTS idx_student_assessments_created ON student_assessments(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assessment_assignments_target ON assessment_assignments(target_year, target_class_id);
    `);

    // Seed default questions if table is empty
    const qCountRes = await client.query('SELECT COUNT(*)::int as count FROM assessment_questions');
    if (qCountRes.rows[0]?.count === 0) {
      const defaultQuestions = [
        // GENERAL_APTITUDE
        {
          q: "A can finish a work in 12 days and B can finish it in 18 days. Working together, in how many days can they complete the work?",
          options: ["7.2 days", "8 days", "6.5 days", "9 days"],
          ans: 0,
          cat: "Quantitative Aptitude",
          tag: "Time and Work",
          diff: "MEDIUM",
          exp: "1/A + 1/B = 1/12 + 1/18 = (3 + 2)/36 = 5/36. Total days = 36/5 = 7.2 days.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "If the ratio of the ages of two persons is 4:5 and the sum of their ages is 45, what is the age of the elder person?",
          options: ["20", "25", "30", "35"],
          ans: 1,
          cat: "Quantitative Aptitude",
          tag: "Ratios & Proportions",
          diff: "EASY",
          exp: "Sum of parts = 4 + 5 = 9 parts. 1 part = 45 / 9 = 5. Elder person = 5 * 5 = 25 years.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "Pointing to a photograph, a man said, 'I have no brother or sister, but that man's father is my father's son.' Whose photograph was it?",
          options: ["His nephew's", "His son's", "His father's", "His own"],
          ans: 1,
          cat: "Logical Reasoning",
          tag: "Blood Relations",
          diff: "MEDIUM",
          exp: "Since he has no brother or sister, 'my father's son' is himself. So, that man's father is the speaker himself, meaning it is his son's photograph.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "Find the missing number in the series: 3, 7, 15, 31, 63, ?",
          options: ["95", "112", "127", "128"],
          ans: 2,
          cat: "Logical Reasoning",
          tag: "Number Series",
          diff: "EASY",
          exp: "Pattern: Each number is (2 * previous) + 1. 2 * 63 + 1 = 127.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "Choose the word which is most nearly OPPOSITE in meaning to 'METICULOUS':",
          options: ["Scrupulous", "Careless", "Thorough", "Detailed"],
          ans: 1,
          cat: "Verbal Ability",
          tag: "Vocabulary & Antonyms",
          diff: "EASY",
          exp: "'Meticulous' means very careful and precise. Its opposite is 'Careless'.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "Select the correctly punctuated sentence:",
          options: [
            "Despite of the rain, the match continued.",
            "Despite the rain, the match continued.",
            "In spite the rain, the match continued.",
            "Despite about the rain, the match continued."
          ],
          ans: 1,
          cat: "Verbal Ability",
          tag: "Grammar & Sentence Correction",
          diff: "EASY",
          exp: "'Despite' is a preposition used directly without 'of'. 'In spite of' is used with 'of'.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "What is the worst-case time complexity of searching an element in a balanced Binary Search Tree (AVL tree)?",
          options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
          ans: 1,
          cat: "Technical Core",
          tag: "Data Structures",
          diff: "MEDIUM",
          exp: "An AVL tree maintains height balance where height <= 1.44 log2(n). Therefore worst case search is O(log n).",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "In PostgreSQL / SQL, which clause is evaluated BEFORE the GROUP BY clause?",
          options: ["HAVING", "WHERE", "ORDER BY", "LIMIT"],
          ans: 1,
          cat: "Technical Core",
          tag: "Database & SQL",
          diff: "MEDIUM",
          exp: "SQL execution order: FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY -> LIMIT.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "A train running at 72 km/h crosses a 200m long platform in 22 seconds. What is the length of the train?",
          options: ["200m", "240m", "220m", "250m"],
          ans: 1,
          cat: "Quantitative Aptitude",
          tag: "Speed, Distance & Time",
          diff: "HARD",
          exp: "Speed = 72 * 5/18 = 20 m/s. Total distance = 20 * 22 = 440m. Train length = 440 - 200 = 240m.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        {
          q: "Which HTTP status code signifies that the client must authenticate itself to get the requested response?",
          options: ["400 Bad Request", "401 Unauthorized", "403 Forbidden", "404 Not Found"],
          ans: 1,
          cat: "Technical Core",
          tag: "Web Architecture",
          diff: "EASY",
          exp: "401 indicates lack of valid authentication credentials, whereas 403 indicates authentication is recognized but access is forbidden.",
          track: "GENERAL_APTITUDE",
          trackTitle: "General Aptitude Benchmark",
          cutoff: 60
        },
        // ZOHO_MOCK
        {
          q: "What is the output of the following Java expression? System.out.println(10 + 20 + \"Hello\" + 10 + 20);",
          options: ["30Hello30", "30Hello1020", "1020Hello1020", "Compilation Error"],
          ans: 1,
          cat: "Technical Core",
          tag: "Core Java",
          diff: "MEDIUM",
          exp: "Evaluation proceeds left to right. 10 + 20 = 30 (integer addition). 30 + 'Hello' = '30Hello' (concatenation). Then '30Hello' + 10 = '30Hello10', and + 20 = '30Hello1020'.",
          track: "ZOHO_MOCK",
          trackTitle: "Zoho Corporation Technical Mock",
          cutoff: 75
        },
        {
          q: "Given an array of integers, which algorithm finds the maximum subarray sum in O(n) time?",
          options: ["Dijkstra's Algorithm", "Kadane's Algorithm", "Floyd-Warshall", "Binary Search"],
          ans: 1,
          cat: "Technical Core",
          tag: "Algorithms",
          diff: "MEDIUM",
          exp: "Kadane's algorithm maintains maximum sum ending at current index and global maximum in linear O(n) time.",
          track: "ZOHO_MOCK",
          trackTitle: "Zoho Corporation Technical Mock",
          cutoff: 75
        },
        {
          q: "In C/C++, what is the size of an empty struct in bytes according to ANSI standard?",
          options: ["0 bytes in C and 0 in C++", "0 bytes in C and 1 byte in C++", "1 byte in C and 0 in C++", "4 bytes in both"],
          ans: 1,
          cat: "Technical Core",
          tag: "C/C++ Internals",
          diff: "HARD",
          exp: "In C standard, empty struct has undefined/zero size (GNU C allows 0 bytes). In C++, empty struct has size at least 1 byte to ensure distinct object addresses.",
          track: "ZOHO_MOCK",
          trackTitle: "Zoho Corporation Technical Mock",
          cutoff: 75
        },
        // TCS_NQT
        {
          q: "In a class of 60 students, 40% are girls. How many boys must join the class so that 75% of the class becomes boys?",
          options: ["24", "36", "60", "48"],
          ans: 1,
          cat: "Quantitative Aptitude",
          tag: "Percentages & Mixtures",
          diff: "MEDIUM",
          exp: "Girls = 40% of 60 = 24. Boys = 36. If boys become 75%, girls become 25%. 25% = 24 -> Total students = 96. Total boys needed = 72. Additional boys = 72 - 36 = 36.",
          track: "TCS_NQT",
          trackTitle: "TCS NQT Foundation Mock",
          cutoff: 65
        },
        {
          q: "What is the output of the pseudocode: Set Integer x = 5, y = 10; x = x ^ y; y = x ^ y; x = x ^ y; Print x, y",
          options: ["5, 10", "10, 5", "15, 5", "0, 15"],
          ans: 1,
          cat: "Logical Reasoning",
          tag: "Pseudocode & Bitwise",
          diff: "EASY",
          exp: "Three XOR operations between x and y swaps their values without a temporary variable. So x becomes 10 and y becomes 5.",
          track: "TCS_NQT",
          trackTitle: "TCS NQT Foundation Mock",
          cutoff: 65
        },
        // TECHNICAL_CORE
        {
          q: "Which normal form deals with removing multi-valued dependencies in relational databases?",
          options: ["2NF", "3NF", "BCNF", "4NF"],
          ans: 3,
          cat: "Technical Core",
          tag: "Database & SQL",
          diff: "HARD",
          exp: "Fourth Normal Form (4NF) ensures that a table does not contain two or more independent multi-valued dependencies.",
          track: "TECHNICAL_CORE",
          trackTitle: "Technical Core Engineering Benchmark",
          cutoff: 70
        },
        {
          q: "In JavaScript, what does `typeof null` return?",
          options: ["'null'", "'undefined'", "'object'", "'boolean'"],
          ans: 2,
          cat: "Technical Core",
          tag: "JavaScript",
          diff: "EASY",
          exp: "In JavaScript, typeof null returns 'object'. This is a well-known legacy bug from the first implementation of JavaScript.",
          track: "TECHNICAL_CORE",
          trackTitle: "Technical Core Engineering Benchmark",
          cutoff: 70
        },
        // INFOSYS_MOCK
        {
          q: "Five friends A, B, C, D, and E are sitting in a row facing North. C is sitting next to A and E. B is to the immediate right of E. D is to the left of A. Who is in the middle?",
          options: ["A", "B", "C", "D"],
          ans: 2,
          cat: "Logical Reasoning",
          tag: "Seating Arrangement",
          diff: "MEDIUM",
          exp: "Arrangement: D - A - C - E - B. C is sitting in the exact middle position.",
          track: "INFOSYS_MOCK",
          trackTitle: "Infosys Analytical Reasoning Mock",
          cutoff: 65
        }
      ];

      for (const q of defaultQuestions) {
        await client.query(`
          INSERT INTO assessment_questions 
            (question_text, options, correct_option, category, skill_tag, difficulty, explanation, track_type, track_title, cutoff_percentage)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          q.q,
          JSON.stringify(q.options),
          q.ans,
          q.cat,
          q.tag,
          q.diff,
          q.exp,
          q.track,
          q.trackTitle,
          q.cutoff
        ]);
      }
      console.log(`[Assessment] Seeded ${defaultQuestions.length} default placement questions across tracks.`);
    }

    // Seed Supreme Admin if not exists
    const adminRes = await client.query(`SELECT * FROM users WHERE role = 'SUPREME_ADMIN' LIMIT 1;`);
    if (adminRes.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, password, role, full_name)
        VALUES ('admin', $1, 'SUPREME_ADMIN', 'Supreme Administrator');
      `, [hashedPassword]);
      console.log('Supreme Admin seeded: admin / admin123');
    }

    // Seed Default Department & Classes if none exist
    const deptRes = await client.query(`SELECT id FROM departments LIMIT 1;`);
    let defaultDeptId = deptRes.rows[0]?.id;
    if (!defaultDeptId) {
      const newDeptRes = await client.query(`
        INSERT INTO departments (name) VALUES ('Information Technology') RETURNING id;
      `);
      defaultDeptId = newDeptRes.rows[0].id;
      console.log('Default Department seeded: Information Technology');
    }

    const classRes = await client.query(`SELECT id FROM classes LIMIT 1;`);
    if (classRes.rowCount === 0 && defaultDeptId) {
      const c1 = await client.query(`
        INSERT INTO classes (name, department_id, year, batch) VALUES ('III IT-A', $1, 3, '2024-2028') RETURNING id;
      `, [defaultDeptId]);
      await client.query(`
        INSERT INTO classes (name, department_id, year, batch) VALUES ('III IT-B', $1, 3, '2024-2028');
      `, [defaultDeptId]);
      await client.query(`
        INSERT INTO classes (name, department_id, year, batch) VALUES ('II IT-A', $1, 2, '2025-2029');
      `, [defaultDeptId]);
      const defaultClassId = c1.rows[0].id;

      // Assign unassigned students & coordinators to default class and department
      await client.query(`
        UPDATE users 
        SET department_id = $1, class_id = $2 
        WHERE class_id IS NULL OR department_id IS NULL;
      `, [defaultDeptId, defaultClassId]);
      console.log('Default Classes seeded & unassigned users linked.');
    } else if (defaultDeptId) {
      // Ensure existing users without class_id are linked to the first available class
      const firstClassRes = await client.query(`SELECT id FROM classes ORDER BY name ASC LIMIT 1;`);
      if (firstClassRes.rows.length > 0) {
        await client.query(`
          UPDATE users 
          SET department_id = COALESCE(department_id, $1), class_id = COALESCE(class_id, $2) 
          WHERE class_id IS NULL OR department_id IS NULL;
        `, [defaultDeptId, firstClassRes.rows[0].id]);
      }
    }

    // Update batch definitions for Year 2 (2025-2029) and Year 3 (2024-2028)
    await client.query(`UPDATE classes SET batch = '2025-2029', updated_at = NOW() WHERE year = 2;`);
    await client.query(`UPDATE classes SET batch = '2024-2028', updated_at = NOW() WHERE year = 3;`);

    // ─── 🛡️ Supabase Security & Row Level Security (RLS) Auto-Enforcement ───
    try {
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
            EXECUTE 'DROP POLICY IF EXISTS service_role_all_policy ON public.' || quote_ident(r.tablename) || ';';
            EXECUTE 'CREATE POLICY service_role_all_policy ON public.' || quote_ident(r.tablename) || ' FOR ALL TO service_role USING (true) WITH CHECK (true);';
          END LOOP;
        END $$;
      `);
      console.log('[PostgreSQL] Row Level Security (RLS) successfully enforced on all public schema tables.');
    } catch (rlsErr: any) {
      console.warn('[PostgreSQL] RLS auto-enforcement notice:', rlsErr.message);
    }

  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
    throw err;
  } finally {
    client.release();
  }
}
