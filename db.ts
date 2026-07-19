import * as dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/academic_tasks';

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

export async function initDB() {
  const client = await pool.connect();
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
        must_change_password BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_email UNIQUE (email),
        CONSTRAINT unique_register UNIQUE (register_number)
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

    // Schema Migrations
    await client.query(`
      ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255);
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_task_user ON task_submissions(task_id, user_id);`);

    // Seed Supreme Admin if not exists
    const adminRes = await client.query(`SELECT * FROM users WHERE role = 'SUPREME_ADMIN' LIMIT 1;`);
    if (adminRes.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, password, role, full_name, must_change_password)
        VALUES ('admin', $1, 'SUPREME_ADMIN', 'Supreme Administrator', FALSE);
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
