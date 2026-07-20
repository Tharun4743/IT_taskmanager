import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

console.log('--- Academic Task Management System Setup Check ---');

// 1. Check Node version
console.log(`[1/3] Checking Node.js version: ${process.version}`);
const versionMajor = parseInt(process.version.slice(1).split('.')[0]);
if (versionMajor < 18) {
    console.warn('  [!] Highly recommended to use Node.js v18 or higher.');
} else {
    console.log('  [OK] Node.js version is compatible.');
}

// 2. Check node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
console.log(`[2/3] Checking node_modules: ${nodeModulesPath}`);
if (fs.existsSync(nodeModulesPath)) {
    console.log('  [OK] node_modules folder found.');
} else {
    console.error('  [ERROR] node_modules folder NOT found. Run "npm install" first.');
}

// 3. Check PostgreSQL connection
console.log('[3/3] Checking PostgreSQL connection...');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('  [ERROR] DATABASE_URL not found in .env file.');
    process.exit(1);
}

const maskedUrl = databaseUrl.replace(/\/\/.*@/, '//****:****@');
console.log(`  Connecting to: ${maskedUrl}`);

try {
    const { Client } = pg;
    const client = new Client({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('  [OK] Successfully connected to PostgreSQL.');
    
    const res = await client.query('SELECT version();');
    console.log(`  Database version: ${res.rows[0].version}`);
    
    await client.end();
} catch (error) {
    console.error(`  [ERROR] Could not connect to PostgreSQL: ${error.message}`);
    console.error('  Verify your DATABASE_URL in the .env file and check if your local PostgreSQL server is running.');
}

console.log('\nSetup check complete.');
