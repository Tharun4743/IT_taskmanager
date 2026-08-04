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
  max: 25,
  min: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
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
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        website VARCHAR(550),
        logo_url VARCHAR(1000),
        address TEXT,
        recruiter_name VARCHAR(255),
        recruiter_email VARCHAR(255),
        recruiter_phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        role VARCHAR(50) DEFAULT 'RECRUITER', -- 'COMPANY_HR', 'RECRUITER', 'HIRING_MANAGER'
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS placement_drives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        job_description TEXT,
        package_details VARCHAR(255),
        type VARCHAR(50) DEFAULT 'FTE', -- 'FTE', 'INTERNSHIP', 'INTERNSHIP_CUM_FTE'
        location VARCHAR(255),
        min_cgpa NUMERIC(4, 2) DEFAULT 0.0,
        max_arrears INT DEFAULT 0,
        history_arrears_allowed BOOLEAN DEFAULT TRUE,
        eligible_batches VARCHAR(255),
        last_date_to_apply TIMESTAMP,
        drive_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'OPEN', -- 'DRAFT', 'OPEN', 'CLOSED'
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drive_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_id UUID REFERENCES placement_drives(id) ON DELETE CASCADE,
        skill_name VARCHAR(255) NOT NULL,
        min_level VARCHAR(50) DEFAULT 'Beginner',
        is_mandatory BOOLEAN DEFAULT TRUE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drive_eligibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_id UUID REFERENCES placement_drives(id) ON DELETE CASCADE,
        allowed_departments TEXT[],
        allowed_years INT[],
        allowed_genders TEXT[]
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS student_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_id UUID REFERENCES placement_drives(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'APPLIED', -- 'APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'REJECTED', 'SELECTED', 'OFFER_RELEASED'
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(drive_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS application_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES student_applications(id) ON DELETE CASCADE,
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        updated_by UUID,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES student_applications(id) ON DELETE CASCADE,
        drive_id UUID REFERENCES placement_drives(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        interview_date TIMESTAMP NOT NULL,
        mode VARCHAR(50) DEFAULT 'ONLINE', -- 'ONLINE', 'OFFLINE'
        meeting_link VARCHAR(1000),
        venue VARCHAR(550),
        interviewer_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'NO_SHOW'
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS placement_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES student_applications(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        drive_id UUID REFERENCES placement_drives(id) ON DELETE CASCADE,
        ctc_package VARCHAR(255),
        offer_letter_url VARCHAR(1000),
        joining_date DATE,
        status VARCHAR(50) DEFAULT 'RELEASED', -- 'RELEASED', 'ACCEPTED', 'DECLINED'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS placement_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        overall_status VARCHAR(50) DEFAULT 'UNPLACED', -- 'UNPLACED', 'IN_PROCESS', 'PLACED'
        total_applications INT DEFAULT 0,
        total_shortlists INT DEFAULT 0,
        total_interviews INT DEFAULT 0,
        offers_received INT DEFAULT 0,
        highest_package VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
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
