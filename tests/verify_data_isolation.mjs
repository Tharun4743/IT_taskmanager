import pg from 'pg';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const DATABASE_URL = 'postgresql://postgres.pxskmtpswvpcoljkuchx:Tharun%404743@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const JWT_SECRET = 'super_secret_production_key_123!';
const API_URL = 'http://localhost:3000';

const { Pool } = pg;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTests() {
  console.log('--- ENFORCING STRICT DATA ISOLATION VERIFICATION ---');
  const client = await pool.connect();

  let deptId, classAId, classBId;
  let studentAId, studentBId, advisorAId, advisorBId, hodId;
  let tokenStudentA, tokenStudentB, tokenAdvisorA, tokenAdvisorB, tokenHOD;

  try {
    // 1. Setup fresh test data
    console.log('[1] Setting up test data in PostgreSQL...');
    await client.query("DELETE FROM users WHERE username LIKE 'test_iso_%'");
    await client.query("DELETE FROM departments WHERE name = 'Isolation Test Dept'");

    const deptRes = await client.query("INSERT INTO departments (name) VALUES ('Isolation Test Dept') RETURNING id");
    deptId = deptRes.rows[0].id;

    const classARes = await client.query("INSERT INTO classes (name, department_id, year, batch) VALUES ('Class Isolation A', $1, 3, '2024-2028') RETURNING id", [deptId]);
    classAId = classARes.rows[0].id;

    const classBRes = await client.query("INSERT INTO classes (name, department_id, year, batch) VALUES ('Class Isolation B', $1, 3, '2024-2028') RETURNING id", [deptId]);
    classBId = classBRes.rows[0].id;

    const hodRes = await client.query("INSERT INTO users (username, password, role, department_id, full_name) VALUES ('test_iso_hod', 'pass', 'HOD', $1, 'HOD') RETURNING id", [deptId]);
    hodId = hodRes.rows[0].id;

    const advARes = await client.query("INSERT INTO users (username, password, role, department_id, class_id, full_name) VALUES ('test_iso_adva', 'pass', 'CLASS_ADVISOR', $1, $2, 'Advisor A') RETURNING id", [deptId, classAId]);
    advisorAId = advARes.rows[0].id;

    const advBRes = await client.query("INSERT INTO users (username, password, role, department_id, class_id, full_name) VALUES ('test_iso_advb', 'pass', 'CLASS_ADVISOR', $1, $2, 'Advisor B') RETURNING id", [deptId, classBId]);
    advisorBId = advBRes.rows[0].id;

    const studARes = await client.query("INSERT INTO users (username, password, role, department_id, class_id, full_name, is_coordinator) VALUES ('test_iso_stua', 'pass', 'STUDENT', $1, $2, 'Student Coord A', TRUE) RETURNING id", [deptId, classAId]);
    studentAId = studARes.rows[0].id;

    const studBRes = await client.query("INSERT INTO users (username, password, role, department_id, class_id, full_name, is_coordinator) VALUES ('test_iso_stub', 'pass', 'STUDENT', $1, $2, 'Student Coord B', TRUE) RETURNING id", [deptId, classBId]);
    studentBId = studBRes.rows[0].id;

    console.log('PostgreSQL test data successfully seeded.');

    tokenStudentA = jwt.sign({ id: studentAId }, JWT_SECRET);
    tokenStudentB = jwt.sign({ id: studentBId }, JWT_SECRET);
    tokenAdvisorA = jwt.sign({ id: advisorAId }, JWT_SECRET);
    tokenAdvisorB = jwt.sign({ id: advisorBId }, JWT_SECRET);
    tokenHOD = jwt.sign({ id: hodId }, JWT_SECRET);

    console.log('\n[2] Verifying Advisor A & Coordinator A class visibility bounds...');
    let res = await fetch(`${API_URL}/api/classes`, { headers: { Authorization: `Bearer ${tokenAdvisorA}` } });
    let classesList = await res.json();
    if (classesList.length === 1 && classesList[0].id === classAId) {
      console.log('✅ PASS: Advisor A can only see Class A.');
    } else {
      console.error('❌ FAIL: Advisor A visibility check failed. Classes received:', classesList);
    }

    res = await fetch(`${API_URL}/api/classes`, { headers: { Authorization: `Bearer ${tokenStudentB}` } });
    classesList = await res.json();
    if (classesList.length === 1 && classesList[0].id === classBId) {
      console.log('✅ PASS: Student Coordinator B can only see Class B.');
    } else {
      console.error('❌ FAIL: Student Coordinator B visibility check failed. Classes received:', classesList);
    }

    console.log('\n[3] Verifying HOD task posting bounds...');
    res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHOD}` },
      body: JSON.stringify({
        title: 'Global Test Task',
        description: 'Should fail',
        class_ids: []
      })
    });
    if (res.status === 400) {
      console.log('✅ PASS: Server blocked HOD task creation with no class selected.');
    } else {
      console.error('❌ FAIL: HOD task creation without class should be blocked. Status:', res.status);
    }

    res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHOD}` },
      body: JSON.stringify({
        title: 'Class A Exclusive Task',
        description: 'Task for Class A only',
        class_ids: [classAId]
      })
    });
    const taskObj = await res.json();
    const taskId = taskObj.id;
    console.log('Created Class A task with ID:', taskId);

    console.log('\n[4] Verifying Student visibility isolation...');
    res = await fetch(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${tokenStudentA}` } });
    let tasksList = await res.json();
    const hasTaskForA = tasksList.some(t => t.id === taskId);
    
    res = await fetch(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${tokenStudentB}` } });
    tasksList = await res.json();
    const hasTaskForB = tasksList.some(t => t.id === taskId);

    if (hasTaskForA && !hasTaskForB) {
      console.log('✅ PASS: Task is visible to Class A Student, but invisible to Class B Student.');
    } else {
      console.error(`❌ FAIL: Visibility mismatch. Student A sees: ${hasTaskForA}, Student B sees: ${hasTaskForB}`);
    }

    console.log('\n[5] Verifying submission bounds (IDOR protection)...');
    res = await fetch(`${API_URL}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStudentB}` },
      body: JSON.stringify({
        task_id: taskId,
        custom_field_value: 'Illegal submission Attempt'
      })
    });
    if (res.status === 403 || res.status === 400) {
      console.log('✅ PASS: Server blocked Class B Student from submitting screenshot for Class A task.');
    } else {
      console.error('❌ FAIL: Class B Student submission check bypassed. Status:', res.status, await res.json());
    }

  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    console.log('\n[6] Cleaning up test records...');
    await client.query("DELETE FROM users WHERE username LIKE 'test_iso_%'");
    await client.query("DELETE FROM departments WHERE name = 'Isolation Test Dept'");
    client.release();
    await pool.end();
    console.log('--- Verification Finished ---');
  }
}

runTests();
