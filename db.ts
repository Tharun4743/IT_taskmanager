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
  max: 20,
  idleTimeoutMillis: 30000,
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

    // Ensure gender column exists if table was already created
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);`);

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

  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
    throw err;
  } finally {
    client.release();
  }
}
