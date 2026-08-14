import dotenv from 'dotenv';
dotenv.config();

import { pool } from './db.js';

export function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

export function getAdminChatId(): string {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || '';
}

export function getPortalUrl(): string {
  return process.env.FRONTEND_URL || 'https://it-taskmanager.onrender.com';
}

export function getWatermarkHtml(): string {
  return `\n─────────────────────────\n👨‍💻 Developed and maintained by <a href="https://tharunkumark4743.netlify.app/">Tharunkumar K</a>\n🏛️ <i>Department of Information Technology, VSB Engineering College</i>`;
}

export function getISTDateStr(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
}

export function getWeekRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

export async function getGroupChatId(): Promise<string | null> {
  try {
    const res = await pool.query(`SELECT value FROM system_settings WHERE key = 'telegram_group_chat_id' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value && res.rows[0].value.trim()) {
      return res.rows[0].value.trim();
    }
  } catch (err) {
    console.warn('[Telegram] Could not read group chat ID from system_settings:', err);
  }
  return process.env.TELEGRAM_GROUP_CHAT_ID || null;
}

export async function setGroupChatId(chatId: string): Promise<void> {
  await pool.query(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('telegram_group_chat_id', $1, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
  `, [chatId]);
}

/**
 * Escape HTML special characters to prevent message formatting errors
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Visual Progress Bar generator for Reports e.g. [██████░░░░] 60%
 */
export function makeProgressBar(completed: number, total: number, size = 10): string {
  if (total <= 0) return '[░░░░░░░░░░] 0%';
  const ratio = Math.min(Math.max(completed / total, 0), 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  const percentage = Math.round(ratio * 100);
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

/**
 * Low-level message sender using Telegram Bot API with HTML mode & error recovery
 */
export async function sendTelegramMessage(
  chatId: string | number,
  htmlText: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any; disable_web_page_preview?: boolean } = {}
): Promise<{ ok: boolean; description?: string; result?: any }> {
  const token = getBotToken();
  if (!token) {
    console.warn('[Telegram] Cannot send message: No bot token configured.');
    return { ok: false, description: 'No bot token configured in environment variables.' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: options.parse_mode || 'HTML',
        disable_web_page_preview: options.disable_web_page_preview ?? true,
        reply_markup: options.reply_markup
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error(`[Telegram] Failed to send to ${chatId}:`, data.description);
    }
    return data;
  } catch (err: any) {
    console.error(`[Telegram] Error sending message to ${chatId}:`, err.message);
    return { ok: false, description: err.message };
  }
}

/**
 * Answer inline callback queries from button clicks
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ''
      })
    });
  } catch {}
}

/**
 * Registers native Telegram command menu
 */
export async function registerBotCommandsMenu(): Promise<void> {
  const token = getBotToken();
  if (!token) return;
  try {
    const commands = [
      { command: 'menu', description: 'Interactive Quick-Action Menu' },
      { command: 'tasks', description: 'View your pending assignments & deadlines' },
      { command: 'leetcode', description: 'Check LeetCode solved count & targets' },
      { command: 'github', description: 'Check GitHub commits & targets' },
      { command: 'stats', description: 'Your overall performance scorecard' },
      { command: 'leaderboard', description: 'Class & department top performers' },
      { command: 'defaulters', description: 'List students with pending targets (Staff)' },
      { command: 'status', description: 'Check linked student account' },
      { command: 'link', description: 'Connect account (/link <reg_no>)' },
      { command: 'help', description: 'Bot commands & help guide' }
    ];

    const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    const resData = await response.json();
    if (resData.ok) {
      console.log('[Telegram Bot] Successfully registered native command menu.');
    }
  } catch (err: any) {
    console.warn('[Telegram Bot] Could not register command menu:', err.message);
  }
}

/**
 * Generates an interactive keyboard with one-tap action buttons
 */
export function getInteractiveMenuKeyboard(role?: string) {
  const portalUrl = getPortalUrl();
  const rows: any[] = [
    [
      { text: '📋 My Tasks', callback_data: 'cb_tasks' },
      { text: '🧩 LeetCode', callback_data: 'cb_leetcode' }
    ],
    [
      { text: '💻 GitHub', callback_data: 'cb_github' },
      { text: '📊 My Scorecard', callback_data: 'cb_stats' }
    ],
    [
      { text: '🏆 Leaderboard', callback_data: 'cb_leaderboard' },
      { text: '🌐 Open Portal', url: portalUrl }
    ]
  ];

  if (role && (role === 'SUPREME_ADMIN' || role === 'STAFF' || role === 'COORDINATOR')) {
    rows.push([
      { text: '⚠️ Today\'s Defaulters', callback_data: 'cb_defaulters' },
      { text: '📢 Group Summary', callback_data: 'cb_summary' }
    ]);
  }

  return { inline_keyboard: rows };
}

/**
 * 🧩 LeetCode Card for a Student
 */
export async function getStudentLeetCodeCard(user: any): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();
  const week = getWeekRange(dateStr);

  // 1. Fetch Daily Progress
  const dailyRes = await pool.query(`
    SELECT solved_today, solved_yesterday, total_solved, status
    FROM leetcode_daily_progress
    WHERE user_id = $1 AND date = $2
    LIMIT 1
  `, [user.id, dateStr]);
  const daily = dailyRes.rows[0];

  // 2. Fetch Weekly Progress
  const weeklyRes = await pool.query(`
    SELECT SUM(solved_today) as solved_week
    FROM leetcode_daily_progress
    WHERE user_id = $1 AND date >= $2 AND date <= $3
  `, [user.id, week.start, week.end]);
  const solvedWeek = Number(weeklyRes.rows[0]?.solved_week) || 0;

  // 3. Fetch Target
  const targetRes = await pool.query(`
    SELECT daily_target, weekly_target
    FROM leetcode_targets
    WHERE start_date <= $1 AND end_date >= $1
      AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
    ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
    LIMIT 1
  `, [dateStr, user.id, user.class_id]);
  const target = targetRes.rows[0] || { daily_target: 0, weekly_target: 0 };

  const solvedToday = daily?.total_solved !== null && daily?.total_solved !== undefined ? Number(daily.solved_today) : 0;
  const totalSolved = daily?.total_solved ? Number(daily.total_solved) : 0;
  const dailyTarget = Number(target.daily_target) || 0;
  const weeklyTarget = Number(target.weekly_target) || 0;

  const dailyProgress = dailyTarget > 0 ? makeProgressBar(solvedToday, dailyTarget, 8) : 'No Target Set';
  const weeklyProgress = weeklyTarget > 0 ? makeProgressBar(solvedWeek, weeklyTarget, 8) : 'No Target Set';

  const isCompleted = dailyTarget > 0 && solvedToday >= dailyTarget;
  const statusEmoji = isCompleted ? '✅ <b>COMPLETED</b> 🎉' : (dailyTarget > 0 ? '⏳ <b>IN PROGRESS</b>' : '⚪ <i>No Target</i>');

  let html = `🧩 <b>LEETCODE PERFORMANCE CARD</b>\n`;
  html += `👤 <b>${escapeHtml(user.full_name)}</b> (<code>${escapeHtml(user.register_number)}</code>)\n`;
  html += `🏫 <b>Class:</b> ${escapeHtml(user.class_name || 'IT Department')}\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  html += `🎯 <b>Today's Daily Target:</b> ${dailyTarget} problem(s)\n`;
  html += `⚡ <b>Solved Today:</b> <b>${solvedToday}</b> / ${dailyTarget}\n`;
  html += `📈 <b>Daily Progress:</b> ${dailyProgress}\n`;
  html += `📌 <b>Daily Status:</b> ${statusEmoji}\n\n`;

  html += `🗓️ <b>Weekly Target:</b> ${weeklyTarget} problem(s)\n`;
  html += `📊 <b>Solved This Week:</b> <b>${solvedWeek}</b> / ${weeklyTarget}\n`;
  html += `📉 <b>Weekly Progress:</b> ${weeklyProgress}\n\n`;

  if (totalSolved > 0) {
    html += `🏆 <b>Total Lifetime Solved:</b> <b>${totalSolved}</b> problems\n`;
  }
  if (user.leetcode_url) {
    html += `🔗 <a href="${escapeHtml(user.leetcode_url)}">View Profile on LeetCode</a>\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh LeetCode', callback_data: 'cb_leetcode' },
        { text: '💻 View GitHub', callback_data: 'cb_github' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 💻 GitHub Card for a Student
 */
export async function getStudentGitHubCard(user: any): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();
  const week = getWeekRange(dateStr);

  // 1. Fetch Daily Progress
  const dailyRes = await pool.query(`
    SELECT commits_today, new_repos_today, total_repos, commit_status, repo_status, sync_status
    FROM github_daily_progress
    WHERE user_id = $1 AND date = $2
    LIMIT 1
  `, [user.id, dateStr]);
  const daily = dailyRes.rows[0];

  // 2. Fetch Weekly Commits
  const weeklyRes = await pool.query(`
    SELECT SUM(commits_today) as commits_week, SUM(new_repos_today) as repos_week
    FROM github_daily_progress
    WHERE user_id = $1 AND date >= $2 AND date <= $3
  `, [user.id, week.start, week.end]);
  const commitsWeek = Number(weeklyRes.rows[0]?.commits_week) || 0;

  // 3. Fetch Target
  const targetRes = await pool.query(`
    SELECT daily_commit_target, weekly_commit_target, daily_repo_target, weekly_repo_target
    FROM github_targets
    WHERE start_date <= $1 AND end_date >= $1
      AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
    ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
    LIMIT 1
  `, [dateStr, user.id, user.class_id]);
  const target = targetRes.rows[0] || { daily_commit_target: 0, weekly_commit_target: 0, daily_repo_target: 0, weekly_repo_target: 0 };

  const commitsToday = daily?.sync_status === 'SUCCESS' ? Number(daily.commits_today) : 0;
  const newReposToday = daily?.sync_status === 'SUCCESS' ? Number(daily.new_repos_today) : 0;
  const totalRepos = daily?.total_repos ? Number(daily.total_repos) : 0;

  const commitTarget = Number(target.daily_commit_target) || 0;
  const weeklyCommitTarget = Number(target.weekly_commit_target) || 0;

  const commitProgress = commitTarget > 0 ? makeProgressBar(commitsToday, commitTarget, 8) : 'No Target Set';
  const weeklyCommitProgress = weeklyCommitTarget > 0 ? makeProgressBar(commitsWeek, weeklyCommitTarget, 8) : 'No Target Set';

  const isCompleted = commitTarget > 0 && commitsToday >= commitTarget;
  const statusEmoji = isCompleted ? '✅ <b>COMPLETED</b> 🎉' : (commitTarget > 0 ? '⏳ <b>IN PROGRESS</b>' : '⚪ <i>No Target</i>');

  let html = `💻 <b>GITHUB PERFORMANCE CARD</b>\n`;
  html += `👤 <b>${escapeHtml(user.full_name)}</b> (<code>${escapeHtml(user.register_number)}</code>)\n`;
  html += `🏫 <b>Class:</b> ${escapeHtml(user.class_name || 'IT Department')}\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  html += `🎯 <b>Daily Commit Target:</b> ${commitTarget} commit(s)\n`;
  html += `⚡ <b>Commits Today:</b> <b>${commitsToday}</b> / ${commitTarget}\n`;
  html += `📈 <b>Commit Progress:</b> ${commitProgress}\n`;
  html += `📌 <b>Commit Status:</b> ${statusEmoji}\n\n`;

  html += `🗓️ <b>Weekly Commit Target:</b> ${weeklyCommitTarget} commit(s)\n`;
  html += `📊 <b>Commits This Week:</b> <b>${commitsWeek}</b> / ${weeklyCommitTarget}\n`;
  html += `📉 <b>Weekly Progress:</b> ${weeklyCommitProgress}\n\n`;

  if (totalRepos > 0 || newReposToday > 0) {
    html += `📦 <b>Total Repositories:</b> <b>${totalRepos}</b> (<b>+${newReposToday}</b> today)\n`;
  }
  if (user.github_url) {
    html += `🔗 <a href="${escapeHtml(user.github_url)}">View Profile on GitHub</a>\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh GitHub', callback_data: 'cb_github' },
        { text: '🧩 View LeetCode', callback_data: 'cb_leetcode' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 📊 Comprehensive Student Scorecard
 */
export async function getStudentStatsCard(user: any): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();

  // LeetCode stats
  const lcRes = await pool.query(`SELECT solved_today, total_solved FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]);
  const lcSolved = lcRes.rows[0]?.total_solved ? Number(lcRes.rows[0].solved_today) : 0;
  const lcTotal = lcRes.rows[0]?.total_solved ? Number(lcRes.rows[0].total_solved) : 0;

  // GitHub stats
  const ghRes = await pool.query(`SELECT commits_today, total_repos FROM github_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]);
  const ghCommits = Number(ghRes.rows[0]?.commits_today) || 0;
  const ghRepos = Number(ghRes.rows[0]?.total_repos) || 0;

  // Tasks stats
  const tasksRes = await pool.query(`
    SELECT 
      COUNT(t.id) as total_assigned,
      COUNT(ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_tasks
    FROM task_classes tc
    JOIN tasks t ON t.id = tc.task_id
    LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
    WHERE tc.class_id = $2 AND t.status = 'OPEN'
  `, [user.id, user.class_id]);
  const totalTasks = Number(tasksRes.rows[0]?.total_assigned) || 0;
  const completedTasks = Number(tasksRes.rows[0]?.completed_tasks) || 0;
  const pendingTasks = Math.max(0, totalTasks - completedTasks);

  let html = `📊 <b>STUDENT PERFORMANCE SCORECARD</b>\n`;
  html += `👤 <b>${escapeHtml(user.full_name)}</b>\n`;
  html += `🆔 <b>Register No:</b> <code>${escapeHtml(user.register_number)}</code>\n`;
  html += `🏫 <b>Section:</b> ${escapeHtml(user.class_name || 'IT Section')}\n`;
  html += `─────────────────────────\n\n`;

  html += `🧩 <b>LeetCode Activity:</b>\n`;
  html += `   • Solved Today: <b>${lcSolved}</b> problems\n`;
  html += `   • Total Solved: <b>${lcTotal}</b> problems\n\n`;

  html += `💻 <b>GitHub Activity:</b>\n`;
  html += `   • Commits Today: <b>${ghCommits}</b> commits\n`;
  html += `   • Total Repositories: <b>${ghRepos}</b>\n\n`;

  html += `📋 <b>Assignments & Tasks:</b>\n`;
  html += `   • Completed: <b>${completedTasks}</b> / ${totalTasks}\n`;
  html += `   • Pending: <b>${pendingTasks}</b> assignment(s)\n`;
  if (totalTasks > 0) {
    html += `   • Progress: ${makeProgressBar(completedTasks, totalTasks, 8)}\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🧩 LeetCode Details', callback_data: 'cb_leetcode' },
        { text: '💻 GitHub Details', callback_data: 'cb_github' }
      ],
      [
        { text: '📋 View Pending Tasks', callback_data: 'cb_tasks' },
        { text: '🏆 Leaderboard', callback_data: 'cb_leaderboard' }
      ],
      [
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 🏆 Leaderboard Card: Top Solvers & Committers
 */
export async function getLeaderboardCard(classId?: string, className?: string): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();

  // Top 5 LeetCode solvers today
  let lcQuery = `
    SELECT u.full_name, u.register_number, lp.solved_today
    FROM leetcode_daily_progress lp
    JOIN users u ON u.id = lp.user_id
    WHERE lp.date = $1 AND lp.solved_today > 0
  `;
  const lcParams: any[] = [dateStr];
  if (classId) {
    lcParams.push(classId);
    lcQuery += ` AND u.class_id = $${lcParams.length}`;
  }
  lcQuery += ` ORDER BY lp.solved_today DESC, u.full_name ASC LIMIT 5`;
  const topLcRes = await pool.query(lcQuery, lcParams);

  // Top 5 GitHub committers today
  let ghQuery = `
    SELECT u.full_name, u.register_number, gp.commits_today
    FROM github_daily_progress gp
    JOIN users u ON u.id = gp.user_id
    WHERE gp.date = $1 AND gp.commits_today > 0 AND gp.sync_status = 'SUCCESS'
  `;
  const ghParams: any[] = [dateStr];
  if (classId) {
    ghParams.push(classId);
    ghQuery += ` AND u.class_id = $${ghParams.length}`;
  }
  ghQuery += ` ORDER BY gp.commits_today DESC, u.full_name ASC LIMIT 5`;
  const topGhRes = await pool.query(ghQuery, ghParams);

  const scopeTitle = className ? `Section ${className}` : 'Department of Information Technology';
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  let html = `🏆 <b>TODAY'S TOP PERFORMERS LEADERBOARD</b>\n`;
  html += `🏛️ <i>${escapeHtml(scopeTitle)}</i>\n`;
  html += `📅 <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  html += `🧩 <b>Top LeetCode Solvers Today:</b>\n`;
  if (topLcRes.rows.length === 0) {
    html += `<i>No submissions recorded yet today. Be the first to solve!</i>\n`;
  } else {
    topLcRes.rows.forEach((r, idx) => {
      html += `${medals[idx]} <b>${escapeHtml(r.full_name)}</b> (<code>${escapeHtml(r.register_number)}</code>) — <b>${r.solved_today}</b> solved\n`;
    });
  }

  html += `\n💻 <b>Top GitHub Committers Today:</b>\n`;
  if (topGhRes.rows.length === 0) {
    html += `<i>No commits recorded yet today. Make your first commit!</i>\n`;
  } else {
    topGhRes.rows.forEach((r, idx) => {
      html += `${medals[idx]} <b>${escapeHtml(r.full_name)}</b> (<code>${escapeHtml(r.register_number)}</code>) — <b>${r.commits_today}</b> commits\n`;
    });
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Leaderboard', callback_data: 'cb_leaderboard' },
        { text: '📊 My Scorecard', callback_data: 'cb_stats' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * ⚠️ Defaulters Card (For Faculty/Admins)
 */
export async function getDefaultersCard(scopeText?: string): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();

  let query = `
    SELECT u.full_name, u.register_number, c.name as class_name,
           COALESCE(lp.solved_today, 0) as solved_today,
           COALESCE(lt.daily_target, 0) as leetcode_target,
           COALESCE(gp.commits_today, 0) as commits_today,
           COALESCE(gt.daily_commit_target, 0) as github_target
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
    LEFT JOIN leetcode_targets lt ON lt.start_date <= $1 AND lt.end_date >= $1 AND (lt.class_id = u.class_id OR lt.class_id IS NULL)
    LEFT JOIN github_daily_progress gp ON gp.user_id = u.id AND gp.date = $1
    LEFT JOIN github_targets gt ON gt.start_date <= $1 AND gt.end_date >= $1 AND (gt.class_id = u.class_id OR gt.class_id IS NULL)
    WHERE u.role = 'STUDENT'
  `;
  const params: any[] = [dateStr];

  if (scopeText) {
    params.push(`%${scopeText.trim()}%`);
    query += ` AND (c.name ILIKE $${params.length} OR c.batch ILIKE $${params.length})`;
  }

  query += ` ORDER BY c.name ASC, u.register_number ASC`;

  const res = await pool.query(query, params);
  const defaulters: any[] = [];

  for (const row of res.rows) {
    const lcTarget = Number(row.leetcode_target) || 0;
    const ghTarget = Number(row.github_target) || 0;
    const lcSolved = Number(row.solved_today) || 0;
    const ghCommits = Number(row.commits_today) || 0;

    const lcPending = lcTarget > 0 && lcSolved < lcTarget;
    const ghPending = ghTarget > 0 && ghCommits < ghTarget;

    if (lcPending || ghPending) {
      defaulters.push({
        name: row.full_name,
        regNo: row.register_number,
        className: row.class_name || 'Unassigned',
        lcStatus: lcTarget > 0 ? `${lcSolved}/${lcTarget} LC` : '',
        ghStatus: ghTarget > 0 ? `${ghCommits}/${ghTarget} GH` : ''
      });
    }
  }

  let html = `⚠️ <b>TODAY'S TARGET DEFAULTER REPORT</b>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  if (scopeText) html += `🔍 <b>Filter:</b> <code>${escapeHtml(scopeText)}</code>\n`;
  html += `👥 <b>Total Defaulters:</b> <b>${defaulters.length}</b> student(s)\n`;
  html += `─────────────────────────\n\n`;

  if (defaulters.length === 0) {
    html += `🎉 <b>Awesome! All students have completed their daily targets today!</b>\n`;
  } else {
    defaulters.slice(0, 25).forEach((d, i) => {
      const statusParts = [d.lcStatus, d.ghStatus].filter(Boolean).join(' | ');
      html += `${i + 1}. <b>${escapeHtml(d.name)}</b> (<code>${escapeHtml(d.regNo)}</code>) [${escapeHtml(d.className)}]\n`;
      html += `   ⏳ Pending: <code>${escapeHtml(statusParts)}</code>\n`;
    });

    if (defaulters.length > 25) {
      html += `\n<i>...and ${defaulters.length - 25} more students.</i>\n`;
    }
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Defaulters', callback_data: 'cb_defaulters' },
        { text: '📢 Group Summary', callback_data: 'cb_summary' }
      ],
      [
        { text: '🌐 Open Admin Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 📋 Tasks Card for a Student
 */
export async function getTasksCard(user: any): Promise<{ html: string; keyboard: any }> {
  const tasksRes = await pool.query(`
    SELECT t.id, t.title, t.category, t.deadline
    FROM tasks t
    JOIN task_classes tc ON tc.task_id = t.id
    LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
    WHERE tc.class_id = $2
      AND t.status = 'OPEN'
      AND (ts.id IS NULL OR ts.status = 'REJECTED')
    ORDER BY t.deadline ASC
  `, [user.id, user.class_id]);

  let html = '';
  if (tasksRes.rows.length === 0) {
    html = `🎉 <b>Great job, ${escapeHtml(user.full_name)}!</b>\nYou have no pending assignments right now. You are completely up to date!\n${getWatermarkHtml()}`;
  } else {
    html = `📋 <b>YOUR PENDING ASSIGNMENTS (${tasksRes.rows.length}):</b>\n\n`;
    tasksRes.rows.forEach((t, i) => {
      const dStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'No deadline';
      html += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += `   📂 <code>${escapeHtml(t.category)}</code>\n`;
      html += `   ⏰ <i>Due:</i> ${dStr}\n\n`;
    });
    html += `👉 <i>Please complete and upload your submission proof before the deadline!</i>\n`;
    html += getWatermarkHtml();
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🌐 Submit on Portal', url: getPortalUrl() },
        { text: '🧩 My LeetCode', callback_data: 'cb_leetcode' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 📢 Enhanced Daily Group Summary (Tasks + LeetCode + GitHub)
 */
export async function sendGroupSummary(targetChatId?: string): Promise<{ success: boolean; message: string; data?: any }> {
  const destChatId = targetChatId || await getGroupChatId() || getAdminChatId();
  if (!destChatId) {
    return { success: false, message: 'No destination Telegram Chat ID configured for Group Summary.' };
  }

  try {
    const dateStr = getISTDateStr();

    // 1. Fetch active tasks
    const tasksRes = await pool.query(`
      SELECT t.id, t.title, t.category, t.deadline, t.status,
             COUNT(DISTINCT tc.class_id) as class_count,
             COUNT(DISTINCT ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_count
      FROM tasks t
      LEFT JOIN task_classes tc ON tc.task_id = t.id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id
      WHERE t.status = 'OPEN' OR t.deadline >= CURRENT_TIMESTAMP - INTERVAL '1 day'
      GROUP BY t.id, t.title, t.category, t.deadline, t.status
      ORDER BY t.deadline ASC
      LIMIT 5
    `);

    // 2. Fetch total students & linked stats
    const studentsRes = await pool.query(`
      SELECT COUNT(*) as total_students,
             COUNT(telegram_chat_id) as linked_telegram_count
      FROM users
      WHERE role = 'STUDENT'
    `);
    const totalStudents = parseInt(studentsRes.rows[0]?.total_students || '0', 10);
    const linkedTelegram = parseInt(studentsRes.rows[0]?.linked_telegram_count || '0', 10);

    // 3. Fetch today's LeetCode & GitHub overall progress
    const lcRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_solvers,
        SUM(solved_today) as total_problems_solved
      FROM leetcode_daily_progress
      WHERE date = $1 AND solved_today > 0
    `, [dateStr]);
    const lcSolvers = Number(lcRes.rows[0]?.active_solvers) || 0;
    const lcTotalSolved = Number(lcRes.rows[0]?.total_problems_solved) || 0;

    const ghRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_committers,
        SUM(commits_today) as total_commits
      FROM github_daily_progress
      WHERE date = $1 AND commits_today > 0 AND sync_status = 'SUCCESS'
    `, [dateStr]);
    const ghCommitters = Number(ghRes.rows[0]?.active_committers) || 0;
    const ghTotalCommits = Number(ghRes.rows[0]?.total_commits) || 0;

    // 4. Top solver & top committer today
    const topLc = await pool.query(`
      SELECT u.full_name, lp.solved_today
      FROM leetcode_daily_progress lp
      JOIN users u ON u.id = lp.user_id
      WHERE lp.date = $1 AND lp.solved_today > 0
      ORDER BY lp.solved_today DESC LIMIT 1
    `, [dateStr]);

    const topGh = await pool.query(`
      SELECT u.full_name, gp.commits_today
      FROM github_daily_progress gp
      JOIN users u ON u.id = gp.user_id
      WHERE gp.date = $1 AND gp.commits_today > 0 AND gp.sync_status = 'SUCCESS'
      ORDER BY gp.commits_today DESC LIMIT 1
    `, [dateStr]);

    let html = `📊 <b>IT TASK MANAGER — DAILY DEPARTMENT BRIEF</b>\n`;
    html += `📅 <i>${dateStr} (IST)</i>\n`;
    html += `👥 <b>Total Students:</b> ${totalStudents} | 📱 <b>Telegram Linked:</b> ${linkedTelegram}\n`;
    html += `─────────────────────────\n\n`;

    html += `🚀 <b>Today's Coding Highlights:</b>\n`;
    html += `• 🧩 <b>LeetCode:</b> <b>${lcTotalSolved}</b> problems solved (${lcSolvers} active solvers)\n`;
    if (topLc.rows[0]) {
      html += `  🥇 Top Solver: <b>${escapeHtml(topLc.rows[0].full_name)}</b> (${topLc.rows[0].solved_today} solved)\n`;
    }
    html += `• 💻 <b>GitHub:</b> <b>${ghTotalCommits}</b> commits pushed (${ghCommitters} active committers)\n`;
    if (topGh.rows[0]) {
      html += `  🥇 Top Committer: <b>${escapeHtml(topGh.rows[0].full_name)}</b> (${topGh.rows[0].commits_today} commits)\n`;
    }
    html += `\n`;

    if (tasksRes.rows.length === 0) {
      html += `✨ <b>No pending assignments today! Keep up the great work!</b> 🎉\n`;
    } else {
      html += `📌 <b>Active Assignments:</b>\n\n`;
      tasksRes.rows.forEach((t, idx) => {
        const completed = parseInt(t.completed_count || '0', 10);
        const deadlineStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'No deadline';
        
        const progressBar = totalStudents > 0 ? makeProgressBar(completed, totalStudents, 8) : '';

        html += `<b>${idx + 1}. ${escapeHtml(t.title)}</b>\n`;
        if (t.category) html += `   📂 <i>Category:</i> <code>${escapeHtml(t.category)}</code>\n`;
        html += `   ⏰ <i>Due:</i> ${deadlineStr}\n`;
        html += `   ✅ <i>Submissions:</i> <b>${completed}</b> ${progressBar}\n\n`;
      });
    }

    html += getWatermarkHtml();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🏆 View Leaderboard', callback_data: 'cb_leaderboard' },
          { text: '🌐 Open Portal', url: getPortalUrl() }
        ]
      ]
    };

    const res = await sendTelegramMessage(destChatId, html, { reply_markup: inlineKeyboard });
    if (res.ok) {
      return { success: true, message: `Group summary delivered successfully to ${destChatId}.` };
    } else {
      return { success: false, message: `Telegram error: ${res.description}` };
    }
  } catch (err: any) {
    console.error('[Telegram] sendGroupSummary error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 👤 1-to-1 Private Reminders with Rate-Limiting
 */
export async function triggerPendingTaskReminders(): Promise<{
  success: boolean;
  notifiedCount: number;
  totalPendingCount: number;
  unlinkedCount: number;
  details: string;
}> {
  try {
    const query = `
      SELECT DISTINCT 
        u.id as user_id, 
        u.full_name, 
        u.register_number, 
        u.telegram_chat_id,
        t.id as task_id, 
        t.title as task_title, 
        t.category as task_category,
        t.deadline
      FROM users u
      JOIN task_classes tc ON tc.class_id = u.class_id
      JOIN tasks t ON t.id = tc.task_id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = u.id
      WHERE u.role = 'STUDENT'
        AND t.status = 'OPEN'
        AND (ts.id IS NULL OR ts.status = 'REJECTED')
        AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP - INTERVAL '2 days')
      ORDER BY u.id, t.deadline ASC
    `;

    const res = await pool.query(query);
    if (res.rows.length === 0) {
      return {
        success: true,
        notifiedCount: 0,
        totalPendingCount: 0,
        unlinkedCount: 0,
        details: 'No pending tasks found for any student.'
      };
    }

    const studentTasksMap = new Map<string, {
      fullName: string;
      registerNumber: string;
      telegramChatId: string | null;
      tasks: { title: string; category?: string; deadline: string | null }[];
    }>();

    for (const row of res.rows) {
      if (!studentTasksMap.has(row.user_id)) {
        studentTasksMap.set(row.user_id, {
          fullName: row.full_name || 'Student',
          registerNumber: row.register_number || '',
          telegramChatId: row.telegram_chat_id || null,
          tasks: []
        });
      }
      studentTasksMap.get(row.user_id)!.tasks.push({
        title: row.task_title,
        category: row.task_category,
        deadline: row.deadline
      });
    }

    let notifiedCount = 0;
    let unlinkedCount = 0;
    const portalUrl = getPortalUrl();

    for (const [, info] of studentTasksMap.entries()) {
      if (!info.telegramChatId) {
        unlinkedCount++;
        continue;
      }

      let html = `🔔 <b>IT TASK MANAGER — PENDING TASK REMINDER</b>\n\n`;
      html += `Hello <b>${escapeHtml(info.fullName)}</b>,\n`;
      html += `You have <b>${info.tasks.length}</b> pending assignment(s) awaiting submission:\n\n`;

      info.tasks.slice(0, 5).forEach((t, i) => {
        const dStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'No deadline';
        html += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b>\n`;
        if (t.category) html += `   📂 <code>${escapeHtml(t.category)}</code>\n`;
        html += `   ⏰ <i>Due:</i> ${dStr}\n\n`;
      });

      if (info.tasks.length > 5) {
        html += `<i>...and ${info.tasks.length - 5} more pending task(s).</i>\n\n`;
      }

      html += `👉 <i>Please complete and upload your submission proof before the deadline!</i>\n`;
      html += getWatermarkHtml();

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🌐 Submit Proof on Portal', url: portalUrl },
            { text: '🧩 My LeetCode', callback_data: 'cb_leetcode' }
          ]
        ]
      };

      const sendRes = await sendTelegramMessage(info.telegramChatId, html, { reply_markup: inlineKeyboard });
      if (sendRes.ok) {
        notifiedCount++;
      }

      await new Promise(r => setTimeout(r, 40));
    }

    return {
      success: true,
      notifiedCount,
      totalPendingCount: studentTasksMap.size,
      unlinkedCount,
      details: `Dispatched direct reminders to ${notifiedCount} student(s) on Telegram. (${unlinkedCount} students haven't linked Telegram yet).`
    };
  } catch (err: any) {
    console.error('[Telegram] triggerPendingTaskReminders error:', err);
    return {
      success: false,
      notifiedCount: 0,
      totalPendingCount: 0,
      unlinkedCount: 0,
      details: err.message
    };
  }
}

/**
 * 🔗 Link Student Telegram Account
 */
export async function linkStudentTelegram(
  identifier: string,
  personalChatId: string | number,
  telegramUsername?: string
): Promise<{ success: boolean; studentName?: string; message: string }> {
  try {
    const rawClean = identifier.trim();
    const cleanNoSpaces = rawClean.replace(/\s+/g, '').toLowerCase();

    const res = await pool.query(`
      SELECT id, full_name, register_number, username, role
      FROM users
      WHERE REPLACE(LOWER(register_number), ' ', '') = $1
         OR REPLACE(LOWER(username), ' ', '') = $1
         OR REPLACE(LOWER(email), ' ', '') = $1
         OR LOWER(register_number) = LOWER($2)
         OR LOWER(username) = LOWER($2)
      LIMIT 1
    `, [cleanNoSpaces, rawClean]);

    if (res.rows.length === 0) {
      return {
        success: false,
        message: `Student with Register Number or Username "${identifier}" was not found in the database. Please check your Register Number.`
      };
    }

    const user = res.rows[0];
    await pool.query(`
      UPDATE users
      SET telegram_chat_id = $1,
          telegram_username = $2,
          telegram_linked_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [String(personalChatId), telegramUsername || null, user.id]);

    return {
      success: true,
      studentName: user.full_name,
      message: `Successfully linked Telegram for ${user.full_name} (${user.register_number || user.username}).`
    };
  } catch (err: any) {
    console.error('[Telegram] linkStudentTelegram error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 🤖 Background Poller for Interactive Telegram Commands & Inline Callbacks
 */
let isPolling = false;
let lastUpdateId = 0;

export function startTelegramPoller(): void {
  const token = getBotToken();
  if (!token || isPolling) return;

  isPolling = true;
  console.log('[Telegram Bot] Resilient update poller started for interactive commands...');

  // Automatically register native Telegram command menu
  registerBotCommandsMenu().catch(err => console.warn('[Telegram Bot] Menu registration warning:', err));

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);

          // ── Handle Inline Button Callbacks ──────────────────────────────
          if (update.callback_query) {
            const cb = update.callback_query;
            const cbData = cb.data;
            const cbChatId = cb.message?.chat?.id;
            const cbUserId = cb.from?.id;

            if (cb.id) {
              await answerCallbackQuery(cb.id);
            }

            if (!cbChatId || !cbUserId) continue;

            const userRes = await pool.query(`
              SELECT u.id, u.full_name, u.register_number, u.role, u.class_id, u.leetcode_url, u.github_url, c.name as class_name
              FROM users u
              LEFT JOIN classes c ON u.class_id = c.id
              WHERE u.telegram_chat_id = $1
              LIMIT 1
            `, [String(cbUserId)]);

            const user = userRes.rows[0];

            if (!user && cbData !== 'cb_help' && cbData !== 'cb_leaderboard') {
              await sendTelegramMessage(
                cbChatId,
                `ℹ️ Your Telegram is not yet connected to a student profile.\n\nReply with <code>/link YOUR_REGISTER_NUMBER</code> to connect!\n${getWatermarkHtml()}`
              );
              continue;
            }

            if (cbData === 'cb_tasks' || cbData === 'view_tasks') {
              const card = await getTasksCard(user);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_leetcode') {
              const card = await getStudentLeetCodeCard(user);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_github') {
              const card = await getStudentGitHubCard(user);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_stats') {
              const card = await getStudentStatsCard(user);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_leaderboard') {
              const card = await getLeaderboardCard(user?.class_id, user?.class_name);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_defaulters') {
              const card = await getDefaultersCard();
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_summary') {
              await sendGroupSummary(String(cbChatId));
            } else if (cbData === 'cb_menu') {
              const keyboard = getInteractiveMenuKeyboard(user?.role);
              await sendTelegramMessage(
                cbChatId,
                `📱 <b>IT TASK MANAGER — QUICK ACTIONS</b>\n\nHello <b>${escapeHtml(user?.full_name || 'there')}</b>! Tap any button below for instant updates:\n${getWatermarkHtml()}`,
                { reply_markup: keyboard }
              );
            }
            continue;
          }

          // ── Handle Text Messages & Commands ──────────────────────────────
          const msg = update.message;
          if (!msg) continue;

          const chatId = msg.chat?.id;
          const isGroup = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
          const senderUserId = msg.from?.id || chatId;
          const fromUsername = msg.from?.username || '';
          const senderName = msg.from?.first_name || 'there';
          const text = (msg.text || '').trim();

          if (!text && !isGroup) continue;

          // Auto-register group chat ID when active in a group
          if (isGroup && chatId) {
            const currentSavedGroup = await getGroupChatId();
            if (!currentSavedGroup) {
              await setGroupChatId(String(chatId));
              console.log(`[Telegram] Auto-registered group chat ID: ${chatId}`);
            }
          }

          // Command: /id
          if (text.startsWith('/id')) {
            await sendTelegramMessage(
              chatId,
              `ℹ️ <b>Chat Details:</b>\n• Chat ID: <code>${chatId}</code>\n• Chat Type: <code>${msg.chat?.type}</code>\n• Your User ID: <code>${senderUserId}</code>\n${getWatermarkHtml()}`
            );
            continue;
          }

          // Command: /start <param> or /link <param>
          if (text.startsWith('/start') || text.startsWith('/link')) {
            const cleanText = text.replace(/@\w+/g, '');
            const parts = cleanText.split(/\s+/);
            const param = parts[1]?.trim();

            if (param) {
              const linkResult = await linkStudentTelegram(param, senderUserId, fromUsername);
              if (linkResult.success) {
                const inlineKeyboard = getInteractiveMenuKeyboard();
                await sendTelegramMessage(
                  chatId,
                  `🎉 <b>Welcome to IT TASK MANAGER!</b>\n\nHello <b>${escapeHtml(linkResult.studentName)}</b>,\nYour Telegram is now securely connected to <b>IT TaskManager</b>.\n\nYou will receive private alerts for upcoming deadlines and target updates here! 🚀\n${getWatermarkHtml()}`,
                  { reply_markup: inlineKeyboard }
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `⚠️ <b>Could Not Link Account</b>\n\n${escapeHtml(linkResult.message)}\n\nPlease check your Register Number or connect via the IT TaskManager portal.\n${getWatermarkHtml()}`
                );
              }
            } else {
              if (isGroup) {
                await sendTelegramMessage(
                  chatId,
                  `👋 <b>Welcome to IT TASK MANAGER!</b>\n\n📌 <b>Group ID:</b> <code>${chatId}</code>\n\nThis group receives automated daily task reports and department announcements.\n\n💡 <i>Students: To link your account for private alerts, message @IT_TaskManager_Alerts_bot directly!</i>\n${getWatermarkHtml()}`
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `👋 <b>Welcome to IT TASK MANAGER!</b>\n\nHello <b>${escapeHtml(senderName)}</b>!\n\nTo link your student account and receive private task reminders, reply with:\n<code>/link YOUR_REGISTER_NUMBER</code>\n\n<i>Example:</i> <code>/link 922524205001</code>\n${getWatermarkHtml()}`
                );
              }
            }
            continue;
          }

          // Fetch sender's student account for authenticated commands
          const userRes = await pool.query(`
            SELECT u.id, u.full_name, u.register_number, u.role, u.class_id, u.leetcode_url, u.github_url, c.name as class_name
            FROM users u
            LEFT JOIN classes c ON u.class_id = c.id
            WHERE u.telegram_chat_id = $1
            LIMIT 1
          `, [String(senderUserId)]);
          const user = userRes.rows[0];

          // Command: /menu or /help
          if (text.startsWith('/menu') || text.startsWith('/help')) {
            const keyboard = getInteractiveMenuKeyboard(user?.role);
            let helpHtml = `📱 <b>IT TASK MANAGER — COMMAND MENU</b>\n\n`;
            if (user) {
              helpHtml += `👤 <b>Connected:</b> ${escapeHtml(user.full_name)} (<code>${escapeHtml(user.register_number)}</code>)\n\n`;
            }
            helpHtml += `<b>Available Commands:</b>\n`;
            helpHtml += `• <code>/tasks</code> - View pending assignments\n`;
            helpHtml += `• <code>/leetcode</code> (or <code>/lc</code>) - Daily LeetCode progress & targets\n`;
            helpHtml += `• <code>/github</code> (or <code>/gh</code>) - Daily GitHub commits & targets\n`;
            helpHtml += `• <code>/stats</code> - Overall performance scorecard\n`;
            helpHtml += `• <code>/leaderboard</code> (or <code>/top</code>) - Top performers ranking\n`;
            helpHtml += `• <code>/status</code> - Connected profile info\n`;
            helpHtml += `• <code>/unlink</code> - Disconnect account\n`;

            if (user?.role === 'SUPREME_ADMIN' || user?.role === 'STAFF' || user?.role === 'COORDINATOR') {
              helpHtml += `\n<b>Staff / Coordinator Commands:</b>\n`;
              helpHtml += `• <code>/defaulters [class]</code> - Target defaulters report\n`;
              helpHtml += `• <code>/broadcast &lt;msg&gt;</code> - Send announcement to all students\n`;
              helpHtml += `• <code>/summary</code> - Class daily brief\n`;
            }

            helpHtml += getWatermarkHtml();
            await sendTelegramMessage(chatId, helpHtml, { reply_markup: keyboard });
            continue;
          }

          // Command: /leetcode or /lc
          if (text.startsWith('/leetcode') || text.startsWith('/lc')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentLeetCodeCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            continue;
          }

          // Command: /github or /gh
          if (text.startsWith('/github') || text.startsWith('/gh')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentGitHubCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            continue;
          }

          // Command: /stats or /myprogress or /progress
          if (text.startsWith('/stats') || text.startsWith('/myprogress') || text.startsWith('/progress')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentStatsCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            continue;
          }

          // Command: /leaderboard or /top or /rankings
          if (text.startsWith('/leaderboard') || text.startsWith('/top') || text.startsWith('/rankings')) {
            const card = await getLeaderboardCard(user?.class_id, user?.class_name);
            await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            continue;
          }

          // Command: /defaulters or /pendingtargets
          if (text.startsWith('/defaulters') || text.startsWith('/pendingtargets')) {
            const parts = text.split(/\s+/);
            const scopeFilter = parts.slice(1).join(' ');
            const card = await getDefaultersCard(scopeFilter);
            await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            continue;
          }

          // Command: /broadcast <message> (Admin/Staff only)
          if (text.startsWith('/broadcast')) {
            if (!user || (user.role !== 'SUPREME_ADMIN' && user.role !== 'STAFF' && user.role !== 'COORDINATOR')) {
              await sendTelegramMessage(chatId, `⚠️ You do not have permission to send broadcasts.\n${getWatermarkHtml()}`);
              continue;
            }

            const broadcastText = text.replace(/^\/broadcast\s*/i, '').trim();
            if (!broadcastText) {
              await sendTelegramMessage(chatId, `⚠️ Usage: <code>/broadcast Your message here</code>\n${getWatermarkHtml()}`);
              continue;
            }

            const studentsRes = await pool.query(`SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL AND role = 'STUDENT'`);
            let count = 0;
            const broadcastHtml = `📢 <b>DEPARTMENT ANNOUNCEMENT</b>\n\n${escapeHtml(broadcastText)}\n\n— <i>Sent by ${escapeHtml(user.full_name)} (${user.role})</i>${getWatermarkHtml()}`;

            for (const s of studentsRes.rows) {
              if (s.telegram_chat_id) {
                await sendTelegramMessage(s.telegram_chat_id, broadcastHtml);
                count++;
                await new Promise(r => setTimeout(r, 40));
              }
            }

            await sendTelegramMessage(chatId, `✅ <b>Broadcast sent to ${count} student(s) successfully!</b>\n${getWatermarkHtml()}`);
            continue;
          }

          // Command: /tasks or /pending or /mytasks
          if (text.startsWith('/tasks') || text.startsWith('/pending') || text.startsWith('/mytasks')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getTasksCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            continue;
          }

          // Command: /unlink
          if (text.startsWith('/unlink')) {
            await pool.query(`
              UPDATE users
              SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL
              WHERE telegram_chat_id = $1
            `, [String(senderUserId)]);
            await sendTelegramMessage(chatId, `✅ Your Telegram has been disconnected from your IT TaskManager student account.\n${getWatermarkHtml()}`);
            continue;
          }

          // Command: /status
          if (text.startsWith('/status')) {
            if (user) {
              await sendTelegramMessage(
                chatId,
                `✅ <b>Connected Account:</b>\n• <b>Name:</b> ${escapeHtml(user.full_name)}\n• <b>Register No:</b> <code>${escapeHtml(user.register_number)}</code>\n• <b>Class:</b> ${escapeHtml(user.class_name || 'IT Section')}\n• <b>Role:</b> ${user.role}\n${getWatermarkHtml()}`,
                { reply_markup: getInteractiveMenuKeyboard(user.role) }
              );
            } else {
              await sendTelegramMessage(chatId, `ℹ️ This chat is not yet linked to any student profile. Send <code>/link &lt;Your_Register_Number&gt;</code> to link.\n${getWatermarkHtml()}`);
            }
            continue;
          }

          // Command: /summary or /report
          if (text.startsWith('/summary') || text.startsWith('/report')) {
            const res = await sendGroupSummary(String(chatId));
            if (!res.success) {
              await sendTelegramMessage(chatId, `⚠️ ${escapeHtml(res.message)}\n${getWatermarkHtml()}`);
            }
            continue;
          }

          // Friendly Chat Handler for Private DMs
          if (!isGroup && (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello')) {
            const keyboard = getInteractiveMenuKeyboard(user?.role);
            if (user) {
              await sendTelegramMessage(
                chatId,
                `👋 <b>Hello ${escapeHtml(user.full_name)}!</b>\n\nWelcome back to IT TaskManager. What would you like to check today?\n${getWatermarkHtml()}`,
                { reply_markup: keyboard }
              );
            } else {
              await sendTelegramMessage(
                chatId,
                `🤖 <b>Welcome to IT TASK MANAGER!</b>\n\nHello! To receive private task deadline alerts and check your live coding progress, reply with:\n<code>/link YOUR_REGISTER_NUMBER</code>\n\n<i>Example:</i> <code>/link 922524205001</code>\n${getWatermarkHtml()}`
              );
            }
          }
        }
      }
    } catch (err: any) {
      // Graceful poll loop recovery
    } finally {
      if (isPolling) {
        setTimeout(poll, 1500);
      }
    }
  };

  poll();
}

/**
 * 📊 Get Overview Stats for Admin Panel
 */
export async function getTelegramStats(): Promise<any> {
  const token = getBotToken();
  const adminChatId = getAdminChatId();
  const groupChatId = await getGroupChatId();

  const res = await pool.query(`
    SELECT 
      COUNT(*) as total_students,
      COUNT(telegram_chat_id) as linked_students
    FROM users
    WHERE role = 'STUDENT'
  `);

  return {
    botConfigured: Boolean(token),
    botUsername: 'IT_TaskManager_Alerts_bot',
    adminChatId,
    groupChatId,
    totalStudents: parseInt(res.rows[0]?.total_students || '0', 10),
    linkedStudents: parseInt(res.rows[0]?.linked_students || '0', 10)
  };
}
