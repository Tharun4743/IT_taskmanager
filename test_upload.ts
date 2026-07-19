import fs from 'fs';

async function testUpload() {
    console.log('--- STARTING POSTGRESQL + CLOUDINARY TEST ---');

    // 1. Login
    console.log('\n[1] Logging in as PRANESH (Reg: 922523205126)...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '922523205126', password: '922523205126' })
    });

    if (!loginRes.ok) {
        console.error('Login Failed', await loginRes.text());
        process.exit(1);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login successful. Received JWT token.');

    // 2. Fetch Tasks
    console.log('\n[2] Fetching assigned tasks...');
    const tasksRes = await fetch('http://localhost:3000/api/tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const tasks = await tasksRes.json();
    if (tasks.length === 0) {
        console.error('No tasks found!');
        process.exit(1);
    }

    const task = tasks[0];
    console.log(`✅ Found ${tasks.length} tasks. Selecting Task ID: ${task.id} ("${task.title}")`);

    // 3. Upload File to Cloudinary
    console.log('\n[3] Uploading dummy image to Cloudinary via server...');

    const formData = new FormData();
    formData.append('task_id', task.id);

    const imageBuffer = fs.readFileSync('./test_image.png');
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('screenshot', blob, 'test_image.png');

    const uploadRes = await fetch('http://localhost:3000/api/submissions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData as any
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
        console.error('❌ Upload Failed:', uploadData);
        process.exit(1);
    }
    console.log(`✅ Upload successful! Submission ID: ${uploadData.id}`);

    // 4. Fetch the Submission to get the Cloudinary URL
    console.log('\n[4] Fetching submission to verify Cloudinary URL...');
    const subsRes = await fetch('http://localhost:3000/api/submissions', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const subs = await subsRes.json();
    const mySub = subs.find((s: any) => s.id === uploadData.id);

    if (mySub && mySub.screenshot_url) {
        console.log(`✅ Verified! Cloudinary URL retrieved from PostgreSQL:`);
        console.log(`   👉 ${mySub.screenshot_url}`);
        if (mySub.screenshot_url.includes('cloudinary.com')) {
            console.log('\n🎉 CLOUDINARY UPLOAD AND POSTGRESQL STORAGE WORKS PERFECTLY!');
        } else {
            console.log('\n⚠️ WARNING: The URL does not look like a Cloudinary URL.');
        }
    } else {
        console.error('❌ Failed to find the submission or screenshot URL in the database.');
    }
}

testUpload().catch(console.error);
