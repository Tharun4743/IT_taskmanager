import * as dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FATAL DATABASE ERROR: DATABASE_URL environment variable is missing!");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 6000,
  keepAlive: true,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

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

    // ─── Module 1: Task Discussion Forum ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_discussions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
        parent_id UUID REFERENCES task_discussions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        message TEXT NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_edited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_discussions_task ON task_discussions(task_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_discussions_parent ON task_discussions(parent_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_discussions_user ON task_discussions(user_id);`);
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

    // Drop legacy GitHub tables
    await client.query(`DROP TABLE IF EXISTS github_daily_progress CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS github_targets CASCADE;`);

    // Ensure leetcode_url and github_url columns exist on users table
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS leetcode_url VARCHAR(255);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url VARCHAR(255);`);

    // GitHub Daily Commits table indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_student_date ON github_daily_commits(student_id, date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_date ON github_daily_commits(date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_github_daily_commits_username ON github_daily_commits(github_username);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_progress_status_date ON leetcode_daily_progress(status, date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leetcode_daily_user_date_status ON leetcode_daily_progress(user_id, date, status);`);

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

  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
    throw err;
  } finally {
    client.release();
  }
}
