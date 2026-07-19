import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function reset() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    
    console.log('Connecting to PostgreSQL to wipe tasks and submissions...');
    const client = await pool.connect();
    
    try {
        await client.query('TRUNCATE task_classes, task_submissions, tasks CASCADE;');
        console.log('Successfully wiped Tasks and Submissions tables.');
    } catch (err) {
        console.error('Error wiping tables:', err.message);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

reset();
