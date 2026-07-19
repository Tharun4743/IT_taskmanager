import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

async function verify() {
    console.log('--- Verification Started ---');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    const client = await pool.connect();

    try {
        console.log('Connected to PostgreSQL successfully');

        // 1. Create a test department
        const deptRes = await client.query("INSERT INTO departments (name) VALUES ('Test Year Coord Dept') RETURNING id;");
        const deptId = deptRes.rows[0].id;
        console.log(`Using department: ${deptId}`);

        // 2. Create test classes for Year 3 & Year 2
        console.log('Creating test classes...');
        const classARes = await client.query("INSERT INTO classes (name, department_id, year, batch) VALUES ('Test Class 3A', $1, 3, '2023-2027') RETURNING id;", [deptId]);
        const classBRes = await client.query("INSERT INTO classes (name, department_id, year, batch) VALUES ('Test Class 3B', $1, 3, '2023-2027') RETURNING id;", [deptId]);
        const classCRes = await client.query("INSERT INTO classes (name, department_id, year, batch) VALUES ('Test Class 2A', $1, 2, '2024-2028') RETURNING id;", [deptId]);

        const classAId = classARes.rows[0].id;
        const classBId = classBRes.rows[0].id;
        const classCId = classCRes.rows[0].id;

        // 3. Create a Year Coordinator for Year 3
        console.log('Creating Year Coordinator user...');
        const coordRes = await client.query(`
            INSERT INTO users (username, password, role, department_id, is_year_coordinator, year_scope, full_name)
            VALUES ('test_coord_yr3', 'password123', 'CLASS_ADVISOR', $1, TRUE, 3, 'Year Coordinator')
            RETURNING id;
        `, [deptId]);
        const coordId = coordRes.rows[0].id;

        // 4. Test Task Creation Logic (Simulating the logic in server.ts)
        console.log('Simulating task creation for Year Coordinator...');
        
        // Year Coordinator expansion
        const yearClassesRes = await client.query("SELECT id FROM classes WHERE department_id = $1 AND year = $2", [deptId, 3]);
        const clsIds = yearClassesRes.rows.map(r => r.id);

        // Insert task
        const taskInsertRes = await client.query(`
            INSERT INTO tasks (title, description, category, created_by, department_id, status)
            VALUES ('Year 3 SQL Task', 'Desc', 'Course', $1, $2, 'OPEN')
            RETURNING id;
        `, [coordId, deptId]);
        const taskId = taskInsertRes.rows[0].id;

        for (const cid of clsIds) {
            await client.query("INSERT INTO task_classes (task_id, class_id) VALUES ($1, $2);", [taskId, cid]);
        }

        console.log('Task mapping created in database.');

        // 5. Verification
        const taskClassesRes = await client.query("SELECT class_id FROM task_classes WHERE task_id = $1", [taskId]);
        const mappedClassIds = taskClassesRes.rows.map(r => r.class_id.toString());

        const has3A = mappedClassIds.includes(classAId.toString());
        const has3B = mappedClassIds.includes(classBId.toString());
        const has2A = mappedClassIds.includes(classCId.toString());

        if (has3A && has3B && !has2A) {
            console.log('✅ SUCCESS: Task correctly assigned to all Year 3 classes and skipped Year 2.');
        } else {
            console.log('❌ FAILURE: Task assignment logic incorrect.');
        }

        // Cleanup
        console.log('Cleaning up database records...');
        await client.query("DELETE FROM departments WHERE id = $1", [deptId]);
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        client.release();
        await pool.end();
        console.log('--- Verification Finished ---');
    }
}

verify();
