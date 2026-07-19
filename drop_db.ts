import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function dropDB() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    
    console.log('Connecting to PostgreSQL to drop tables...');
    const client = await pool.connect();
    
    try {
        await client.query('DROP TABLE IF EXISTS notifications, task_submissions, task_classes, tasks, users, classes, departments CASCADE;');
        console.log('PostgreSQL database tables dropped successfully!');
    } catch (err: any) {
        console.error('Error dropping tables:', err.message);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

dropDB();
