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
 * Splits long HTML text into safe Telegram-compliant chunks (<= 3900 chars)
 */
export function splitTelegramHtml(text: string, maxLength = 3900): string[] {
  if (!text || text.length <= maxLength) return [text || ''];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try finding split points in order of preference
    let splitIndex = -1;

    // 1. Double newline
    const doubleNewline = remaining.lastIndexOf('\n\n', maxLength);
    if (doubleNewline > maxLength * 0.4) {
      splitIndex = doubleNewline + 2;
    } else {
      // 2. Single newline
      const singleNewline = remaining.lastIndexOf('\n', maxLength);
      if (singleNewline > maxLength * 0.4) {
        splitIndex = singleNewline + 1;
      } else {
        // 3. Comma followed by space (e.g., student name lists)
        const commaSpace = remaining.lastIndexOf(', ', maxLength);
        if (commaSpace > maxLength * 0.3) {
          splitIndex = commaSpace + 2;
        } else {
          // 4. Space
          const space = remaining.lastIndexOf(' ', maxLength);
          if (space > maxLength * 0.2) {
            splitIndex = space + 1;
          } else {
            // Hard cut
            splitIndex = maxLength;
          }
        }
      }
    }

    const chunk = remaining.slice(0, splitIndex).trimEnd();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Low-level message sender using Telegram Bot API with HTML mode, error recovery & automatic chunking
 */
export async function sendTelegramMessage(
  chatId: string | number,
  htmlText: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any; disable_web_page_preview?: boolean } = {}
): Promise<{ ok: boolean; description?: string; result?: any }> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, description: 'No bot token configured in environment variables.' };
  }

  const chunks = splitTelegramHtml(htmlText, 3900);
  if (chunks.length > 1) {
    let lastResult: any = { ok: true };
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const res = await sendSingleTelegramMessage(chatId, chunks[i], {
        ...options,
        reply_markup: isLast ? options.reply_markup : undefined
      });
      if (!res.ok) {
        return res;
      }
      lastResult = res;
      if (!isLast) {
        await new Promise(r => setTimeout(r, 60));
      }
    }
    return lastResult;
  }

  return sendSingleTelegramMessage(chatId, htmlText, options);
}

