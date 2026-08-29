import { v2 as cloudinary } from 'cloudinary';
import { pool } from './db.js';

/**
 * Clears Cloudinary proof screenshots older than 30 days from verification or task deadline,
 * while keeping student profile photos, task posters, marks, and verification records 100% safe and intact.
 */
export async function cleanupOnlyTaskScreenshots() {
  console.log('[Image Cleanup] Checking for task proof screenshots older than 30 days...');
  try {
    // Select task proof screenshots from task_submissions joined with tasks
    // ONLY target task_submissions.cloudinary_public_id
    // NEVER target users.avatar_url or tasks.poster_cloudinary_public_id
    const result = await pool.query(`
      SELECT ts.id, ts.cloudinary_public_id
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      WHERE ts.cloudinary_public_id IS NOT NULL
        AND ts.status IN ('VERIFIED', 'REJECTED')
        AND (
          ts.verified_at < NOW() - INTERVAL '30 days'
          OR t.deadline < NOW() - INTERVAL '30 days'
        )
    `);

    if (result.rows.length === 0) {
      console.log('[Image Cleanup] No eligible proof screenshots to purge.');
      return 0;
    }

    console.log(`[Image Cleanup] Found ${result.rows.length} proof screenshot(s) older than 30 days to purge.`);

    let purgedCount = 0;
    for (const row of result.rows) {
      if (row.cloudinary_public_id) {
        try {
          // Delete screenshot asset from Cloudinary CDN
          await cloudinary.uploader.destroy(row.cloudinary_public_id);
        } catch (cloudinaryErr) {
          console.error(`[Image Cleanup] Error deleting Cloudinary public_id ${row.cloudinary_public_id}:`, cloudinaryErr);
        }

        // Clear public_id & update screenshot_url in task_submissions table ONLY
        await pool.query(`
          UPDATE task_submissions
          SET screenshot_url = 'PURGED_EXPIRED_30D',
              cloudinary_public_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [row.id]);

        purgedCount++;
      }
    }

    console.log(`[Image Cleanup] Successfully purged ${purgedCount} task proof screenshots.`);
    return purgedCount;
  } catch (error) {
    console.error('[Image Cleanup Error]:', error);
    return 0;
  }
}
