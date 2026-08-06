import { pool } from './db.js';
import * as XLSX from 'xlsx';

/**
 * Automatically generates an Excel report for tasks whose deadline has passed
 * and commits/pushes the Excel file directly to your GitHub repository.
 *
 * Requirements:
 * - GITHUB_TOKEN (Personal Access Token with repo scope)
 * - GITHUB_REPO (e.g., 'Tharun4743/IT_taskmanager')
 */
export async function autoPushExpiredTaskExcelReports() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'Tharun4743/IT_taskmanager';

  try {
    // 1. Find all tasks with expired deadlines that haven't been pushed yet
    const expiredTasksRes = await pool.query(`
      SELECT t.id, t.title, t.description, t.category, t.deadline, t.created_at,
             d.name as department_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE t.deadline IS NOT NULL
        AND t.deadline < NOW()
        AND t.excel_pushed_at IS NULL
      ORDER BY t.deadline DESC
    `);

    if (expiredTasksRes.rows.length === 0) {
      return;
    }

    console.log(`[GitHub Auto-Excel] Found ${expiredTasksRes.rows.length} expired task(s) to process.`);

    for (const task of expiredTasksRes.rows) {
      // Fetch target class names
      const classRes = await pool.query(`
        SELECT c.name FROM task_classes tc
        JOIN classes c ON tc.class_id = c.id
        WHERE tc.task_id = $1
      `, [task.id]);
      const classNames = classRes.rows.map(r => r.name).join(', ') || 'All Classes';

      // Fetch all student submissions for this task
      const subRes = await pool.query(`
        SELECT 
          u.register_number,
          u.full_name,
          c.name as class_name,
          ts.status,
          ts.submitted_at,
          ts.verified_at,
          ts.custom_field_value,
          ts.verification_note,
          ts.rejection_reason,
          ts.screenshot_url
        FROM task_submissions ts
        JOIN users u ON ts.user_id = u.id
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE ts.task_id = $1
        ORDER BY c.name ASC, u.register_number ASC
      `, [task.id]);

      // Create Excel Workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Task Summary
      const summaryData = [
        { Field: 'Task Title', Value: task.title },
        { Field: 'Category', Value: task.category },
        { Field: 'Department', Value: task.department_name || 'All' },
        { Field: 'Target Classes', Value: classNames },
        { Field: 'Deadline', Value: new Date(task.deadline).toLocaleString() },
        { Field: 'Total Submissions Logged', Value: subRes.rows.length },
        { Field: 'Report Generated At', Value: new Date().toLocaleString() }
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Task Summary');

      // Sheet 2: Student Submissions Details
      const studentData = subRes.rows.map((row, idx) => ({
        'S.No': idx + 1,
        'Register Number': row.register_number || 'N/A',
        'Student Name': row.full_name || 'N/A',
        'Class Section': row.class_name || 'N/A',
        'Status': row.status,
        'Submitted At': row.submitted_at ? new Date(row.submitted_at).toLocaleString() : 'Not Submitted',
        'Verified At': row.verified_at ? new Date(row.verified_at).toLocaleString() : '-',
        'Custom Input / Link': row.custom_field_value || '-',
        'Reviewer Note / Feedback': row.verification_note || row.rejection_reason || '-',
        'Proof Image Status': row.screenshot_url ? (row.screenshot_url === 'PURGED_EXPIRED_7D' ? 'Purged (7D Expiry)' : 'Available') : 'No Image'
      }));
      const studentSheet = XLSX.utils.json_to_sheet(studentData);
      XLSX.utils.book_append_sheet(wb, studentSheet, 'Student Submissions');

      // Convert workbook to Buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const base64Content = excelBuffer.toString('base64');

      const safeTitle = task.title.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Task_${safeTitle}_${task.id.slice(0, 8)}.xlsx`;
      const githubPath = `reports/task_reports/${filename}`;

      if (!token) {
        console.log(`[GitHub Auto-Excel] Generated Excel for task '${task.title}' locally. Set GITHUB_TOKEN & GITHUB_REPO to push directly to GitHub.`);
        // Mark as processed locally
        await pool.query(`UPDATE tasks SET excel_pushed_at = CURRENT_TIMESTAMP WHERE id = $1`, [task.id]);
        continue;
      }

      // 2. Commit and push directly to GitHub via REST API
      const url = `https://api.github.com/repos/${repo}/contents/${githubPath}`;

      // Check if file already exists to get SHA for update
      let sha: string | undefined = undefined;
      try {
        const getRes = await fetch(url, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'VSBEC-TaskManager-AutoExcel'
          }
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch (err) {
        // File doesn't exist yet, which is fine
      }

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'VSBEC-TaskManager-AutoExcel'
        },
        body: JSON.stringify({
          message: `docs: auto-generate expired task Excel report for '${task.title}'`,
          content: base64Content,
          sha: sha
        })
      });

      if (putRes.ok) {
        console.log(`[GitHub Auto-Excel] Successfully pushed Excel report '${githubPath}' to GitHub repository ${repo}!`);
        await pool.query(`UPDATE tasks SET excel_pushed_at = CURRENT_TIMESTAMP WHERE id = $1`, [task.id]);
      } else {
        const errJson = await putRes.json().catch(() => ({}));
        console.error(`[GitHub Auto-Excel Error]: Failed to push to GitHub (${putRes.status}):`, errJson);
      }
    }
  } catch (error) {
    console.error('[GitHub Auto-Excel Error]:', error);
  }
}