async function sendSingleTelegramMessage(
  chatId: string | number,
  text: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any; disable_web_page_preview?: boolean } = {}
): Promise<{ ok: boolean; description?: string; result?: any }> {
  const token = getBotToken();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
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
 * Answer inline callback queries immediately from button clicks
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
      console.log('[Telegram Bot] Registered native command menu with Telegram API.');
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
      { text: '🌐 Open Portal', url: portalUrl }
    ]
  ];

  if (role && (role === 'SUPREME_ADMIN' || role === 'STAFF' || role === 'COORDINATOR' || role === 'HOD' || role === 'CLASS_ADVISOR')) {
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

  const [dailyRes, weeklyRes, targetRes] = await Promise.all([
    pool.query(`SELECT solved_today, solved_yesterday, total_solved, status FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT SUM(solved_today) as solved_week FROM leetcode_daily_progress WHERE user_id = $1 AND date >= $2 AND date <= $3`, [user.id, week.start, week.end]),
    pool.query(`
      SELECT daily_target, weekly_target FROM leetcode_targets
      WHERE start_date <= $1 AND end_date >= $1 AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
      LIMIT 1
    `, [dateStr, user.id, user.class_id])
  ]);

  const daily = dailyRes.rows[0];
  const solvedWeek = Number(weeklyRes.rows[0]?.solved_week) || 0;
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

  const [dailyRes, weeklyRes] = await Promise.all([
    pool.query(`SELECT daily_commit_count FROM github_daily_commits WHERE student_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT SUM(daily_commit_count) as commits_week FROM github_daily_commits WHERE student_id = $1 AND date >= $2 AND date <= $3`, [user.id, week.start, week.end])
  ]);

  const commitsToday = Number(dailyRes.rows[0]?.daily_commit_count) || 0;
  const commitsWeek = Number(weeklyRes.rows[0]?.commits_week) || 0;

  let html = `💻 <b>GITHUB PERFORMANCE CARD</b>\n`;
  html += `👤 <b>${escapeHtml(user.full_name)}</b> (<code>${escapeHtml(user.register_number)}</code>)\n`;
  html += `🏫 <b>Class:</b> ${escapeHtml(user.class_name || 'IT Department')}\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  html += `⚡ <b>Commits Today:</b> <b>${commitsToday}</b> commit(s)\n`;
  html += `📊 <b>Commits This Week:</b> <b>${commitsWeek}</b> commit(s)\n\n`;

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

  const [lcRes, ghRes, tasksRes] = await Promise.all([
    pool.query(`SELECT solved_today, total_solved FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT daily_commit_count FROM github_daily_commits WHERE student_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`
      SELECT 
        COUNT(t.id) as total_assigned,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_tasks
      FROM task_classes tc
      JOIN tasks t ON t.id = tc.task_id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
      WHERE tc.class_id = $2 AND t.status = 'OPEN'
    `, [user.id, user.class_id])
  ]);

  const lcSolved = lcRes.rows[0]?.total_solved ? Number(lcRes.rows[0].solved_today) : 0;
  const lcTotal = lcRes.rows[0]?.total_solved ? Number(lcRes.rows[0].total_solved) : 0;
  const ghCommits = Number(ghRes.rows[0]?.daily_commit_count) || 0;
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
  html += `   • Commits Today: <b>${ghCommits}</b> commits\n\n`;

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
        { text: '📋 View Pending Tasks', callback_data: 'cb_tasks' }
      ],
      [
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * 📊 Comprehensive Student Performance & Progress Card (By Register No / Identifier)
 */
export async function getComprehensiveStudentProgressCard(identifierOrUser: string | any): Promise<{ found: boolean; html: string; keyboard?: any }> {
  let user = typeof identifierOrUser === 'object' && identifierOrUser !== null ? identifierOrUser : null;

  if (!user && typeof identifierOrUser === 'string') {
    const rawClean = identifierOrUser.trim();
    const cleanNoSpaces = rawClean.replace(/\s+/g, '').toLowerCase();

    const res = await pool.query(`
      SELECT u.id, u.full_name, u.register_number, u.username, u.role, u.class_id, u.leetcode_url, u.github_url,
             c.name as class_name, d.name as dept_name
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE REPLACE(LOWER(u.register_number), ' ', '') = $1
         OR REPLACE(LOWER(u.username), ' ', '') = $1
         OR REPLACE(LOWER(u.email), ' ', '') = $1
         OR LOWER(u.register_number) = LOWER($2)
         OR LOWER(u.username) = LOWER($2)
      LIMIT 1
    `, [cleanNoSpaces, rawClean]);

    if (res.rows.length === 0) {
      return {
        found: false,
        html: `⚠️ <b>Student Not Found</b>\n\nNo student found matching Register Number or Username: <code>${escapeHtml(rawClean)}</code>\n\nPlease verify the Register Number and try again.\n${getWatermarkHtml()}`
      };
    }
    user = res.rows[0];
  }

  if (!user) {
    return {
      found: false,
      html: `⚠️ <b>Student Not Specified</b>\n\nPlease provide a valid Register Number.\n${getWatermarkHtml()}`
    };
  }

  const dateStr = getISTDateStr();
  const week = getWeekRange(dateStr);

  const [lcDailyRes, lcWeeklyRes, lcTargetRes, ghDailyRes, ghWeeklyRes, tasksAssignedRes, activePendingTasksRes] = await Promise.all([
    pool.query(`SELECT solved_today, solved_yesterday, total_solved, status FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT SUM(solved_today) as solved_week FROM leetcode_daily_progress WHERE user_id = $1 AND date >= $2 AND date <= $3`, [user.id, week.start, week.end]),
    pool.query(`
      SELECT daily_target, weekly_target FROM leetcode_targets
      WHERE start_date <= $1 AND end_date >= $1 AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
      LIMIT 1
    `, [dateStr, user.id, user.class_id]),

    pool.query(`SELECT daily_commit_count FROM github_daily_commits WHERE student_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT SUM(daily_commit_count) as commits_week FROM github_daily_commits WHERE student_id = $1 AND date >= $2 AND date <= $3`, [user.id, week.start, week.end]),

    pool.query(`
      SELECT 
        COUNT(t.id) as total_assigned,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_tasks
      FROM task_classes tc
      JOIN tasks t ON t.id = tc.task_id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
      WHERE tc.class_id = $2
    `, [user.id, user.class_id]),

    pool.query(`
      SELECT t.id, t.title, t.category, t.deadline
      FROM task_classes tc
      JOIN tasks t ON t.id = tc.task_id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1 AND ts.status IN ('SUBMITTED', 'VERIFIED')
      WHERE tc.class_id = $2
        AND t.status = 'OPEN'
        AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
        AND ts.id IS NULL
      ORDER BY t.deadline ASC NULLS LAST
      LIMIT 3
    `, [user.id, user.class_id])
  ]);

  // LeetCode calculations
  const lcDaily = lcDailyRes.rows[0];
  const lcSolvedToday = lcDaily?.total_solved !== null && lcDaily?.total_solved !== undefined ? Number(lcDaily.solved_today) : 0;
  const lcTotalSolved = lcDaily?.total_solved ? Number(lcDaily.total_solved) : 0;
  const lcSolvedWeek = Number(lcWeeklyRes.rows[0]?.solved_week) || 0;
  const lcDailyTarget = Number(lcTargetRes.rows[0]?.daily_target) || 0;
  const lcWeeklyTarget = Number(lcTargetRes.rows[0]?.weekly_target) || 0;

  const lcDailyStatus = lcDailyTarget > 0 
    ? (lcSolvedToday >= lcDailyTarget ? '✅ Completed' : '⏳ In Progress') 
    : '⚪ No Target';

  // GitHub calculations
  const ghCommitsToday = Number(ghDailyRes.rows[0]?.daily_commit_count) || 0;
  const ghCommitsWeek = Number(ghWeeklyRes.rows[0]?.commits_week) || 0;

  // Tasks calculations
  const totalTasks = Number(tasksAssignedRes.rows[0]?.total_assigned) || 0;
  const completedTasks = Number(tasksAssignedRes.rows[0]?.completed_tasks) || 0;
  const taskProgress = totalTasks > 0 ? makeProgressBar(completedTasks, totalTasks, 8) : '[░░░░░░░░] 0%';
  const pendingTasksList = activePendingTasksRes.rows;

  let html = `📊 <b>STUDENT COMPREHENSIVE PERFORMANCE CARD</b>\n`;
  html += `👤 <b>${escapeHtml(user.full_name)}</b>\n`;
  html += `🆔 <b>Register No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `🏫 <b>Class:</b> ${escapeHtml(user.class_name || 'IT Department')}\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  html += `📝 <b>Academic Tasks Progress:</b>\n`;
  html += `• Completed: <b>${completedTasks}</b> / ${totalTasks} ${taskProgress}\n`;
  if (pendingTasksList.length === 0) {
    html += `• ✨ <i>Status: All active assignments completed!</i> 🎉\n\n`;
  } else {
    html += `• ⏳ <b>Active Pending Tasks (${pendingTasksList.length}):</b>\n`;
    pendingTasksList.forEach((t, i) => {
      const dStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';
      html += `   ${i + 1}. <b>${escapeHtml(t.title)}</b> (<i>Due: ${dStr}</i>)\n`;
    });
    html += `\n`;
  }

  html += `🧩 <b>LeetCode Progress:</b>\n`;
  html += `• Today's Target: <b>${lcSolvedToday}</b> / ${lcDailyTarget} (${lcDailyStatus})\n`;
  html += `• This Week: <b>${lcSolvedWeek}</b> / ${lcWeeklyTarget} problems\n`;
  html += `• Total Solved: <b>${lcTotalSolved}</b> problems\n`;
  if (user.leetcode_url) {
    html += `• 🔗 <a href="${escapeHtml(user.leetcode_url)}">LeetCode Profile</a>\n`;
  }
  html += `\n`;

  html += `💻 <b>GitHub Progress:</b>\n`;
  html += `• Today's Commits: <b>${ghCommitsToday}</b> commits\n`;
  html += `• This Week: <b>${ghCommitsWeek}</b> commits\n`;
  if (user.github_url) {
    html += `• 🔗 <a href="${escapeHtml(user.github_url)}">GitHub Profile</a>\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { found: true, html, keyboard };
}

/**
 * 🏫 Class & Year-Wise Comprehensive Analysis Card
 * Supports queries like: '3ita', '3itb', '3itc', '2ita', '2itb', '2itc', '2it', '3it', '4it', '1it', 'link/2it', 'link 3it', 'year3', 'year2'
 */
export async function getClassOrYearAnalysisCard(queryText: string): Promise<{ found: boolean; html: string; keyboard?: any }> {
  const clean = queryText.toLowerCase().replace(/[@#/_]/g, '').trim();
  const dateStr = getISTDateStr();

  let targetYear: number | null = null;
  let targetSection: string | null = null;
  let isYearOnly = false;

  // Pattern 1: Year-only e.g. '2it', '3it', '4it', '1it', 'year3', '3year', 'link2it', 'link3it', 'y3', 'year 3'
  const yearMatch = clean.match(/^(?:link)?\s*(?:year|y)?\s*([1-4])\s*(?:it|year|yr)?$/i) || clean.match(/^([1-4])\s*(?:it|year|yr)$/i);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1], 10);
    isYearOnly = true;
  }

  // Pattern 2: Specific Class with section e.g. '3ita', '3itb', '3itc', '2ita', '2itb', '2itc', 'link2ita', 'link3itc', '3a', '3b', '2a', '2b'
  const classMatch = clean.match(/^(?:link)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i) || clean.match(/^(?:link)?\s*(?:it)?\s*([1-4])\s*([a-d])$/i) || clean.match(/^(?:class)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i);
  if (classMatch) {
    targetYear = parseInt(classMatch[1], 10);
    targetSection = classMatch[2].toUpperCase();
    isYearOnly = false;
  }

  // Query classes from DB matching target
  let classesRes;
  if (isYearOnly && targetYear) {
    classesRes = await pool.query(`
      SELECT c.id, c.name, c.year, c.batch, d.name as dept_name
      FROM classes c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.year = $1
      ORDER BY c.name ASC
    `, [targetYear]);
  } else if (targetYear && targetSection) {
    classesRes = await pool.query(`
      SELECT c.id, c.name, c.year, c.batch, d.name as dept_name
      FROM classes c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.year = $1
        AND (c.name ILIKE $2 OR c.name ILIKE $3 OR c.name ILIKE $4)
      ORDER BY c.name ASC
    `, [targetYear, `%${targetSection}%`, `%- ${targetSection}%`, `%Section ${targetSection}%`]);
  } else {
    // General search across class names
    const searchParam = `%${clean}%`;
    classesRes = await pool.query(`
      SELECT c.id, c.name, c.year, c.batch, d.name as dept_name
      FROM classes c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.name ILIKE $1 OR c.batch ILIKE $1
      ORDER BY c.year ASC, c.name ASC
    `, [searchParam]);
  }

  if (classesRes.rows.length === 0) {
    return {
      found: false,
      html: `⚠️ <b>Class Not Found</b>\n\nNo active class found matching: <code>${escapeHtml(queryText)}</code>\n\n<i>Available helper shortcuts:</i>\n• <code>/3ita</code>, <code>/3itb</code>, <code>/3itc</code> (III Year Sections)\n• <code>/2ita</code>, <code>/2itb</code>, <code>/2itc</code> (II Year Sections)\n• <code>/3it</code>, <code>/2it</code>, <code>/year3</code> (Full Year Section Breakdown)\n${getWatermarkHtml()}`
    };
  }

  const matchedClasses = classesRes.rows;
  const classIds = matchedClasses.map(c => c.id);
  const classNamesHeader = isYearOnly
    ? `${targetYear}${targetYear === 1 ? 'st' : targetYear === 2 ? 'nd' : targetYear === 3 ? 'rd' : 'th'} YEAR (ALL SECTIONS)`
    : matchedClasses.map(c => c.name).join(', ');

  // Fetch enrolled students
  const studentsRes = await pool.query(`
    SELECT u.id, u.full_name, u.register_number, u.telegram_chat_id, u.class_id, c.name as class_name
    FROM users u
    JOIN classes c ON c.id = u.class_id
    WHERE u.class_id = ANY($1)
      AND u.role = 'STUDENT'
    ORDER BY c.name ASC, u.register_number ASC
  `, [classIds]);

  const students = studentsRes.rows;
  const totalStudents = students.length;
  const linkedTelegram = students.filter(s => s.telegram_chat_id).length;
  const linkedPct = totalStudents > 0 ? Math.round((linkedTelegram / totalStudents) * 100) : 0;

  if (totalStudents === 0) {
    return {
      found: true,
      html: `ℹ️ <b>${escapeHtml(classNamesHeader)}</b>\n\nNo enrolled students found in this class yet.\n${getWatermarkHtml()}`
    };
  }

  const studentIds = students.map(s => s.id);

  // LeetCode stats for this class/year today
  const [lcRes, ghRes, activeTasksRes] = await Promise.all([
    pool.query(`
      SELECT u.id, u.full_name, u.register_number,
             COALESCE(lp.solved_today, 0) as solved_today,
             lt.daily_target
      FROM users u
      LEFT JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
      JOIN LATERAL (
        SELECT daily_target FROM leetcode_targets
        WHERE start_date <= $1 AND end_date >= $1 AND (user_id = u.id OR class_id = u.class_id OR class_id IS NULL)
        ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
        LIMIT 1
      ) lt ON true
      WHERE u.id = ANY($2)
      ORDER BY u.register_number ASC
    `, [dateStr, studentIds]),

    pool.query(`
      SELECT student_id as id, COALESCE(daily_commit_count, 0) as commits_today
      FROM github_daily_commits
      WHERE student_id = ANY($1) AND date = $2
    `, [studentIds, dateStr]),

    pool.query(`
      SELECT DISTINCT t.id, t.title, t.category, t.deadline
      FROM tasks t
      JOIN task_classes tc ON tc.task_id = t.id
      WHERE tc.class_id = ANY($1)
        AND t.status = 'OPEN'
        AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
      ORDER BY t.deadline ASC NULLS LAST
      LIMIT 4
    `, [classIds])
  ]);

  // Compute LeetCode metrics
  let lcTotalSolved = 0;
  let lcActiveSolvers = 0;
  let lcMetCount = 0;
  let lcTargetedCount = 0;
  const lcDefaulters: { name: string; solved: number; target: number }[] = [];

  lcRes.rows.forEach(r => {
    const solved = Number(r.solved_today) || 0;
    const target = Number(r.daily_target) || 0;
    lcTotalSolved += solved;
    if (solved > 0) lcActiveSolvers++;
    if (target > 0) {
      lcTargetedCount++;
      if (solved >= target) {
        lcMetCount++;
      } else {
        lcDefaulters.push({ name: r.full_name, solved, target });
      }
    }
  });

  // Compute GitHub metrics
  let ghTotalCommits = 0;
  let ghActiveCommitters = 0;
  ghRes.rows.forEach(r => {
    const commits = Number(r.commits_today) || 0;
    ghTotalCommits += commits;
    if (commits > 0) ghActiveCommitters++;
  });

  let html = `📊 <b>${isYearOnly ? 'YEAR' : 'CLASS'} ANALYSIS REPORT — ${escapeHtml(classNamesHeader)}</b>\n`;
  html += `👥 <b>Students:</b> <b>${totalStudents}</b> | 📱 <b>Telegram Linked:</b> <b>${linkedTelegram}</b> (${linkedPct}%)\n`;
  html += `📅 <i>${dateStr} (IST)</i>\n`;
  html += `─────────────────────────\n\n`;

  // Section-Wise Breakdown for Year Queries
  if (isYearOnly && matchedClasses.length > 1) {
    html += `🏢 <b>Section-Wise Overview:</b>\n`;
    matchedClasses.forEach(sec => {
      const secStudents = students.filter(s => s.class_id === sec.id);
      const secStudentIds = new Set(secStudents.map(s => s.id));
      let secLcSolved = 0;
      let secLcMet = 0;
      let secLcTargeted = 0;
      let secGhCommits = 0;

      lcRes.rows.forEach(r => {
        if (secStudentIds.has(r.id)) {
          const s = Number(r.solved_today) || 0;
          const t = Number(r.daily_target) || 0;
          secLcSolved += s;
          if (t > 0) {
            secLcTargeted++;
            if (s >= t) secLcMet++;
          }
        }
      });

      ghRes.rows.forEach(r => {
        if (secStudentIds.has(r.id)) {
          secGhCommits += Number(r.commits_today) || 0;
        }
      });

      const secName = sec.name.replace(/^(?:I|II|III|IV|\d+)\s*(?:Year)?\s*/i, '').trim() || sec.name;
      html += `• <b>${escapeHtml(secName)} (${secStudents.length}):</b> 🧩 <b>${secLcSolved}</b> LC | 🎯 <b>${secLcMet}/${secLcTargeted}</b> Target | 💻 <b>${secGhCommits}</b> Commits\n`;
    });
    html += `\n─────────────────────────\n\n`;
  }

  html += `🚀 <b>Today's Coding Highlights:</b>\n`;
  html += `• 🧩 <b>LeetCode:</b> <b>${lcTotalSolved}</b> problems solved (${lcActiveSolvers} active solvers)\n`;
  if (lcTargetedCount > 0) {
    const lcProgress = makeProgressBar(lcMetCount, lcTargetedCount, 8);
    html += `• 🎯 <b>Target Status:</b> ${lcMetCount}/${lcTargetedCount} met target ${lcProgress}\n`;
  }
  if (lcDefaulters.length > 0) {
    const defaulterNames = lcDefaulters.map(d => `${escapeHtml(d.name)} (<code>${d.solved}/${d.target}</code>)`).join(', ');
    html += `• ⚠️ <b>Incomplete Solvers (${lcDefaulters.length}):</b>\n   ${defaulterNames}\n`;
  } else if (lcTargetedCount > 0) {
    html += `• ✨ <i>All targeted students met their LeetCode goal today!</i> 🎉\n`;
  }
  html += `• 💻 <b>GitHub:</b> <b>${ghTotalCommits}</b> commits pushed (${ghActiveCommitters} active committers)\n\n`;

  // Active Tasks for this class
  html += `─────────────────────────\n`;
  if (activeTasksRes.rows.length === 0) {
    html += `📌 <b>Active Class Assignments:</b>\n✨ <i>No active assignments pending for this class right now!</i> 🎉\n`;
  } else {
    html += `📌 <b>Active Class Assignments:</b>\n\n`;

    for (let idx = 0; idx < activeTasksRes.rows.length; idx++) {
      const t = activeTasksRes.rows[idx];
      const deadlineStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';

      const taskSubmissionsRes = await pool.query(`
        SELECT u.id, u.full_name
        FROM users u
        LEFT JOIN task_submissions ts ON ts.task_id = $1 AND ts.user_id = u.id AND ts.status IN ('SUBMITTED', 'VERIFIED')
        WHERE u.id = ANY($2)
          AND ts.id IS NULL
        ORDER BY u.register_number ASC
      `, [t.id, studentIds]);

      const pendingCount = taskSubmissionsRes.rows.length;
      const completedCount = totalStudents - pendingCount;
      const progressBar = makeProgressBar(completedCount, totalStudents, 8);

      html += `<b>${idx + 1}. ${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += `   📂 <i>Category:</i> <code>${escapeHtml(t.category)}</code>\n`;
      html += `   ⏰ <i>Due:</i> ${deadlineStr}\n`;
      html += `   ✅ <i>Submissions:</i> <b>${completedCount} / ${totalStudents}</b> ${progressBar}\n`;

      if (pendingCount === 0) {
        html += `   ✨ <i>Status: 100% Complete! All students submitted!</i> 🎉\n\n`;
      } else {
        const pendingNames = taskSubmissionsRes.rows.map(p => escapeHtml(p.full_name)).join(', ');
        html += `   ⏳ <b>Incomplete (${pendingCount}):</b> ${pendingNames}\n\n`;
      }
    }
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { found: true, html, keyboard };
}

/**
 * ⚠️ Defaulters Card (For Faculty/Admins)
 */
export async function getDefaultersCard(scopeText?: string): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();

  let query = `
    SELECT u.full_name, u.register_number, c.name as class_name,
           COALESCE(lp.solved_today, 0) as solved_today,
           COALESCE(lt.daily_target, 0) as leetcode_target
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
    LEFT JOIN leetcode_targets lt ON lt.start_date <= $1 AND lt.end_date >= $1 AND (lt.class_id = u.class_id OR lt.class_id IS NULL)
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
    const lcSolved = Number(row.solved_today) || 0;

    const lcPending = lcTarget > 0 && lcSolved < lcTarget;

    if (lcPending) {
      defaulters.push({
        name: row.full_name,
        regNo: row.register_number,
        className: row.class_name || 'Unassigned',
        lcStatus: `${lcSolved}/${lcTarget} LC`
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
    defaulters.forEach((d, i) => {
      const statusParts = [d.lcStatus, d.ghStatus].filter(Boolean).join(' | ');
      html += `${i + 1}. <b>${escapeHtml(d.name)}</b> (<code>${escapeHtml(d.regNo)}</code>) [${escapeHtml(d.className)}]\n`;
      html += `   ⏳ Pending: <code>${escapeHtml(statusParts)}</code>\n`;
    });
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
      AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
    ORDER BY t.deadline ASC NULLS LAST
  `, [user.id, user.class_id]);

  let html = '';
  if (tasksRes.rows.length === 0) {
    html = `🎉 <b>Great job, ${escapeHtml(user.full_name)}!</b>\nYou have no pending assignments right now. You are completely up to date!\n${getWatermarkHtml()}`;
  } else {
    html = `📋 <b>YOUR PENDING ASSIGNMENTS (${tasksRes.rows.length}):</b>\n\n`;
    tasksRes.rows.forEach((t, i) => {
      const dStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
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

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 REAL-TIME TASK LIFECYCLE NOTIFIERS (Instant Asynchronous Alerts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 📢 Notify target students & group when a NEW TASK is posted
 */
export async function notifyNewTaskCreated(task: {
  id: string;
  title: string;
  category?: string;
  deadline?: any;
  creator_name?: string;
}, classIds: string[]): Promise<void> {
  const portalUrl = getPortalUrl();
  const deadlineStr = task.deadline
    ? new Date(task.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : 'No deadline set';

  let html = `📢 <b>NEW ASSIGNMENT POSTED!</b>\n\n`;
  html += `📌 <b>Task:</b> ${escapeHtml(task.title)}\n`;
  if (task.category) html += `📂 <b>Category:</b> <code>${escapeHtml(task.category)}</code>\n`;
  if (task.creator_name) html += `👤 <b>Assigned By:</b> ${escapeHtml(task.creator_name)}\n`;
  html += `⏰ <b>Deadline:</b> <i>${deadlineStr}</i>\n\n`;
  html += `👉 <i>Log in to the portal now to review the requirements and submit your proof!</i>\n`;
  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [{ text: '🌐 View & Submit Task', url: `${portalUrl}` }]
    ]
  };

  // 1. Dispatch to Telegram Group Chat if configured
  const groupChatId = await getGroupChatId();
  if (groupChatId) {
    sendTelegramMessage(groupChatId, html, { reply_markup: keyboard }).catch(() => {});
  }

  // 2. Dispatch in parallel to all students in the assigned classes with linked Telegram
  if (classIds && classIds.length > 0) {
    const studentsRes = await pool.query(`
      SELECT telegram_chat_id
      FROM users
      WHERE class_id = ANY($1::uuid[]) AND telegram_chat_id IS NOT NULL AND role = 'STUDENT'
    `, [classIds]);

    const chatIds = studentsRes.rows.map(r => r.telegram_chat_id).filter(Boolean);
    console.log(`[Telegram Notifications] Sending new task alert to ${chatIds.length} student(s)...`);

    // Send in chunks with Promise.allSettled to avoid blocking
    const BATCH_SIZE = 15;
    for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
      const batch = chatIds.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(cid => sendTelegramMessage(cid, html, { reply_markup: keyboard })));
      await new Promise(r => setTimeout(r, 40));
    }
  }
}

/**
 * 📥 Notify student when their submission is RECEIVED (PENDING REVIEW)
 */
export async function notifyTaskSubmissionReceived(studentId: string, taskId: string): Promise<void> {
  try {
    const userRes = await pool.query(`SELECT full_name, register_number, telegram_chat_id FROM users WHERE id = $1 LIMIT 1`, [studentId]);
    const user = userRes.rows[0];
    if (!user || !user.telegram_chat_id) return;

    const taskRes = await pool.query(`SELECT title, category FROM tasks WHERE id = $1 LIMIT 1`, [taskId]);
    const task = taskRes.rows[0];
    if (!task) return;

    let html = `📥 <b>SUBMISSION RECEIVED — PENDING REVIEW</b>\n\n`;
    html += `Hello <b>${escapeHtml(user.full_name)}</b>,\n`;
    html += `Your submission proof for <b>"${escapeHtml(task.title)}"</b> has been uploaded successfully!\n\n`;
    html += `📌 <b>Current Status:</b> ⏳ <code>PENDING REVIEW</code>\n`;
    html += `<i>Your Class Advisor / Coordinator will verify your submission soon. You will receive an instant notification here once reviewed.</i>\n`;
    html += getWatermarkHtml();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 View All Tasks', callback_data: 'cb_tasks' },
          { text: '🌐 Open Portal', url: getPortalUrl() }
        ]
      ]
    };

    sendTelegramMessage(user.telegram_chat_id, html, { reply_markup: keyboard }).catch(() => {});
  } catch (err) {
    console.error('[Telegram] notifyTaskSubmissionReceived error:', err);
  }
}

/**
 * 🎉 / ⚠️ Notify student when submission is VERIFIED (APPROVED) or REJECTED
 */
export async function notifySubmissionVerifiedOrRejected(
  submissionId: string,
  status: 'VERIFIED' | 'REJECTED',
  noteOrReason?: string
): Promise<void> {
  try {
    const subRes = await pool.query(`
      SELECT ts.id, ts.status, ts.rejection_reason, ts.verification_note,
             u.full_name, u.register_number, u.telegram_chat_id,
             t.title as task_title
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      JOIN tasks t ON ts.task_id = t.id
      WHERE ts.id = $1 LIMIT 1
    `, [submissionId]);

    const sub = subRes.rows[0];
    if (!sub || !sub.telegram_chat_id) return;

    let html = '';
    let keyboard: any;

    if (status === 'VERIFIED') {
      html = `🎉 <b>SUBMISSION APPROVED & VERIFIED!</b>\n\n`;
      html += `Hello <b>${escapeHtml(sub.full_name)}</b>,\n`;
      html += `Your submission for <b>"${escapeHtml(sub.task_title)}"</b> has been verified and approved!\n\n`;
      html += `✅ <b>Status:</b> <code>VERIFIED</code>\n`;
      if (noteOrReason) {
        html += `📝 <b>Reviewer Note:</b> <i>${escapeHtml(noteOrReason)}</i>\n`;
      }
      html += `\nKeep up the excellent work! 🚀\n`;
      html += getWatermarkHtml();

      keyboard = {
        inline_keyboard: [
          [
            { text: '📊 View My Scorecard', callback_data: 'cb_stats' },
            { text: '🌐 Open Portal', url: getPortalUrl() }
          ]
        ]
      };
    } else {
      html = `⚠️ <b>SUBMISSION REQUIRES CORRECTION</b>\n\n`;
      html += `Hello <b>${escapeHtml(sub.full_name)}</b>,\n`;
      html += `Your submission for <b>"${escapeHtml(sub.task_title)}"</b> was not approved.\n\n`;
      html += `❌ <b>Status:</b> <code>REJECTED</code>\n`;
      if (noteOrReason) {
        html += `📌 <b>Reason for Rejection:</b>\n<code>${escapeHtml(noteOrReason)}</code>\n\n`;
      }
      html += `👉 <i>Please review the remarks and upload your corrected proof on the portal!</i>\n`;
      html += getWatermarkHtml();

      keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Resubmit on Portal', url: getPortalUrl() },
            { text: '📋 My Pending Tasks', callback_data: 'cb_tasks' }
          ]
        ]
      };
    }

    sendTelegramMessage(sub.telegram_chat_id, html, { reply_markup: keyboard }).catch(() => {});
  } catch (err) {
    console.error('[Telegram] notifySubmissionVerifiedOrRejected error:', err);
  }
}

/**
 * 📦 Batch notify multiple verified submissions
 */
export async function notifySubmissionBatchVerified(submissionIds: string[]): Promise<void> {
  if (!submissionIds || submissionIds.length === 0) return;
  for (const sid of submissionIds) {
    notifySubmissionVerifiedOrRejected(sid, 'VERIFIED').catch(() => {});
  }
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

    const [tasksRes, studentsRes, lcRes, ghRes, lcIncompleteRes] = await Promise.all([
      pool.query(`
        SELECT t.id, t.title, t.category, t.deadline, t.status,
               COUNT(DISTINCT tc.class_id) as class_count,
               COUNT(DISTINCT ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_count
        FROM tasks t
        LEFT JOIN task_classes tc ON tc.task_id = t.id
        LEFT JOIN task_submissions ts ON ts.task_id = t.id
        WHERE t.status = 'OPEN' 
          AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
        GROUP BY t.id, t.title, t.category, t.deadline, t.status
        ORDER BY t.deadline ASC NULLS LAST
        LIMIT 5
      `),
      pool.query(`SELECT COUNT(*) as total_students, COUNT(telegram_chat_id) as linked_telegram_count FROM users WHERE role = 'STUDENT'`),
      pool.query(`SELECT COUNT(DISTINCT user_id) as active_solvers, SUM(solved_today) as total_problems_solved FROM leetcode_daily_progress WHERE date = $1 AND solved_today > 0`, [dateStr]),
      pool.query(`SELECT COUNT(DISTINCT student_id) as active_committers, SUM(daily_commit_count) as total_commits FROM github_daily_commits WHERE date = $1 AND daily_commit_count > 0`, [dateStr]),
      pool.query(`
        SELECT u.full_name, u.register_number, c.name as class_name,
               COALESCE(lp.solved_today, 0) as solved_today,
               lt.daily_target
        FROM users u
        LEFT JOIN classes c ON c.id = u.class_id
        LEFT JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
        JOIN LATERAL (
          SELECT daily_target FROM leetcode_targets
          WHERE start_date <= $1 AND end_date >= $1 AND (user_id = u.id OR class_id = u.class_id OR class_id IS NULL)
          ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
          LIMIT 1
        ) lt ON true
        WHERE u.role = 'STUDENT'
          AND lt.daily_target > 0
          AND COALESCE(lp.solved_today, 0) < lt.daily_target
        ORDER BY c.name, u.register_number ASC
      `, [dateStr])
    ]);

    const totalStudents = parseInt(studentsRes.rows[0]?.total_students || '0', 10);
    const linkedTelegram = parseInt(studentsRes.rows[0]?.linked_telegram_count || '0', 10);
    const lcSolvers = Number(lcRes.rows[0]?.active_solvers) || 0;
    const lcTotalSolved = Number(lcRes.rows[0]?.total_problems_solved) || 0;
    const ghCommitters = Number(ghRes.rows[0]?.active_committers) || 0;
    const ghTotalCommits = Number(ghRes.rows[0]?.total_commits) || 0;

    let html = `📊 <b>IT TASK MANAGER — DAILY DEPARTMENT BRIEF</b>\n`;
    html += `📅 <i>${dateStr} (IST)</i>\n`;
    html += `👥 <b>Total Students:</b> ${totalStudents} | 📱 <b>Telegram Linked:</b> ${linkedTelegram}\n`;
    html += `─────────────────────────\n\n`;

    html += `🚀 <b>Today's Coding Highlights:</b>\n`;
    html += `• 🧩 <b>LeetCode:</b> <b>${lcTotalSolved}</b> problems solved (${lcSolvers} active solvers)\n`;
    html += `• 💻 <b>GitHub:</b> <b>${ghTotalCommits}</b> commits pushed (${ghCommitters} active committers)\n`;

    // LeetCode Incomplete / Defaulters
    if (lcIncompleteRes.rows.length > 0) {
      const lcPendingCount = lcIncompleteRes.rows.length;
      const lcPendingNames = lcIncompleteRes.rows
        .map(p => `${escapeHtml(p.full_name)} (<code>${p.solved_today}/${p.daily_target}</code>)`)
        .join(', ');
      html += `• ⚠️ <b>LeetCode Incomplete (${lcPendingCount}):</b>\n   ${lcPendingNames}\n\n`;
    } else {
      html += `• ✨ <b>LeetCode Status:</b> All targeted students met today's goal! 🎉\n\n`;
    }

    if (tasksRes.rows.length === 0) {
      html += `✨ <b>No active assignments pending today! Keep up the great work!</b> 🎉\n`;
    } else {
      html += `📌 <b>Active Assignments:</b>\n\n`;
      
      for (let idx = 0; idx < tasksRes.rows.length; idx++) {
        const t = tasksRes.rows[idx];
        const completed = parseInt(t.completed_count || '0', 10);
        const deadlineStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
          : 'No deadline';
        
        const progressBar = totalStudents > 0 ? makeProgressBar(completed, totalStudents, 8) : '';

        // Query incomplete students for this specific task
        const pendingStudentsRes = await pool.query(`
          SELECT u.full_name, u.register_number, c.name as class_name
          FROM users u
          JOIN task_classes tc ON tc.class_id = u.class_id
          LEFT JOIN task_submissions ts ON ts.task_id = tc.task_id AND ts.user_id = u.id AND ts.status IN ('SUBMITTED', 'VERIFIED')
          LEFT JOIN classes c ON c.id = u.class_id
          WHERE tc.task_id = $1
            AND u.role = 'STUDENT'
            AND ts.id IS NULL
          ORDER BY c.name, u.register_number ASC
        `, [t.id]);

        const pendingCount = pendingStudentsRes.rows.length;

        html += `<b>${idx + 1}. ${escapeHtml(t.title)}</b>\n`;
        if (t.category) html += `   📂 <i>Category:</i> <code>${escapeHtml(t.category)}</code>\n`;
        html += `   ⏰ <i>Due:</i> ${deadlineStr}\n`;
        html += `   ✅ <i>Submissions:</i> <b>${completed}</b> ${progressBar}\n`;

        if (pendingCount === 0) {
          html += `   ✨ <i>Status: All assigned students completed!</i> 🎉\n\n`;
        } else {
          const pendingNames = pendingStudentsRes.rows
            .map(p => escapeHtml(p.full_name))
            .join(', ');
          html += `   ⏳ <b>Incomplete (${pendingCount}):</b> ${pendingNames}\n\n`;
        }
      }
    }

    html += getWatermarkHtml();

    const inlineKeyboard = {
      inline_keyboard: [
        [
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
        AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
      ORDER BY u.id, t.deadline ASC NULLS LAST
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
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
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
 * 🤖 Ultra-Fast Concurrent Poller for Interactive Telegram Commands & Callbacks
 */
let isPolling = false;
let lastUpdateId = 0;

export function startTelegramPoller(): void {
  const token = getBotToken();
  if (!token || isPolling) return;

  isPolling = true;
  console.log('[Telegram Bot] Ultra-fast concurrent poller started for interactive commands...');

  // Automatically register native Telegram command menu
  registerBotCommandsMenu().catch(err => console.warn('[Telegram Bot] Menu registration warning:', err));

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
        }

        // Process all updates concurrently in parallel
        await Promise.allSettled(data.result.map(async (update: any) => {
          // ── Handle Inline Button Callbacks ──────────────────────────────
          if (update.callback_query) {
            const cb = update.callback_query;
            const cbData = cb.data;
            const cbChatId = cb.message?.chat?.id;
            const cbUserId = cb.from?.id;

            // Fire answerCallbackQuery immediately to dismiss loading spinner
            if (cb.id) {
              answerCallbackQuery(cb.id).catch(() => {});
            }

            if (!cbChatId || !cbUserId) return;

            const userRes = await pool.query(`
              SELECT u.id, u.full_name, u.register_number, u.role, u.class_id, u.leetcode_url, u.github_url, c.name as class_name
              FROM users u
              LEFT JOIN classes c ON u.class_id = c.id
              WHERE u.telegram_chat_id = $1
              LIMIT 1
            `, [String(cbUserId)]);

            const user = userRes.rows[0];

            if (!user && cbData !== 'cb_help') {
              await sendTelegramMessage(
                cbChatId,
                `ℹ️ Your Telegram is not yet connected to a student profile.\n\nReply with <code>/link YOUR_REGISTER_NUMBER</code> to connect!\n${getWatermarkHtml()}`
              );
              return;
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
            return;
          }

          // ── Handle Text Messages & Commands ──────────────────────────────
          const msg = update.message;
          if (!msg) return;

          const chatId = msg.chat?.id;
          const isGroup = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
          const senderUserId = msg.from?.id || chatId;
          const fromUsername = msg.from?.username || '';
          const senderName = msg.from?.first_name || 'there';
          const text = (msg.text || '').trim();

          if (!text && !isGroup) return;

          // Auto-register group chat ID when active in a group
          if (isGroup && chatId) {
            getGroupChatId().then(currentSavedGroup => {
              if (!currentSavedGroup) setGroupChatId(String(chatId));
            }).catch(() => {});
          }

          // Command: /id
          if (text.startsWith('/id')) {
            await sendTelegramMessage(
              chatId,
              `ℹ️ <b>Chat Details:</b>\n• Chat ID: <code>${chatId}</code>\n• Chat Type: <code>${msg.chat?.type}</code>\n• Your User ID: <code>${senderUserId}</code>\n${getWatermarkHtml()}`
            );
            return;
          }

          // Command: /start <param> or /link <param>
          if (text.startsWith('/start') || text.startsWith('/link')) {
            const cleanText = text.replace(/@\w+/g, '');
            const parts = cleanText.split(/\s+/);
            const param = parts.slice(1).join(' ').trim() || text.replace(/^\/(?:start|link)[\s/]*/i, '').trim();

            if (param) {
              // Check if param is a class or year query (e.g. 2ita, 3itc, 2it, 3it, year3, 4it, 1ita)
              const cleanParam = param.toLowerCase().replace(/[@#/_]/g, '').trim();
              const isClassOrYear =
                /^(?:[1-4]\s*(?:it)?[a-d]|[1-4]\s*it|[1-4]\s*year|year\s*[1-4])$/i.test(cleanParam) ||
                cleanParam.startsWith('year') ||
                cleanParam.startsWith('class');

              if (isClassOrYear) {
                const card = await getClassOrYearAnalysisCard(param);
                await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
                return;
              }

              // Otherwise link student account with register number / username
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
            return;
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
            helpHtml += `• <code>/check &lt;Reg_No&gt;</code> (or send Reg No) - Complete student status (Tasks + LeetCode + GitHub)\n`;
            helpHtml += `• <code>/3ita</code>, <code>/3itb</code>, <code>/2ita</code>, <code>/2itb</code> - Instant class analysis report\n`;
            helpHtml += `• <code>/year3</code>, <code>/year2</code> - Year-wise department analysis\n`;
            helpHtml += `• <code>/tasks</code> - View pending assignments\n`;
            helpHtml += `• <code>/leetcode</code> (or <code>/lc</code>) - Daily LeetCode progress & targets\n`;
            helpHtml += `• <code>/github</code> (or <code>/gh</code>) - Daily GitHub commits & targets\n`;
            helpHtml += `• <code>/stats</code> - Overall performance scorecard\n`;
            helpHtml += `• <code>/status</code> - Connected profile info\n`;
            helpHtml += `• <code>/unlink</code> - Disconnect account\n`;

            if (user?.role === 'SUPREME_ADMIN' || user?.role === 'STAFF' || user?.role === 'COORDINATOR' || user?.role === 'HOD' || user?.role === 'CLASS_ADVISOR') {
              helpHtml += `\n<b>Staff / Coordinator Commands:</b>\n`;
              helpHtml += `• <code>/defaulters [class]</code> - Target defaulters report\n`;
              helpHtml += `• <code>/broadcast &lt;msg&gt;</code> - Send announcement to all students\n`;
              helpHtml += `• <code>/summary</code> - Class daily brief\n`;
            }

            helpHtml += getWatermarkHtml();
            await sendTelegramMessage(chatId, helpHtml, { reply_markup: keyboard });
            return;
          }

          // Command: /check <reg_no>, /lookup <reg_no>, /student <reg_no>, /progress <reg_no>, or /status <reg_no>
          if (
            text.startsWith('/check') ||
            text.startsWith('/lookup') ||
            text.startsWith('/student') ||
            (text.startsWith('/progress') && text.split(/\s+/).length > 1) ||
            (text.startsWith('/status') && text.split(/\s+/).length > 1)
          ) {
            const parts = text.split(/\s+/);
            const regQuery = parts.slice(1).join(' ').trim();
            if (regQuery) {
              const card = await getComprehensiveStudentProgressCard(regQuery);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
              return;
            } else {
              await sendTelegramMessage(
                chatId,
                `ℹ️ <b>Usage:</b> <code>/check &lt;Register_Number&gt;</code>\n\n<i>Example:</i> <code>/check 922524205001</code>\n${getWatermarkHtml()}`
              );
              return;
            }
          }

          // ── Class & Year Analysis Reports ───────────────────────────────────
          // Supports: /3ita, /3itb, /3itc, /2ita, /2itb, /2itc, /year3, /year2, /class 3ita, etc.
          const cleanNoMention = text.replace(/@\w+/g, '').trim();
          const cleanCandidate = text.replace(/[@#]/g, '').trim();

          const isClassOrYearShortcut =
            text.startsWith('/class') ||
            text.startsWith('/year') ||
            /^\/(?:[1-4]\s*(?:it)?[a-d]|[1-4]\s*year|year\s*[1-4])$/i.test(cleanNoMention) ||
            /^(?:[1-4]\s*it[a-d]|[1-4]\s*year|year\s*[1-4])$/i.test(cleanCandidate);

          if (isClassOrYearShortcut) {
            let classQuery = cleanNoMention;
            if (text.startsWith('/class') || text.startsWith('/year')) {
              const parts = cleanNoMention.split(/\s+/);
              classQuery = parts.slice(1).join(' ').trim() || parts[0];
            }
            const card = await getClassOrYearAnalysisCard(classQuery);
            await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            return;
          }

          // ── Automatic Register Number / Username Lookup ──────────────────
          // If anyone in a group or private DM simply types a Register Number
          if (!text.startsWith('/') && cleanCandidate.length >= 4 && cleanCandidate.length <= 25) {
            const studentCheck = await pool.query(`
              SELECT id FROM users 
              WHERE (REPLACE(LOWER(register_number), ' ', '') = $1 
                 OR LOWER(register_number) = $2 
                 OR REPLACE(LOWER(username), ' ', '') = $1
                 OR LOWER(username) = $2)
                AND role = 'STUDENT'
              LIMIT 1
            `, [cleanCandidate.toLowerCase().replace(/\s+/g, ''), cleanCandidate.toLowerCase()]);

            if (studentCheck.rows.length > 0) {
              const card = await getComprehensiveStudentProgressCard(cleanCandidate);
              if (card.found) {
                await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
                return;
              }
            }
          }

          // Command: /leetcode or /lc
          if (text.startsWith('/leetcode') || text.startsWith('/lc')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentLeetCodeCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            return;
          }

          // Command: /github or /gh
          if (text.startsWith('/github') || text.startsWith('/gh')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentGitHubCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            return;
          }

          // Command: /stats or /myprogress or /progress
          if (text.startsWith('/stats') || text.startsWith('/myprogress') || text.startsWith('/progress')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getStudentStatsCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            return;
          }

          // Command: /defaulters or /pendingtargets
          if (text.startsWith('/defaulters') || text.startsWith('/pendingtargets')) {
            const parts = text.split(/\s+/);
            const scopeFilter = parts.slice(1).join(' ');
            const card = await getDefaultersCard(scopeFilter);
            await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            return;
          }

          // Command: /broadcast <message> (Admin/Staff only)
          if (text.startsWith('/broadcast')) {
            if (!user || (user.role !== 'SUPREME_ADMIN' && user.role !== 'STAFF' && user.role !== 'COORDINATOR' && user.role !== 'HOD' && user.role !== 'CLASS_ADVISOR')) {
              await sendTelegramMessage(chatId, `⚠️ You do not have permission to send broadcasts.\n${getWatermarkHtml()}`);
              return;
            }

            const broadcastText = text.replace(/^\/broadcast\s*/i, '').trim();
            if (!broadcastText) {
              await sendTelegramMessage(chatId, `⚠️ Usage: <code>/broadcast Your message here</code>\n${getWatermarkHtml()}`);
              return;
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
            return;
          }

          // Command: /tasks or /pending or /mytasks
          if (text.startsWith('/tasks') || text.startsWith('/pending') || text.startsWith('/mytasks')) {
            if (!user) {
              await sendTelegramMessage(chatId, `ℹ️ Please link your student account first: <code>/link &lt;Register_Number&gt;</code>\n${getWatermarkHtml()}`);
            } else {
              const card = await getTasksCard(user);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            }
            return;
          }

          // Command: /unlink
          if (text.startsWith('/unlink')) {
            await pool.query(`
              UPDATE users
              SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL
              WHERE telegram_chat_id = $1
            `, [String(senderUserId)]);
            await sendTelegramMessage(chatId, `✅ Your Telegram has been disconnected from your IT TaskManager student account.\n${getWatermarkHtml()}`);
            return;
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
            return;
          }

          // Command: /summary or /report
          if (text.startsWith('/summary') || text.startsWith('/report')) {
            const res = await sendGroupSummary(String(chatId));
            if (!res.success) {
              await sendTelegramMessage(chatId, `⚠️ ${escapeHtml(res.message)}\n${getWatermarkHtml()}`);
            }
            return;
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
        }));
      }
    } catch (err: any) {
      // Graceful poll loop recovery
    } finally {
      if (isPolling) {
        setTimeout(poll, 500);
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
