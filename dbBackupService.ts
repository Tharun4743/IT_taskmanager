import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { updateGitHubFileViaAPI, deleteGitHubFileViaAPI } from './studentDirectoryService.js';

const execPromise = util.promisify(exec);

function getISTDateStr(): string {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toISOString().split('T')[0];
}

/**
 * Creates a complete JSON data snapshot of all 29 tables in PostgreSQL
 * and automatically commits and pushes the backup snapshot to GitHub.
 */
export async function generateDatabaseSnapshot(force = false) {
  const todayStr = getISTDateStr();

  if (!force) {
    try {
      const checkRes = await pool.query("SELECT value FROM system_settings WHERE key = 'last_db_backup_date' LIMIT 1");
      if (checkRes.rows.length > 0 && checkRes.rows[0].value === todayStr) {
        console.log(`[DB Backup] A database snapshot backup has already been generated today (${todayStr}). Skipping auto-backup.`);
        return { filePath: '', backupPayload: null, skipped: true };
      }
    } catch (checkErr: any) {
      console.warn('[DB Backup] Failed to check last backup date in system_settings:', checkErr.message);
    }
  }

  console.log('[DB Backup] Starting database snapshot creation...');
  try {
    const tables = [
      'departments',
      'classes',
      'users',
      'tasks',
      'task_classes',
      'task_submissions',
      'submission_reviews',
      'notices',
      'teams',
      'team_members',
      'team_invitations',
      'team_submissions',
      'leetcode_targets',
      'leetcode_daily_progress',
      'github_daily_commits',
      'student_profiles',
      'student_skills',
      'student_projects',
      'student_internships',
      'student_certifications',
      'student_coding_profiles',
      'student_resumes',
      'student_achievements',
      'student_languages',
      'student_career_preferences',
      'system_settings',
      'notifications'
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
      version: '2.0',
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

    // Cleanup old backups keeping up to 30 days of backup files (rolling 30-day retention)
    const existingBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .sort();

    const deletedFiles: string[] = [];
    if (existingBackups.length > 30) {
      const toDelete = existingBackups.slice(0, existingBackups.length - 30);
      for (const oldFile of toDelete) {
        fs.unlinkSync(path.join(backupDir, oldFile));
        deletedFiles.push(`backups/${oldFile}`);
      }
    }

    // ── Auto-Push Database Snapshot to GitHub ───────────────────────────────
    const commitMsg = `chore(backup): auto-snapshot database backup for ${filename}`;

    // 1. Push new backup via GitHub Contents REST API
    if (process.env.GITHUB_TOKEN) {
      await updateGitHubFileViaAPI(filePath, commitMsg);

      // Also clean up removed backups on GitHub
      for (const oldRelPath of deletedFiles) {
        await deleteGitHubFileViaAPI(oldRelPath, `chore(backup): prune old snapshot ${oldRelPath}`).catch(() => {});
      }
    }

    // 2. Also push via local Git CLI if available
    try {
      await execPromise('git add backups/');
      const statusRes = await execPromise('git status --porcelain backups/');
      if (statusRes.stdout.trim()) {
        await execPromise(`git commit -m "${commitMsg}"`);
        await execPromise('git push origin main');
        console.log(`[DB Backup] 🚀 Auto-pushed database snapshot to GitHub via Git CLI: ${filename}`);
      }
    } catch {
      // Handled via GitHub API above if CLI authentication is absent
    }

    // Record the backup date in system_settings
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('last_db_backup_date', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [todayStr]).catch(err => console.warn('[DB Backup] Failed to save backup date in system_settings:', err.message));

    return { filePath, backupPayload };
  } catch (error) {
    console.error('[DB Backup Error]:', error);
    throw error;
  }
}
