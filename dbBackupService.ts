import { pool } from './db.js';
import fs from 'fs';
import path from 'path';

/**
 * Creates a complete JSON data snapshot of all core tables in PostgreSQL.
 * Useful for daily automated backups, manual emergency exports, and offline archival.
 */
export async function generateDatabaseSnapshot() {
  console.log('[DB Backup] Starting database snapshot creation...');
  try {
    const tables = [
      'departments',
      'classes',
      'users',
      'tasks',
      'task_classes',
      'task_submissions',
      'submission_reviews'
    ];

    const snapshotData: Record<string, any[]> = {};

    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT * FROM ${table}`);
        // Omit sensitive password hashes from backup JSON for security
        if (table === 'users') {
          snapshotData[table] = res.rows.map(row => {
            const { password, ...safeUser } = row;
            return safeUser;
          });
        } else {
          snapshotData[table] = res.rows;
        }
      } catch (tableErr: any) {
        console.warn(`[DB Backup] Table ${table} export warning:`, tableErr.message);
        snapshotData[table] = [];
      }
    }

    const backupPayload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      record_counts: Object.fromEntries(Object.entries(snapshotData).map(([k, v]) => [k, v.length])),
      data: snapshotData
    };

    // Ensure backups directory exists
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename = `db_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(backupDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf-8');
    console.log(`[DB Backup] Database snapshot created successfully at ${filePath}`);

    // Cleanup old backups keeping only the 7 most recent backup files
    const existingBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .sort();

    if (existingBackups.length > 7) {
      const toDelete = existingBackups.slice(0, existingBackups.length - 7);
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.join(backupDir, oldFile));
      }
    }

    return { filePath, backupPayload };
  } catch (error) {
    console.error('[DB Backup Error]:', error);
    throw error;
  }
}
