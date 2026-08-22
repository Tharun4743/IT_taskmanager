import dotenv from 'dotenv';
dotenv.config();

import { pool } from './db.js';
import ExcelJS from 'exceljs';
import { constantStudentByRegNoMap } from './studentDirectoryService.js';
import { sendTaskStatusEmail } from './emailService.js';

let cachedBotUsername = process.env.TELEGRAM_BOT_USERNAME || 'IT_TaskManager_Alerts_bot';

export async function fetchBotUsername(): Promise<string> {
  const token = getBotToken();
  if (!token) return cachedBotUsername;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result?.username) {
      cachedBotUsername = data.result.username;
      return cachedBotUsername;
    }
  } catch (err: any) {
    console.warn('[Telegram Bot] Could not fetch getMe:', err.message);
  }
  return cachedBotUsername;
}

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
  return `\n───────────────────────────────\n👨‍💻 Developed by <a href="https://tharunkumark4743.netlify.app/">Tharunkumar K</a>\n🏛️ <i>Department of Information Technology, VSBEC</i>`;
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

let cachedGroupInviteLink: string | null = null;

export async function getGroupInviteLink(): Promise<string | null> {
  if (cachedGroupInviteLink) return cachedGroupInviteLink;

  // 1. Check system_settings table
  try {
    const res = await pool.query(`SELECT value FROM system_settings WHERE key = 'telegram_group_invite_link' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value && res.rows[0].value.trim()) {
      cachedGroupInviteLink = res.rows[0].value.trim();
      return cachedGroupInviteLink;
    }
  } catch (err) {
    // Ignore error
  }

  // 2. Check process.env
  if (process.env.TELEGRAM_GROUP_INVITE_LINK && process.env.TELEGRAM_GROUP_INVITE_LINK.trim()) {
    cachedGroupInviteLink = process.env.TELEGRAM_GROUP_INVITE_LINK.trim();
    return cachedGroupInviteLink;
  }

  // 3. Try to dynamically export or create invite link via Telegram API
  const token = getBotToken();
  const groupChatId = await getGroupChatId();
  if (token && groupChatId) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/exportChatInviteLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: groupChatId })
      });
      const data = await resp.json();
      if (data.ok && data.result) {
        cachedGroupInviteLink = data.result;
        pool.query(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES ('telegram_group_invite_link', $1, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [cachedGroupInviteLink]).catch(() => {});
        return cachedGroupInviteLink;
      }
    } catch (err) {
      console.warn('[Telegram] Could not export chat invite link automatically:', err);
    }
  }

  return null;
}

export async function setGroupInviteLink(link: string): Promise<void> {
  cachedGroupInviteLink = link.trim();
  await pool.query(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('telegram_group_invite_link', $1, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
  `, [link.trim()]);
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
 * Visual Multi-Color Tiered Progress Bar generator for Telegram Reports
 * e.g. 🟩🟩🟩🟩🟩🟩🟨🟨⬜⬜ 60%
 */
export function makeProgressBar(completed: number, total: number, size = 10): string {
  if (total <= 0) return '⬜'.repeat(size) + ' <b>0%</b>';
  const ratio = Math.min(Math.max(completed / total, 0), 1);
  const filled = Math.round(ratio * size);
  const empty = Math.max(0, size - filled);
  const percentage = Math.round(ratio * 100);

  let fillChar = '🟩';
  if (percentage < 30) fillChar = '🟥';
  else if (percentage < 60) fillChar = '🟧';
  else if (percentage < 85) fillChar = '🟨';
  else fillChar = '🟩';

  const badge = percentage === 100 ? ' 🌟' : '';
  return `${fillChar.repeat(filled)}${'⬜'.repeat(empty)} <b>${percentage}%</b>${badge}`;
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

export async function sendTelegramDocument(
  chatId: string | number,
  fileBuffer: Buffer,
  fileName: string,
  caption?: string
): Promise<{ ok: boolean; description?: string; result?: any }> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, description: 'No bot token configured.' };
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));

    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('document', blob, fileName);

    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!data.ok) {
      console.error(`[Telegram] Failed to send document to ${chatId}:`, data.description);
    }
    return data;
  } catch (err: any) {
    console.error(`[Telegram] Error sending document to ${chatId}:`, err.message);
    return { ok: false, description: err.message };
  }
}

/**
 * Delete a Telegram message (e.g., when tapping Close ❌)
 */
export async function deleteTelegramMessage(chatId: string | number, messageId: number): Promise<boolean> {
  const token = getBotToken();
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    const data = await response.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export function getYearFromClassName(className: string | null | undefined): string | null {
  if (!className) return null;
  const clean = className.trim().toUpperCase();

  if (/^IV/i.test(clean)) return '4';
  if (/^III/i.test(clean)) return '3';
  if (/^II/i.test(clean)) return '2';
  if (/^I/i.test(clean)) return '1';

  const match = clean.match(/^([1-4])/);
  if (match) return match[1];

  return null;
}

export async function buildIncompleteExcelBuffer(
  lcIncompleteRows: any[],
  pendingTasksData: any[],
  allStudentsProgress: any[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IT Task Manager';
  workbook.created = new Date();

  // Find all distinct years in the student progress
  const years = new Set<string>();
  allStudentsProgress.forEach(r => {
    const className = r.class_name ? String(r.class_name).trim() : '';
    const year = getYearFromClassName(className);
    if (year) {
      years.add(year);
    }
  });

  const sortedYears = Array.from(years).sort();

  for (const year of sortedYears) {
    const romanYear = year === '1' ? 'I' : year === '2' ? 'II' : year === '3' ? 'III' : 'IV';

    // --- 1. LeetCode WorkSheet ---
    const sheetLc = workbook.addWorksheet(`${year}IT Leetcode`, { views: [{ showGridLines: true }] });
    // Title Block
    sheetLc.mergeCells('A1:F1');
    const title1 = sheetLc.getCell('A1');
    title1.value = 'VSB ENGINEERING COLLEGE - DEPARTMENT OF IT';
    title1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetLc.getRow(1).height = 25;

    sheetLc.mergeCells('A2:F2');
    const subtitle1 = sheetLc.getCell('A2');
    subtitle1.value = `${romanYear} YEAR - LEETCODE INCOMPLETE SOLVERS`;
    subtitle1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF475569' } };
    subtitle1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetLc.getRow(2).height = 20;

    sheetLc.getRow(4).values = ['S.No', 'Register Number', 'Student Name', 'Section', 'Solved Today', 'Daily Target'];
    sheetLc.getRow(4).font = { bold: true };
    sheetLc.getRow(4).height = 20;

    const yearLcPending = lcIncompleteRows.filter(r => {
      const className = r.class_name ? String(r.class_name).trim() : '';
      return getYearFromClassName(className) === year;
    });

    if (yearLcPending.length === 0) {
      sheetLc.getCell(5, 1).value = 'All targeted students met today\'s goal! 🎉';
      sheetLc.getCell(5, 1).font = { italic: true };
    } else {
      yearLcPending.forEach((r, idx) => {
        let sec = 'A';
        const className = r.class_name ? String(r.class_name).trim() : '';
        const match = className.match(/^([1-4])\s*(it)?\s*([a-d])$/i) || className.match(/^(?:iii|ii|iv|i)\s*(?:it)?\s*([a-d])$/i);
        if (match) {
          sec = (match[3] || match[1] || 'A').toUpperCase();
        }
        sheetLc.addRow([
          idx + 1,
          r.register_number || '',
          r.full_name || '',
          sec,
          Number(r.solved_today) || 0,
          Number(r.leetcode_target) || 0
        ]);
      });
    }

    sheetLc.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell!({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength + 3;
    });

    // --- 2. GitHub WorkSheet ---
    const sheetGh = workbook.addWorksheet(`${year}IT Github`, { views: [{ showGridLines: true }] });
    sheetGh.mergeCells('A1:E1');
    const title2 = sheetGh.getCell('A1');
    title2.value = 'VSB ENGINEERING COLLEGE - DEPARTMENT OF IT';
    title2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetGh.getRow(1).height = 25;

    sheetGh.mergeCells('A2:E2');
    const subtitle2 = sheetGh.getCell('A2');
    subtitle2.value = `${romanYear} YEAR - GITHUB INACTIVE COMMITTERS (0 COMMITS)`;
    subtitle2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF475569' } };
    subtitle2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetGh.getRow(2).height = 20;

    sheetGh.getRow(4).values = ['S.No', 'Register Number', 'Student Name', 'Section', 'Commits Today'];
    sheetGh.getRow(4).font = { bold: true };
    sheetGh.getRow(4).height = 20;

    const yearGhPending = allStudentsProgress.filter(r => {
      const className = r.class_name ? String(r.class_name).trim() : '';
      return getYearFromClassName(className) === year && (Number(r.commits_today) || 0) === 0;
    });

    if (yearGhPending.length === 0) {
      sheetGh.getCell(5, 1).value = 'All students active on GitHub today! 🎉';
      sheetGh.getCell(5, 1).font = { italic: true };
    } else {
      yearGhPending.forEach((r, idx) => {
        let sec = 'A';
        const className = r.class_name ? String(r.class_name).trim() : '';
        const match = className.match(/^([1-4])\s*(it)?\s*([a-d])$/i) || className.match(/^(?:iii|ii|iv|i)\s*(?:it)?\s*([a-d])$/i);
        if (match) {
          sec = (match[3] || match[1] || 'A').toUpperCase();
        }
        sheetGh.addRow([
          idx + 1,
          r.register_number || '',
          r.full_name || '',
          sec,
          0
        ]);
      });
    }

    sheetGh.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell!({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength + 3;
    });

    // --- 3. Task WorkSheet ---
    const sheetTk = workbook.addWorksheet(`${year}IT Task`, { views: [{ showGridLines: true }] });
    sheetTk.mergeCells('A1:G1');
    const title3 = sheetTk.getCell('A1');
    title3.value = 'VSB ENGINEERING COLLEGE - DEPARTMENT OF IT';
    title3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    title3.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetTk.getRow(1).height = 25;

    sheetTk.mergeCells('A2:G2');
    const subtitle3 = sheetTk.getCell('A2');
    subtitle3.value = `${romanYear} YEAR - PENDING TASK SUBMISSIONS`;
    subtitle3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF475569' } };
    subtitle3.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetTk.getRow(2).height = 20;

    sheetTk.getRow(4).values = ['S.No', 'Register Number', 'Student Name', 'Section', 'Task Title', 'Category', 'Due Date'];
    sheetTk.getRow(4).font = { bold: true };
    sheetTk.getRow(4).height = 20;

    const yearTasksPending = pendingTasksData.filter(r => {
      const className = r.className ? String(r.className).trim() : '';
      return getYearFromClassName(className) === year;
    });

    if (yearTasksPending.length === 0) {
      sheetTk.getCell(5, 1).value = 'All assigned tasks completed! 🎉';
      sheetTk.getCell(5, 1).font = { italic: true };
    } else {
      yearTasksPending.forEach((r, idx) => {
        sheetTk.addRow([
          idx + 1,
          r.registerNumber || '',
          r.studentName || '',
          r.className.replace(/^(?:I|II|III|IV|\d+)\s*(?:IT)?\s*/i, '').trim() || 'A',
          r.taskTitle || '',
          r.category || '',
          r.deadline || ''
        ]);
      });
    }

    sheetTk.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell!({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength + 3;
    });
  }

  // Double-insurance: Ensure at least one worksheet is created to prevent Excel corruption
  if (workbook.worksheets.length === 0) {
    const summarySheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: true }] });
    summarySheet.getCell('A1').value = 'No incomplete reports generated for today.';
    summarySheet.getCell('A1').font = { italic: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Answer inline callback queries immediately from button clicks
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean): Promise<void> {
  const token = getBotToken();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
        show_alert: showAlert || false
      })
    });
  } catch { }
}

export async function sendPrivateActionWarning(chatId: string | number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `ℹ️ <b>Private Action Only</b>\n\nPlease chat with the <b>IT Task Manager Private Bot</b> (@IT_TaskManager_Alerts_bot) directly to check your personal details, coding progress, and tasks.\n${getWatermarkHtml()}`
  );
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
      { command: 'deadlines', description: 'View tasks ending in the next 24 hours' },
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
 * Generates an interactive keyboard with one-tap action buttons (2-Column Grid)
 */
export function getInteractiveMenuKeyboard(role?: string) {
  const portalUrl = getPortalUrl();

  if (role && (role === 'SUPREME_ADMIN' || role === 'STAFF' || role === 'COORDINATOR' || role === 'HOD' || role === 'CLASS_ADVISOR')) {
    return {
      inline_keyboard: [
        [
          { text: '📊 Group Brief', callback_data: 'cb_summary' },
          { text: '⚠️ Defaulters', callback_data: 'cb_defaulters' }
        ],
        [
          { text: '⏰ 24h Deadlines', callback_data: 'cb_deadlines' },
          { text: '📋 Task Status', callback_data: 'cb_task_status' }
        ],
        [
          { text: '🏆 Leaderboard', callback_data: 'cb_leaderboard' },
          { text: '🔎 Student Search', callback_data: 'cb_search_help' }
        ],
        [
          { text: '👥 Dept Group', callback_data: 'cb_group_link' },
          { text: '🌐 Admin Portal', url: portalUrl }
        ]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        { text: '📋 My Tasks', callback_data: 'cb_tasks' },
        { text: '⏰ 24h Deadlines', callback_data: 'cb_deadlines' }
      ],
      [
        { text: '🧩 LeetCode', callback_data: 'cb_leetcode' },
        { text: '💻 GitHub', callback_data: 'cb_github' }
      ],
      [
        { text: '📊 Scorecard', callback_data: 'cb_stats' },
        { text: '👤 My Profile', callback_data: 'cb_profile' }
      ],
      [
        { text: '🏆 Leaderboard', callback_data: 'cb_leaderboard' },
        { text: '🌐 Web Portal', url: portalUrl }
      ],
      [
        { text: '👥 Join Telegram Group', callback_data: 'cb_group_link' }
      ]
    ]
  };
}

/**
 * 👥 Telegram Group Invitation & Recommendation Card
 */
export async function getGroupRecommendationCard(): Promise<{ html: string; keyboard: any }> {
  const inviteLink = await getGroupInviteLink();
  const groupChatId = await getGroupChatId();

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  👥  <b>OFFICIAL TELEGRAM GROUP</b>  🏛️\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>📢 <b>Join Your Department Community!</b>\n`;
  html += `Connect with classmates and faculty to stay ahead on all academic updates.</blockquote>\n\n`;

  html += `🌟 <b>WHAT YOU GET IN THE GROUP:</b>\n`;
  html += ` ├ 🏆 <b>Daily Coding Leaderboards</b> (Top Solvers & Committers)\n`;
  html += ` ├ 📊 <b>Section & Year Performance Briefs</b> (Morning & Evening)\n`;
  html += ` ├ ⏰ <b>Live Assignment Deadlines & Reminders</b>\n`;
  html += ` └ 📢 <b>Department & Faculty Official Announcements</b>\n\n`;

  if (inviteLink) {
    html += `👉 <b>Tap the button below to join the group directly!</b>\n`;
  } else if (groupChatId) {
    html += `👉 <i>Ask your Class Advisor or Coordinator to add you to Group ID:</i> <code>${escapeHtml(groupChatId)}</code>\n`;
  } else {
    html += `👉 <i>Contact your Department Administrator for the official group invite link!</i>\n`;
  }

  html += getWatermarkHtml();

  const keyboard: any = {
    inline_keyboard: []
  };

  if (inviteLink) {
    keyboard.inline_keyboard.push([
      { text: '🚀 Join Telegram Group Now', url: inviteLink }
    ]);
  }

  keyboard.inline_keyboard.push([
    { text: '📋 My Tasks', callback_data: 'cb_tasks' },
    { text: '📊 My Scorecard', callback_data: 'cb_stats' }
  ]);
  keyboard.inline_keyboard.push([
    { text: '📱 Main Menu', callback_data: 'cb_menu' },
    { text: '🌐 Open Portal', url: getPortalUrl() }
  ]);

  return { html, keyboard };
}

/**
 * 🏆 Dedicated Coding Leaderboard Card (Top Solvers & Committers)
 */
export async function getLeaderboardCard(): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();
  const [ghRes, lcRes] = await Promise.all([
    pool.query(`
      SELECT u.full_name, COALESCE(gh.daily_commit_count, 0) as commits_today
      FROM users u
      JOIN github_daily_commits gh ON gh.student_id = u.id AND gh.date = $1
      WHERE u.role = 'STUDENT' AND gh.daily_commit_count > 0
      ORDER BY gh.daily_commit_count DESC, u.full_name ASC
      LIMIT 5
    `, [dateStr]),
    pool.query(`
      SELECT u.full_name, COALESCE(lp.solved_today, 0) as solved_today
      FROM users u
      JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
      WHERE u.role = 'STUDENT' AND lp.solved_today > 0
      ORDER BY lp.solved_today DESC, u.full_name ASC
      LIMIT 5
    `, [dateStr])
  ]);

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  🏆  <b>TODAY'S CODING LEADERBOARD</b>  🏆\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n💡 <i>Live rankings updated automatically!</i></blockquote>\n\n`;

  html += `💻 <b>GITHUB TOP COMMITTERS:</b>\n`;
  if (ghRes.rows.length === 0) {
    html += ` └ <i>No commits recorded today yet.</i>\n\n`;
  } else {
    ghRes.rows.forEach((r, idx) => {
      const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
      const isLast = idx === ghRes.rows.length - 1;
      html += ` ${isLast ? '└' : '├'} ${rankEmoji} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.commits_today}</code> commits 🔥\n`;
    });
    html += `\n`;
  }

  html += `🧩 <b>LEETCODE TOP SOLVERS:</b>\n`;
  if (lcRes.rows.length === 0) {
    html += ` └ <i>No problems solved today yet.</i>\n\n`;
  } else {
    lcRes.rows.forEach((r, idx) => {
      const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
      const isLast = idx === lcRes.rows.length - 1;
      html += ` ${isLast ? '└' : '├'} ${rankEmoji} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.solved_today}</code> solved 💎\n`;
    });
    html += `\n`;
  }

  html += `<blockquote>🚀 <b>Keep coding and climb the daily leaderboard!</b></blockquote>\n`;
  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Board', callback_data: 'cb_leaderboard' },
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
 * 🧩 LeetCode Card for a Student
 */
export async function getStudentLeetCodeCard(user: any): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();
  const week = getWeekRange(dateStr);

  const [dailyRes, weeklyRes, targetRes] = await Promise.all([
    pool.query(`SELECT solved_today, total_solved FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`SELECT SUM(solved_today) as solved_week FROM leetcode_daily_progress WHERE user_id = $1 AND date >= $2 AND date <= $3`, [user.id, week.start, week.end]),
    pool.query(`
      SELECT daily_target, weekly_target FROM leetcode_targets
      WHERE start_date <= $1 AND end_date >= $1 AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
      LIMIT 1
    `, [dateStr, user.id, user.class_id])
  ]);

  const solvedToday = Number(dailyRes.rows[0]?.solved_today) || 0;
  const totalSolved = Number(dailyRes.rows[0]?.total_solved) || 0;
  const solvedWeek = Number(weeklyRes.rows[0]?.solved_week) || 0;
  const dailyTarget = Number(targetRes.rows[0]?.daily_target) || 0;
  const weeklyTarget = Number(targetRes.rows[0]?.weekly_target) || 0;

  const statusBadge = (dailyTarget > 0 && solvedToday >= dailyTarget)
    ? '🟢 [ MET ]'
    : (dailyTarget > 0 ? '🟡 [ PENDING ]' : '⚪ [ NO TARGET ]');

  const weeklyBadge = (weeklyTarget > 0 && solvedWeek >= weeklyTarget)
    ? '🟢 [ MET ]'
    : (weeklyTarget > 0 ? '🟡 [ PENDING ]' : '⚪ [ NO TARGET ]');

  const progressBar = dailyTarget > 0 ? makeProgressBar(solvedToday, dailyTarget, 8) : '';

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  🧩  <b>LEETCODE PROGRESS SCORECARD</b>  ⚡\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name || 'Student')}</b>\n`;
  html += `🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i></blockquote>\n\n`;

  html += `📊 <b>TODAY'S DAILY TARGET:</b>\n`;
  html += ` ├ 🎯 <b>Target:</b> <code>${dailyTarget || '—'}</code> problems\n`;
  html += ` ├ ⚡ <b>Solved Today:</b> <b>${solvedToday}</b> / ${dailyTarget || '—'} ${statusBadge}\n`;
  if (progressBar) html += ` └ 📈 <b>Daily Progress:</b> ${progressBar}\n`;
  else html += ` └ 📈 <b>Daily Progress:</b> <i>No target configured for today</i>\n`;

  html += `\n📅 <b>WEEKLY PERFORMANCE:</b>\n`;
  html += ` ├ 🏆 <b>This Week:</b> <b>${solvedWeek}</b> / ${weeklyTarget || '—'} ${weeklyBadge}\n`;
  html += ` └ 🌟 <b>All-Time Solved:</b> <code>${totalSolved}</code> problems\n`;

  if (user.leetcode_url) {
    html += `\n🔗 <b>Profile Link:</b> <a href="${escapeHtml(user.leetcode_url)}">View LeetCode Profile</a>\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Sync LeetCode', callback_data: 'cb_leetcode' },
        { text: '💻 GitHub Card', callback_data: 'cb_github' }
      ],
      [
        { text: '📊 My Scorecard', callback_data: 'cb_stats' },
        { text: '📋 My Tasks', callback_data: 'cb_tasks' }
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

  const commitBadge = commitsToday > 0 ? '🔥 [ ACTIVE ]' : '⚪ [ NO COMMITS ]';

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  💻  <b>GITHUB ACTIVITY SCORECARD</b>  🐙\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name || 'Student')}</b>\n`;
  html += `🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i></blockquote>\n\n`;

  html += `📊 <b>COMMIT VELOCITY:</b>\n`;
  html += ` ├ 🚀 <b>Today's Commits:</b> <code>${commitsToday}</code> commits ${commitBadge}\n`;
  html += ` ├ 📈 <b>This Week's Total:</b> <code>${commitsWeek}</code> commits pushed\n`;
  html += ` └ 🐙 <b>GitHub Handle:</b> <code>${escapeHtml(user.github_url ? user.github_url.replace(/https?:\/\/(?:www\.)?github\.com\/?/i, '@') : 'Not linked')}</code>\n`;

  if (user.github_url) {
    html += `\n🔗 <b>Repository Link:</b> <a href="${escapeHtml(user.github_url)}">View GitHub Profile</a>\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Sync GitHub', callback_data: 'cb_github' },
        { text: '🧩 LeetCode Card', callback_data: 'cb_leetcode' }
      ],
      [
        { text: '📊 My Scorecard', callback_data: 'cb_stats' },
        { text: '📋 My Tasks', callback_data: 'cb_tasks' }
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
 * 📊 Simple Combined Progress Card (My Progress)
 */
export async function getStudentStatsCard(user: any): Promise<{ html: string; keyboard: any }> {
  const dateStr = getISTDateStr();

  const [lcRes, lcTargetRes, ghRes, tasksRes] = await Promise.all([
    pool.query(`SELECT solved_today FROM leetcode_daily_progress WHERE user_id = $1 AND date = $2 LIMIT 1`, [user.id, dateStr]),
    pool.query(`
      SELECT daily_target FROM leetcode_targets
      WHERE start_date <= $1 AND end_date >= $1 AND (user_id = $2 OR class_id = $3 OR class_id IS NULL)
      ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
      LIMIT 1
    `, [dateStr, user.id, user.class_id]),
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

  const lcSolved = Number(lcRes.rows[0]?.solved_today) || 0;
  const lcTarget = Number(lcTargetRes.rows[0]?.daily_target) || 0;
  const ghCommits = Number(ghRes.rows[0]?.daily_commit_count) || 0;
  const totalTasks = Number(tasksRes.rows[0]?.total_assigned) || 0;
  const completedTasks = Number(tasksRes.rows[0]?.completed_tasks) || 0;
  const pendingTasks = Math.max(0, totalTasks - completedTasks);

  let overall = '🌟 Good Progress';
  if (pendingTasks === 0 && (lcTarget === 0 || lcSolved >= lcTarget)) {
    overall = '🔥 Outstanding — All Targets Met!';
  } else if (pendingTasks > 0 && lcSolved === 0 && ghCommits === 0) {
    overall = '⚠️ Action Required — Targets Pending';
  }

  const taskMeter = totalTasks > 0 ? makeProgressBar(completedTasks, totalTasks, 8) : '✨ No tasks';

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📊  <b>STUDENT PERFORMANCE SCORECARD</b>  🎯\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name)}</b>\n`;
  html += `🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `🏫 <b>Class:</b> <code>${escapeHtml(user.class_name || 'IT Dept')}</code>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i></blockquote>\n\n`;

  html += `📋 <b>ACADEMIC ASSIGNMENTS:</b>\n`;
  html += ` ├ 🎯 <b>Completed:</b> <code>${completedTasks} / ${totalTasks}</code>\n`;
  html += ` ├ 📊 <b>Progress:</b> ${taskMeter}\n`;
  html += ` └ ⏳ <b>Status:</b> ${pendingTasks === 0 ? '✨ <i>All assignments completed! 🎉</i>' : `<b>${pendingTasks}</b> assignment${pendingTasks === 1 ? '' : 's'} pending`}\n\n`;

  html += `🧩 <b>LEETCODE CODING TARGET:</b>\n`;
  html += ` ├ ⚡ <b>Today:</b> <code>${lcSolved} / ${lcTarget || '—'}</code>\n`;
  html += ` └ 🏷️ <b>Status:</b> ${lcTarget > 0 && lcSolved >= lcTarget ? '🟢 [ MET ]' : (lcTarget > 0 ? '🟡 [ PENDING ]' : '⚪ [ NO TARGET ]')}\n\n`;

  html += `💻 <b>GITHUB COMMITS:</b>\n`;
  html += ` ├ 🚀 <b>Today's Commits:</b> <code>${ghCommits}</code> commit${ghCommits === 1 ? '' : 's'}\n`;
  html += ` └ 🏷️ <b>Status:</b> ${ghCommits > 0 ? '🔥 [ ACTIVE ]' : '⚪ [ NO COMMITS ]'}\n\n`;

  html += `<blockquote>🎯 <b>EVALUATION:</b> ${overall}</blockquote>\n`;
  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 View Tasks', callback_data: 'cb_tasks' },
        { text: '🔄 Refresh Stats', callback_data: 'cb_stats' }
      ],
      [
        { text: '🧩 LeetCode', callback_data: 'cb_leetcode' },
        { text: '💻 GitHub', callback_data: 'cb_github' }
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
 * 👤 Comprehensive Profile Card for a Student
 */
export async function getProfileCard(user: any): Promise<{ html: string; keyboard: any }> {
  try {
    const [profileRes, statsRes] = await Promise.all([
      pool.query(`
        SELECT 
          u.id, u.full_name, u.register_number, u.email, u.gender, u.phone,
          u.leetcode_url, u.github_url, u.telegram_chat_id, u.telegram_username, u.telegram_linked_at,
          c.name as class_name, c.year, c.batch,
          d.name as dept_name,
          sp.mobile_number, sp.date_of_birth, sp.semester, sp.cgpa, sp.current_arrears, sp.history_of_arrears, sp.about_me
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `, [user.id]),
      pool.query(`
        SELECT 
          (SELECT COUNT(DISTINCT ts.id) FROM task_submissions ts WHERE ts.user_id = $1 AND ts.status = 'VERIFIED') as verified_tasks,
          (SELECT COUNT(DISTINCT t.id) FROM tasks t JOIN task_classes tc ON tc.task_id = t.id WHERE tc.class_id = $2 AND t.status = 'OPEN') as total_tasks,
          (SELECT COALESCE(MAX(total_solved), 0) FROM leetcode_daily_progress WHERE user_id = $1) as lc_solved,
          (SELECT COALESCE(SUM(daily_commit_count), 0) FROM github_daily_commits WHERE student_id = $1) as gh_commits
      `, [user.id, user.class_id])
    ]);

    const p = profileRes.rows[0] || user;
    const s = statsRes.rows[0] || {};

    const regKey = p.register_number ? p.register_number.toLowerCase().trim() : '';
    const dir = regKey ? constantStudentByRegNoMap.get(regKey) : null;
    const effectiveLc = p.leetcode_url || dir?.leetcode || 'Not set';
    const effectiveGh = p.github_url || dir?.github || 'Not set';

    let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  👤  <b>STUDENT COMPREHENSIVE PROFILE</b>  🎓\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    html += `<blockquote>📌 <b>Full Name:</b> <b>${escapeHtml(p.full_name)}</b>\n`;
    html += `🆔 <b>Register No:</b> <code>${escapeHtml(p.register_number || p.username)}</code>\n`;
    html += `🏫 <b>Class & Year:</b> <code>${escapeHtml(p.class_name || 'N/A')}</code> (${p.year ? `Year ${p.year}` : 'IT Dept'})\n`;
    if (p.batch) html += `🎓 <b>Batch:</b> <code>${escapeHtml(p.batch)}</code>\n`;
    if (p.semester) html += `📚 <b>Semester:</b> <code>Sem ${p.semester}</code>\n`;
    if (p.cgpa) html += `🎯 <b>CGPA:</b> <code>${p.cgpa}</code>\n`;
    html += `📧 <b>Email:</b> <code>${escapeHtml(p.email || 'N/A')}</code>\n`;
    if (p.mobile_number || p.phone) html += `📱 <b>Phone:</b> <code>${escapeHtml(p.mobile_number || p.phone)}</code>\n`;
    html += `</blockquote>\n\n`;

    html += `🌐 <b>CODING & SOCIAL PROFILES:</b>\n`;
    html += ` ├ 🧩 <b>LeetCode:</b> <code>${escapeHtml(effectiveLc)}</code>\n`;
    html += ` ├ 🐙 <b>GitHub:</b> <code>${escapeHtml(effectiveGh)}</code>\n`;
    html += ` └ ✈️ <b>Telegram:</b> 🟢 Connected (${p.telegram_username ? `@${escapeHtml(p.telegram_username)}` : 'Personal DM'})\n\n`;

    html += `📊 <b>PORTAL PERFORMANCE METRICS:</b>\n`;
    html += ` ├ 📋 <b>Tasks Verified:</b> <b>${s.verified_tasks || 0} / ${s.total_tasks || 0}</b>\n`;
    html += ` ├ 🧩 <b>LeetCode Solved:</b> <b>${s.lc_solved || 0}</b> problems\n`;
    html += ` └ 💻 <b>GitHub Commits:</b> <b>${s.gh_commits || 0}</b> commits\n`;
    html += getWatermarkHtml();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 My Tasks', callback_data: 'cb_tasks' },
          { text: '📊 My Scorecard', callback_data: 'cb_stats' }
        ],
        [
          { text: '🧩 LeetCode Card', callback_data: 'cb_leetcode' },
          { text: '💻 GitHub Card', callback_data: 'cb_github' }
        ],
        [
          { text: '📱 Main Menu', callback_data: 'cb_menu' },
          { text: '🌐 Open Portal', url: getPortalUrl() }
        ]
      ]
    };

    return { html, keyboard };
  } catch (err: any) {
    console.error('[Telegram] getProfileCard error:', err);
    return {
      html: `👤 <b>MY PROFILE</b>\n\n• <b>Name:</b> ${escapeHtml(user.full_name)}\n• <b>Register No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n• <b>Telegram:</b> 🟢 Connected\n${getWatermarkHtml()}`,
      keyboard: { inline_keyboard: [[{ text: '📱 Main Menu', callback_data: 'cb_menu' }]] }
    };
  }
}

/**
 * 📋 Faculty Task Status Card
 */
export async function getFacultyTaskStatusCard(): Promise<{ html: string; keyboard: any }> {
  const tasksRes = await pool.query(`
    SELECT t.id, t.title, t.deadline,
           COUNT(DISTINCT tc.class_id) as class_count,
           COUNT(DISTINCT ts.id) FILTER (WHERE ts.status IN ('SUBMITTED', 'VERIFIED')) as completed_count
    FROM tasks t
    LEFT JOIN task_classes tc ON tc.task_id = t.id
    LEFT JOIN task_submissions ts ON ts.task_id = t.id
    WHERE t.status = 'OPEN' AND (t.deadline IS NULL OR t.deadline >= CURRENT_TIMESTAMP)
    GROUP BY t.id, t.title, t.deadline
    ORDER BY t.deadline ASC NULLS LAST
    LIMIT 6
  `);

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📋  <b>ACTIVE TASK STATUS OVERVIEW</b>  🏛️\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
  if (tasksRes.rows.length === 0) {
    html += `✨ <i>No active assignments currently open.</i>\n`;
  } else {
    tasksRes.rows.forEach((t, i) => {
      const dStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';
      html += `📌 <b>${i + 1}. ${escapeHtml(t.title)}</b>\n`;
      html += `   ⏰ <i>Due:</i> ${dStr}  |  ✅ <i>Submissions:</i> <b>${t.completed_count}</b>\n\n`;
    });
  }
  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📢 Group Brief', callback_data: 'cb_summary' },
        { text: '⚠️ Defaulters', callback_data: 'cb_defaulters' }
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
    ? (lcSolvedToday >= lcDailyTarget ? '🟢 [ MET ]' : '🟡 [ IN PROGRESS ]')
    : '⚪ [ NO TARGET ]';

  // GitHub calculations
  const ghCommitsToday = Number(ghDailyRes.rows[0]?.daily_commit_count) || 0;
  const ghCommitsWeek = Number(ghWeeklyRes.rows[0]?.commits_week) || 0;

  // Tasks calculations
  const totalTasks = Number(tasksAssignedRes.rows[0]?.total_assigned) || 0;
  const completedTasks = Number(tasksAssignedRes.rows[0]?.completed_tasks) || 0;
  const taskProgress = totalTasks > 0 ? makeProgressBar(completedTasks, totalTasks, 8) : '✨ 0%';
  const pendingTasksList = activePendingTasksRes.rows;

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📊  <b>STUDENT PERFORMANCE CARD</b>  🎓\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name)}</b>\n`;
  html += `🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `🏫 <b>Class:</b> <code>${escapeHtml(user.class_name || 'IT Department')}</code>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i></blockquote>\n\n`;

  html += `📋 <b>ACADEMIC TASKS:</b>\n`;
  html += ` ├ 🎯 <b>Completed:</b> <code>${completedTasks} / ${totalTasks}</code>\n`;
  html += ` ├ 📊 <b>Progress:</b> ${taskProgress}\n`;
  if (pendingTasksList.length === 0) {
    html += ` └ ✨ <i>Status: All active assignments completed! 🎉</i>\n\n`;
  } else {
    html += ` └ ⏳ <b>Pending Assignments (${pendingTasksList.length}):</b>\n`;
    pendingTasksList.forEach((t, i) => {
      const dStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';
      html += `    • <b>${escapeHtml(t.title)}</b> (<i>Due: ${dStr}</i>)\n`;
    });
    html += `\n`;
  }

  html += `🧩 <b>LEETCODE TARGET:</b>\n`;
  html += ` ├ ⚡ <b>Today:</b> <code>${lcSolvedToday} / ${lcDailyTarget}</code> ${lcDailyStatus}\n`;
  html += ` ├ 🏆 <b>This Week:</b> <code>${lcSolvedWeek} / ${lcWeeklyTarget}</code> problems\n`;
  html += ` └ 🌟 <b>Total Solved:</b> <code>${lcTotalSolved}</code> problems\n\n`;

  html += `💻 <b>GITHUB COMMITS:</b>\n`;
  html += ` ├ 🚀 <b>Today's Commits:</b> <code>${ghCommitsToday}</code> commits\n`;
  html += ` └ 📈 <b>This Week:</b> <code>${ghCommitsWeek}</code> commits\n`;

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 View Tasks', callback_data: 'cb_tasks' },
        { text: '📊 Full Stats', callback_data: 'cb_stats' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
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
export async function getClassOrYearAnalysisCard(
  queryText: string,
  chatId?: string | number
): Promise<{ found: boolean; html: string; keyboard?: any }> {
  const clean = queryText.toLowerCase().replace(/[@#/_]/g, '').trim();
  const dateStr = getISTDateStr();

  let targetYear: number | null = null;
  let targetSection: string | null = null;
  let isYearOnly = false;

  // Convert Roman numerals if present
  let normalized = clean
    .replace(/^iii\s*it/, '3it')
    .replace(/^ii\s*it/, '2it')
    .replace(/^iv\s*it/, '4it')
    .replace(/^i\s*it/, '1it')
    .replace(/^iii/, '3')
    .replace(/^ii/, '2')
    .replace(/^iv/, '4')
    .replace(/^i/, '1');

  // Pattern 1: Year-only e.g. '2it', '3it', '4it', '1it', 'year3', '3year', 'link2it', 'link3it', 'y3', 'year 3'
  const yearMatch = normalized.match(/^(?:link)?\s*(?:year|y)?\s*([1-4])\s*(?:it|year|yr)?$/i) || normalized.match(/^([1-4])\s*(?:it|year|yr)$/i);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1], 10);
    isYearOnly = true;
  }

  // Pattern 2: Specific Class with section e.g. '3ita', '3itb', '3itc', '2ita', '2itb', '2itc', 'link2ita', 'link3itc', '3a', '3b', '2a', '2b'
  const classMatch = normalized.match(/^(?:link)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i) || normalized.match(/^(?:link)?\s*(?:it)?\s*([1-4])\s*([a-d])$/i) || normalized.match(/^(?:class)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i);
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
      html: `⚠️ <b>Class Not Found</b>\n\nNo active class found matching: <code>${escapeHtml(queryText)}</code>\n\n<i>Available helper shortcuts:</i>\n• <code>/check 3itc</code>, <code>/check 3ita</code>, <code>/check 3itb</code> (III Year Sections)\n• <code>/check 2ita</code>, <code>/check 2itb</code>, <code>/check 2itc</code> (II Year Sections)\n• <code>/check 3it</code>, <code>/check 2it</code>, <code>/check dept</code> (Year & Department Breakdown)\n${getWatermarkHtml()}`
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
      SELECT g.student_id as id, u.full_name, u.register_number, COALESCE(g.daily_commit_count, 0) as commits_today
      FROM github_daily_commits g
      JOIN users u ON u.id = g.student_id
      WHERE g.student_id = ANY($1) AND g.date = $2
      ORDER BY g.daily_commit_count DESC
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

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📊  <b>${isYearOnly ? 'YEAR' : 'CLASS'} ANALYSIS REPORT</b>  🏛️\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>🏫 <b>Target:</b> <b>${escapeHtml(classNamesHeader)}</b>\n`;
  html += `👥 <b>Students:</b> <code>${totalStudents}</code>  |  📱 <b>Linked Telegram:</b> <code>${linkedTelegram} (${linkedPct}%)</code>\n`;
  html += `📅 <b>Date:</b> <i>${dateStr} (IST)</i></blockquote>\n\n`;

  // Section-Wise Breakdown for Year Queries
  if (isYearOnly && matchedClasses.length > 1) {
    html += `🏢 <b>SECTION-WISE OVERVIEW:</b>\n`;
    matchedClasses.forEach((sec, idx) => {
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

      const isLast = idx === matchedClasses.length - 1;
      const secName = sec.name.replace(/^(?:I|II|III|IV|\d+)\s*(?:Year)?\s*/i, '').trim() || sec.name;
      html += ` ${isLast ? '└' : '├'} 🎓 <b>${escapeHtml(secName)} (${secStudents.length}):</b> LeetCode: <b>${secLcSolved}</b> solved (${secLcMet}/${secLcTargeted} met) | GitHub: <b>${secGhCommits}</b> commits\n`;
    });
    html += `\n`;
  }

  html += `🚀 <b>TODAY'S CODING HIGHLIGHTS:</b>\n`;
  html += ` ├ 🧩 <b>LeetCode:</b> <b>${lcTotalSolved}</b> solved (<b>${lcActiveSolvers}</b> active solvers)\n`;
  if (lcTargetedCount > 0) {
    const lcProgress = makeProgressBar(lcMetCount, lcTargetedCount, 8);
    html += ` ├ 🎯 <b>Target Status:</b> <b>${lcMetCount}/${lcTargetedCount}</b> met target ${lcProgress}\n`;
  }
  if (lcDefaulters.length > 0) {
    html += ` ├ ⚠️ <b>Pending Solvers:</b> <code>${lcDefaulters.length}</code> student(s) pending (Listed in Excel)\n`;
  } else if (lcTargetedCount > 0) {
    html += ` ├ ✨ <i>All targeted students met their LeetCode goal today! 🎉</i>\n`;
  }
  html += ` └ 💻 <b>GitHub:</b> <b>${ghTotalCommits}</b> commits (<b>${ghActiveCommitters}</b> active)\n\n`;

  // ── Prominent Coding Leaderboard Section ──────────────────────────────────
  html += `🏆 <b>TODAY'S CLASS PODIUM:</b>\n\n`;

  // Top GitHub Committers Leaderboard
  const ghTopCommitters = ghRes.rows
    .filter(r => (Number(r.commits_today) || 0) > 0)
    .sort((a, b) => Number(b.commits_today) - Number(a.commits_today));

  html += `💻 <b>GitHub Top Committers:</b>\n`;
  if (ghTopCommitters.length === 0) {
    html += ` └ <i>No commits recorded today yet.</i>\n\n`;
  } else {
    ghTopCommitters.slice(0, 5).forEach((r, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
      const isLast = idx === Math.min(ghTopCommitters.length, 5) - 1;
      html += ` ${isLast ? '└' : '├'} ${medal} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.commits_today}</code> commits 🔥\n`;
    });
    html += `\n`;
  }

  // Top LeetCode Solvers Leaderboard
  const lcTopSolvers = lcRes.rows
    .filter(r => (Number(r.solved_today) || 0) > 0)
    .sort((a, b) => Number(b.solved_today) - Number(a.solved_today));

  html += `🧩 <b>LeetCode Top Solvers:</b>\n`;
  if (lcTopSolvers.length === 0) {
    html += ` └ <i>No problems solved today yet.</i>\n\n`;
  } else {
    lcTopSolvers.slice(0, 5).forEach((r, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
      const isLast = idx === Math.min(lcTopSolvers.length, 5) - 1;
      html += ` ${isLast ? '└' : '├'} ${medal} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.solved_today}</code> solved 💎\n`;
    });
    html += `\n`;
  }

  // Active Tasks for this class
  if (activeTasksRes.rows.length === 0) {
    html += `📋 <b>Active Class Assignments:</b>\n✨ <i>No active assignments pending for this class right now!</i> 🎉\n\n`;
  } else {
    html += `📋 <b>ACTIVE CLASS ASSIGNMENTS:</b>\n\n`;

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

      html += `📌 <b>${idx + 1}. ${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += `   📂 <i>Category:</i> <code>${escapeHtml(t.category)}</code>\n`;
      html += `   ⏰ <i>Due:</i> ${deadlineStr}\n`;
      html += `   ✅ <i>Submissions:</i> <b>${completedCount} / ${totalStudents}</b> ${progressBar}\n`;

      if (pendingCount === 0) {
        html += `   ✨ <i>Status: 100% Complete! All students submitted!</i> 🎉\n\n`;
      } else {
        html += `   ⏳ <i>Status: ${pendingCount} pending submission(s)</i>\n\n`;
      }
    }
  }

  html += `📎 <b>DETAILED INCOMPLETE REPORT:</b>\n`;
  html += `<i>Full lists of pending LeetCode solvers, inactive GitHub students, and task submissions are attached in the Excel sheet below.</i>\n`;

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📢 Group Brief', callback_data: 'cb_summary' },
        { text: '⚠️ Defaulters', callback_data: 'cb_defaulters' }
      ],
      [
        { text: '🌐 Open Web Portal', url: getPortalUrl() }
      ]
    ]
  };

  // Generate and send the Excel report attachment if chatId is provided
  if (chatId) {
    const lcIncompleteRows = lcRes.rows.filter(r => {
      const solved = Number(r.solved_today) || 0;
      const target = Number(r.daily_target) || 0;
      return target > 0 && solved < target;
    }).map(r => {
      const std = students.find(s => s.id === r.id);
      return {
        ...r,
        solved_today: r.solved_today,
        leetcode_target: r.daily_target,
        class_name: std ? std.class_name : classNamesHeader
      };
    });

    const pendingTasksData: any[] = [];
    for (let idx = 0; idx < activeTasksRes.rows.length; idx++) {
      const t = activeTasksRes.rows[idx];
      const deadlineStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';

      const taskSubmissionsRes = await pool.query(`
        SELECT u.full_name, u.register_number, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON c.id = u.class_id
        LEFT JOIN task_submissions ts ON ts.task_id = $1 AND ts.user_id = u.id AND ts.status IN ('SUBMITTED', 'VERIFIED')
        WHERE u.id = ANY($2)
          AND ts.id IS NULL
        ORDER BY u.register_number ASC
      `, [t.id, studentIds]);

      taskSubmissionsRes.rows.forEach(p => {
        let classNameFormatted = p.class_name ? String(p.class_name).toUpperCase() : 'Unassigned';
        const match = classNameFormatted.match(/^([1-4])\s*(it)?\s*([a-d])$/i);
        if (match) {
          classNameFormatted = `${match[1]}-IT-${match[3].toUpperCase()}`;
        }
        pendingTasksData.push({
          studentName: p.full_name,
          registerNumber: p.register_number,
          className: classNameFormatted,
          taskTitle: t.title,
          category: t.category,
          deadline: deadlineStr
        });
      });
    }

    const allStudentsProgress = students.map(s => {
      const ghRecord = ghRes.rows.find(g => g.id === s.id);
      return {
        id: s.id,
        full_name: s.full_name,
        register_number: s.register_number,
        class_name: s.class_name,
        commits_today: ghRecord ? ghRecord.commits_today : 0
      };
    });

    const hasIncompletes = lcIncompleteRows.length > 0 || pendingTasksData.length > 0;
    if (hasIncompletes) {
      try {
        const excelBuffer = await buildIncompleteExcelBuffer(lcIncompleteRows, pendingTasksData, allStudentsProgress);
        sendTelegramDocument(
          chatId,
          excelBuffer,
          `Incomplete_Report_${classNamesHeader.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`,
          `📊 Incomplete Work Report — ${classNamesHeader}`
        ).catch(err => console.error('[Telegram] Error sending shortcut Excel document:', err));
      } catch (excelErr) {
        console.error('[Telegram] Error generating shortcut Excel buffer:', excelErr);
      }
    }
  }

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
  let targetedCount = 0;

  for (const row of res.rows) {
    const lcTarget = Number(row.leetcode_target) || 0;
    const lcSolved = Number(row.solved_today) || 0;

    if (lcTarget > 0) {
      targetedCount++;
    }
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

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  ⚠️  <b>DAILY TARGET DEFAULTER REPORT</b>  🚨\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
  if (scopeText) html += `🔍 <b>Filter:</b> <code>${escapeHtml(scopeText)}</code>\n`;
  html += `👥 <b>Total Defaulters:</b> <b>${defaulters.length}</b> student(s)</blockquote>\n\n`;

  if (targetedCount === 0) {
    html += `🧩 <i>No active coding targets configured for today.</i>\n`;
  } else if (defaulters.length === 0) {
    html += `🎉 <b>Outstanding! All targeted students have completed their daily targets today! 🌟</b>\n`;
  } else {
    html += `📋 <b>PENDING STUDENTS LIST:</b>\n`;
    defaulters.forEach((d, i) => {
      const isLast = i === defaulters.length - 1;
      html += ` ${isLast ? '└' : '├'} ⚠️ <b>${escapeHtml(d.name)}</b> (<code>${escapeHtml(d.regNo)}</code>) [${escapeHtml(d.className)}]\n`;
      html += `     ⏳ Target Status: <code>${escapeHtml(d.lcStatus)}</code>\n`;
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
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
        { text: '🌐 Open Portal', url: getPortalUrl() }
      ]
    ]
  };

  return { html, keyboard };
}

/**
 * Helper to calculate live countdown strings
 */
export function formatCountdown(deadlineDate: Date): string {
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  if (diffMs <= 0) return '⚠️ Overdue / Closed';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  if (diffDays > 0) {
    return `⏰ ${diffDays}d ${remHours}h left`;
  }
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 0) {
    return `⏰ ${diffHours}h ${diffMins}m left`;
  }
  return `🔥 ${diffMins}m left!`;
}

/**
 * 📋 Comprehensive Tasks Card for a Student (Pending, Submitted, Verified, Rejected)
 */
export async function getTasksCard(user: any): Promise<{ html: string; keyboard: any }> {
  const tasksRes = await pool.query(`
    SELECT 
      t.id, 
      t.title, 
      t.category, 
      t.deadline, 
      t.created_at,
      u.full_name as creator_name,
      ts.id as submission_id,
      ts.status as submission_status,
      ts.submitted_at,
      ts.rejection_reason
    FROM tasks t
    JOIN task_classes tc ON tc.task_id = t.id
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
    WHERE tc.class_id = $2
      AND t.status = 'OPEN'
    ORDER BY 
      CASE 
        WHEN ts.status = 'REJECTED' THEN 1
        WHEN ts.id IS NULL THEN 2
        WHEN ts.status = 'SUBMITTED' THEN 3
        WHEN ts.status = 'VERIFIED' THEN 4
        ELSE 5
      END ASC,
      t.created_at ASC,
      t.deadline ASC NULLS LAST
  `, [user.id, user.class_id]);

  const tasks = tasksRes.rows;
  const pendingList = tasks.filter(t => !t.submission_status);
  const rejectedList = tasks.filter(t => t.submission_status === 'REJECTED');
  const submittedList = tasks.filter(t => t.submission_status === 'SUBMITTED');
  const verifiedList = tasks.filter(t => t.submission_status === 'VERIFIED');

  const totalAssigned = tasks.length;
  const totalCompleted = verifiedList.length;
  const completionPercent = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 100;
  const progressBar = makeProgressBar(totalCompleted, totalAssigned, 8);

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📋  <b>STUDENT TASK DASHBOARD</b>  🎯\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name)}</b>\n`;
  html += `🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number || user.username)}</code>\n`;
  html += `🏫 <b>Class:</b> <code>${escapeHtml(user.class_name || 'IT Section')}</code></blockquote>\n\n`;

  html += `📊 <b>TASK PROGRESSION:</b>\n`;
  html += ` ├ 📈 <b>Completion:</b> <b>${completionPercent}%</b> ${progressBar}\n`;
  html += ` ├ ✅ <b>Verified:</b> <b>${verifiedList.length}</b> / ${totalAssigned}\n`;
  html += ` ├ ⏳ <b>Pending Submission:</b> <b>${pendingList.length}</b>\n`;
  if (submittedList.length > 0) html += ` ├ 📤 <b>Under Review:</b> <b>${submittedList.length}</b>\n`;
  if (rejectedList.length > 0) html += ` └ ❌ <b>Needs Resubmission:</b> <b>${rejectedList.length}</b>\n`;
  else html += ` └ ✨ <i>Status Updated Live</i>\n`;
  html += `\n`;

  // 1. Show Rejected / Action Required first
  if (rejectedList.length > 0) {
    html += `🚨 <b>ACTION REQUIRED — RESUBMISSIONS (${rejectedList.length}):</b>\n`;
    rejectedList.forEach((t, i) => {
      const dStr = t.deadline ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'No deadline';
      html += ` ├ ❌ <b>${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += ` │   📂 <code>${escapeHtml(t.category)}</code>\n`;
      html += ` │   ⏰ <i>Due:</i> ${dStr}\n`;
      if (t.rejection_reason) html += ` │   💬 <i>Remarks:</i> <code>${escapeHtml(t.rejection_reason)}</code>\n`;
      html += ` │\n`;
    });
  }

  // 2. Show Pending Tasks
  if (pendingList.length > 0) {
    html += `⏳ <b>PENDING ASSIGNMENTS (${pendingList.length}):</b>\n`;
    pendingList.forEach((t, i) => {
      const dObj = t.deadline ? new Date(t.deadline) : null;
      const dStr = dObj ? dObj.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'No deadline';
      const countdown = dObj ? formatCountdown(dObj) : '';
      const isLast = i === pendingList.length - 1 && submittedList.length === 0 && verifiedList.length === 0;

      html += ` ${isLast ? '└' : '├'} 📌 <b>${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += `     📂 <code>${escapeHtml(t.category)}</code>\n`;
      html += `     ⏰ <i>Due:</i> ${dStr} ${countdown ? `(<b>${countdown}</b>)` : ''}\n`;
      if (t.creator_name) html += `     👤 <i>Assigned by:</i> ${escapeHtml(t.creator_name)}\n`;
    });
    html += `\n`;
  }

  // 3. Show Submitted Under Review
  if (submittedList.length > 0) {
    html += `📤 <b>UNDER REVIEW (${submittedList.length}):</b>\n`;
    submittedList.forEach((t, i) => {
      const subStr = t.submitted_at ? new Date(t.submitted_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'Recently';
      const isLast = i === submittedList.length - 1 && verifiedList.length === 0;
      html += ` ${isLast ? '└' : '├'} 📤 <b>${escapeHtml(t.title)}</b> ➔ <i>Submitted on ${subStr}</i>\n`;
    });
    html += `\n`;
  }

  // 4. Show Verified
  if (verifiedList.length > 0) {
    html += `✅ <b>VERIFIED SUBMISSIONS (${verifiedList.length}):</b>\n`;
    verifiedList.forEach((t, i) => {
      const isLast = i === verifiedList.length - 1;
      html += ` ${isLast ? '└' : '├'} 🟢 <b>${escapeHtml(t.title)}</b> [ VERIFIED ]\n`;
    });
    html += `\n`;
  }

  if (totalAssigned === 0) {
    html += `✨ <i>No assignments posted for your class currently! 🎉</i>\n\n`;
  }

  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Tasks', callback_data: 'cb_tasks' },
        { text: '⏰ 24h Deadlines', callback_data: 'cb_deadlines' }
      ],
      [
        { text: '📊 My Scorecard', callback_data: 'cb_stats' },
        { text: '👤 My Profile', callback_data: 'cb_profile' }
      ],
      [
        { text: '📱 Main Menu', callback_data: 'cb_menu' },
        { text: '🌐 Submit on Portal', url: getPortalUrl() }
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

  let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📢  <b>NEW ASSIGNMENT POSTED!</b>  🚀\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  html += `<blockquote>📌 <b>Assignment:</b> <b>${escapeHtml(task.title)}</b>\n`;
  if (task.category) html += `📂 <b>Category:</b> <code>${escapeHtml(task.category)}</code>\n`;
  if (task.creator_name) html += `👤 <b>Assigned By:</b> ${escapeHtml(task.creator_name)}\n`;
  html += `⏰ <b>Deadline:</b> <i>${deadlineStr}</i></blockquote>\n\n`;
  html += `👉 <i>Log in to the portal now to review the requirements and submit your proof!</i>\n`;
  html += getWatermarkHtml();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 View My Tasks', callback_data: 'cb_tasks' },
        { text: '🌐 Submit on Portal', url: portalUrl }
      ]
    ]
  };

  // 1. Dispatch exactly ONCE to Telegram Group Chat if configured
  const groupChatId = await getGroupChatId();
  const normalizedGroupChatId = groupChatId ? String(groupChatId).trim() : '';
  if (normalizedGroupChatId) {
    sendTelegramMessage(normalizedGroupChatId, html, { reply_markup: keyboard }).catch(() => { });
  }

  // 2. Dispatch in parallel to all students in the assigned classes with linked PERSONAL Telegram
  if (classIds && classIds.length > 0) {
    const studentsRes = await pool.query(`
      SELECT telegram_chat_id
      FROM users
      WHERE class_id = ANY($1::uuid[]) AND telegram_chat_id IS NOT NULL AND role = 'STUDENT'
    `, [classIds]);

    const rawChatIds = studentsRes.rows
      .map(r => r.telegram_chat_id ? String(r.telegram_chat_id).trim() : '')
      .filter(Boolean);

    // Only send private DM to distinct personal chats (exclude groups with negative IDs and groupChatId)
    const personalChatIds = Array.from(new Set(rawChatIds)).filter(cid => {
      if (cid.startsWith('-')) return false;
      if (normalizedGroupChatId && cid === normalizedGroupChatId) return false;
      return true;
    });

    if (personalChatIds.length > 0) {
      console.log(`[Telegram Notifications] Sending new task alert to ${personalChatIds.length} personal student chat(s)...`);

      // Send in chunks with Promise.allSettled to avoid blocking
      const BATCH_SIZE = 15;
      for (let i = 0; i < personalChatIds.length; i += BATCH_SIZE) {
        const batch = personalChatIds.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(cid => sendTelegramMessage(cid, html, { reply_markup: keyboard })));
        await new Promise(r => setTimeout(r, 40));
      }
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

    let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📥  <b>SUBMISSION RECEIVED — PENDING REVIEW</b>  ⏳\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(user.full_name)}</b>\n`;
    html += `📌 <b>Assignment:</b> <b>"${escapeHtml(task.title)}"</b>\n`;
    html += `🏷️ <b>Current Status:</b> <code>PENDING REVIEW</code> ⏳</blockquote>\n\n`;
    html += `<i>Your Class Advisor / Coordinator will verify your submission proof soon. You will receive an instant notification here once reviewed.</i>\n`;
    html += getWatermarkHtml();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 View All Tasks', callback_data: 'cb_tasks' },
          { text: '🌐 Open Portal', url: getPortalUrl() }
        ]
      ]
    };

    sendTelegramMessage(user.telegram_chat_id, html, { reply_markup: keyboard }).catch(() => { });
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
             u.full_name, u.register_number, u.email, u.telegram_chat_id,
             t.title as task_title
      FROM task_submissions ts
      JOIN users u ON ts.user_id = u.id
      JOIN tasks t ON ts.task_id = t.id
      WHERE ts.id = $1 LIMIT 1
    `, [submissionId]);

    const sub = subRes.rows[0];
    if (!sub) return;

    // 1. Dispatch Automated Email Notification (Brevo / Resend)
    if (sub.email) {
      sendTaskStatusEmail({
        to: sub.email,
        studentName: sub.full_name,
        registerNumber: sub.register_number,
        taskTitle: sub.task_title,
        status,
        noteOrReason,
        portalUrl: getPortalUrl()
      }).catch(err => console.error('[Email Notification Error]:', err));
    }

    // 2. Dispatch Telegram Bot Direct Alert
    if (sub.telegram_chat_id) {
      let html = '';
      let keyboard: any;

      if (status === 'VERIFIED') {
        html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  🎉  <b>SUBMISSION APPROVED & VERIFIED!</b>  ✅\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
        html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(sub.full_name)}</b>\n`;
        html += `📌 <b>Assignment:</b> <b>"${escapeHtml(sub.task_title)}"</b>\n`;
        html += `🏷️ <b>Status:</b> 🟢 <code>VERIFIED & APPROVED</code></blockquote>\n\n`;
        if (noteOrReason) {
          html += `📝 <b>Reviewer Note:</b> <i>${escapeHtml(noteOrReason)}</i>\n\n`;
        }
        html += `🌟 <i>Keep up the excellent momentum! 🚀</i>\n`;
        html += getWatermarkHtml();

        keyboard = {
          inline_keyboard: [
            [
              { text: '📊 View Scorecard', callback_data: 'cb_stats' },
              { text: '📋 My Tasks', callback_data: 'cb_tasks' }
            ],
            [
              { text: '🌐 Open Portal', url: getPortalUrl() }
            ]
          ]
        };
      } else {
        html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  ⚠️  <b>SUBMISSION REQUIRES CORRECTION</b>  🚨\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
        html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(sub.full_name)}</b>\n`;
        html += `📌 <b>Assignment:</b> <b>"${escapeHtml(sub.task_title)}"</b>\n`;
        html += `🏷️ <b>Status:</b> 🔴 <code>REJECTED / ACTION REQUIRED</code></blockquote>\n\n`;
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

      sendTelegramMessage(sub.telegram_chat_id, html, { reply_markup: keyboard }).catch(() => { });
    }
  } catch (err) {
    console.error('[Notification Dispatch] notifySubmissionVerifiedOrRejected error:', err);
  }
}

/**
 * 📦 Batch notify multiple verified submissions
 */
export async function notifySubmissionBatchVerified(submissionIds: string[]): Promise<void> {
  if (!submissionIds || submissionIds.length === 0) return;
  for (const sid of submissionIds) {
    notifySubmissionVerifiedOrRejected(sid, 'VERIFIED').catch(() => { });
  }
}

/**
 * 📢 Enhanced Daily Group Summary (Tasks + LeetCode + GitHub)
 */
export async function sendGroupSummary(targetChatId?: string, dateOverride?: string): Promise<{ success: boolean; message: string; data?: any }> {
  const destChatId = targetChatId || await getGroupChatId() || getAdminChatId();
  if (!destChatId) {
    return { success: false, message: 'No destination Telegram Chat ID configured for Group Summary.' };
  }

  try {
    const dateStr = dateOverride || getISTDateStr();
    const pendingTasksData: any[] = [];

    // Query 1: Active assignments
    // Query 2: All students with today's coding stats and targets
    const [tasksRes, studentProgressRes] = await Promise.all([
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
      pool.query(`
        SELECT u.id, u.full_name, u.register_number, u.gender, u.telegram_chat_id, c.name as class_name,
               COALESCE(lp.solved_today, 0) as solved_today,
               COALESCE(gh.daily_commit_count, 0) as commits_today,
               COALESCE(lt.daily_target, 0) as leetcode_target
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        LEFT JOIN leetcode_daily_progress lp ON lp.user_id = u.id AND lp.date = $1
        LEFT JOIN github_daily_commits gh ON gh.student_id = u.id AND gh.date = $1
        LEFT JOIN LATERAL (
          SELECT daily_target FROM leetcode_targets
          WHERE start_date <= $1 AND end_date >= $1 AND (user_id = u.id OR class_id = u.class_id OR class_id IS NULL)
          ORDER BY CASE WHEN user_id IS NOT NULL THEN 1 WHEN class_id IS NOT NULL THEN 2 ELSE 3 END ASC
          LIMIT 1
        ) lt ON true
        WHERE u.role = 'STUDENT'
        ORDER BY c.name ASC, u.register_number ASC
      `, [dateStr])
    ]);

    const totalStudents = studentProgressRes.rows.length;
    const linkedTelegram = studentProgressRes.rows.filter(r => r.telegram_chat_id).length;

    // ── Aggregation: Year-wise and Class-wise ──────────────────────────────
    const yearMap = { '1': 'I Year', '2': 'II Year', '3': 'III Year', '4': 'IV Year' };
    const yearStats = {
      '1': { solves: 0, activeSolvers: 0, commits: 0, activeCommitters: 0, total: 0 },
      '2': { solves: 0, activeSolvers: 0, commits: 0, activeCommitters: 0, total: 0 },
      '3': { solves: 0, activeSolvers: 0, commits: 0, activeCommitters: 0, total: 0 },
      '4': { solves: 0, activeSolvers: 0, commits: 0, activeCommitters: 0, total: 0 }
    };

    const classStats = {};

    studentProgressRes.rows.forEach(r => {
      const classNameClean = r.class_name ? r.class_name.trim() : '';
      if (!classNameClean) return;

      const yearChar = classNameClean.charAt(0);
      if (yearStats[yearChar]) {
        yearStats[yearChar].total++;
        yearStats[yearChar].solves += Number(r.solved_today) || 0;
        if (Number(r.solved_today) > 0) yearStats[yearChar].activeSolvers++;
        yearStats[yearChar].commits += Number(r.commits_today) || 0;
        if (Number(r.commits_today) > 0) yearStats[yearChar].activeCommitters++;
      }

      if (!classStats[classNameClean]) {
        let formattedName = classNameClean.toUpperCase();
        const match = classNameClean.match(/^([1-4])\s*(it)?\s*([a-d])$/i);
        if (match) {
          formattedName = `${match[1]}-IT-${match[3].toUpperCase()}`;
        }
        classStats[classNameClean] = {
          name: formattedName,
          solves: 0,
          boysSolves: 0,
          girlsSolves: 0,
          activeSolvers: 0,
          boysActiveSolvers: 0,
          girlsActiveSolvers: 0,
          commits: 0,
          boysCommits: 0,
          girlsCommits: 0,
          activeCommitters: 0,
          boysActiveCommitters: 0,
          girlsActiveCommitters: 0,
          metTarget: 0,
          boysMet: 0,
          girlsMet: 0,
          targetedCount: 0,
          boysTargeted: 0,
          girlsTargeted: 0,
          totalStudents: 0,
          boysCount: 0,
          girlsCount: 0
        };
      }

      const cStat = classStats[classNameClean];
      const solves = Number(r.solved_today) || 0;
      const commits = Number(r.commits_today) || 0;
      cStat.solves += solves;
      cStat.commits += commits;

      const genderUpper = r.gender ? String(r.gender).toUpperCase() : '';
      const isBoy = ['MALE', 'BOYS', 'BOY', 'M'].includes(genderUpper);
      const isGirl = ['FEMALE', 'GIRLS', 'GIRL', 'F'].includes(genderUpper);

      cStat.totalStudents++;
      if (isBoy) cStat.boysCount++;
      else if (isGirl) cStat.girlsCount++;

      if (solves > 0) {
        cStat.activeSolvers++;
        if (isBoy) cStat.boysActiveSolvers++;
        else if (isGirl) cStat.girlsActiveSolvers++;
      }

      if (commits > 0) {
        cStat.activeCommitters++;
        if (isBoy) cStat.boysActiveCommitters++;
        else if (isGirl) cStat.girlsActiveCommitters++;
      }

      if (isBoy) {
        cStat.boysSolves += solves;
        cStat.boysCommits += commits;
      } else if (isGirl) {
        cStat.girlsSolves += solves;
        cStat.girlsCommits += commits;
      }

      const target = Number(r.leetcode_target) || 0;
      const solved = Number(r.solved_today) || 0;
      if (target > 0) {
        cStat.targetedCount++;
        if (isBoy) cStat.boysTargeted++;
        else if (isGirl) cStat.girlsTargeted++;

        if (solved >= target) {
          cStat.metTarget++;
          if (isBoy) cStat.boysMet++;
          else if (isGirl) cStat.girlsMet++;
        }
      }
    });

    // ── Generate coding leaderboards ───────────────────────────────────────
    const topGhCommitters = [...studentProgressRes.rows]
      .filter(r => (Number(r.commits_today) || 0) > 0)
      .sort((a, b) => Number(b.commits_today) - Number(a.commits_today))
      .slice(0, 3);

    const topLcSolvers = [...studentProgressRes.rows]
      .filter(r => (Number(r.solved_today) || 0) > 0)
      .sort((a, b) => Number(b.solved_today) - Number(a.solved_today))
      .slice(0, 3);

    // ── Group incomplete LeetCode solvers class-wise ───────────────────────
    const incompleteByClass = {};
    const lcIncompleteRows = studentProgressRes.rows.filter(r => {
      const target = Number(r.leetcode_target) || 0;
      const solved = Number(r.solved_today) || 0;
      return target > 0 && solved < target;
    });

    lcIncompleteRows.forEach(r => {
      const classNameClean = r.class_name ? r.class_name.trim() : 'Unassigned';
      if (!incompleteByClass[classNameClean]) {
        incompleteByClass[classNameClean] = [];
      }
      incompleteByClass[classNameClean].push(r);
    });

    // Process task pending submissions silently to compile data for the Excel sheet
    for (let idx = 0; idx < tasksRes.rows.length; idx++) {
      const t = tasksRes.rows[idx];
      const deadlineStr = t.deadline
        ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
        : 'No deadline';

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

      pendingStudentsRes.rows.forEach(p => {
        let classNameFormatted = p.class_name ? String(p.class_name).toUpperCase() : 'Unassigned';
        const match = classNameFormatted.match(/^([1-4])\s*(it)?\s*([a-d])$/i);
        if (match) {
          classNameFormatted = `${match[1]}-IT-${match[3].toUpperCase()}`;
        }
        pendingTasksData.push({
          studentName: p.full_name,
          registerNumber: p.register_number,
          className: classNameFormatted,
          taskTitle: t.title,
          category: t.category,
          deadline: deadlineStr
        });
      });
    }

    // ── Build HTML Report ──────────────────────────────────────────────────
    let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📊  <b>DEPARTMENT DAILY BRIEF</b>  🏛️\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    html += `<blockquote>📅 <b>Date:</b> <i>${dateStr} (IST)</i>\n`;
    html += `👥 <b>Students:</b> <code>${totalStudents}</code>  |  📱 <b>Linked Telegram:</b> <code>${linkedTelegram}</code></blockquote>\n\n`;

    html += `🏆 <b>TODAY'S TOP PERFORMERS:</b>\n\n`;
    html += `💻 <b>GitHub Top Committers:</b>\n`;
    if (topGhCommitters.length === 0) {
      html += ` └ <i>No commits recorded today.</i>\n\n`;
    } else {
      topGhCommitters.forEach((r, idx) => {
        const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const isLast = idx === topGhCommitters.length - 1;
        html += ` ${isLast ? '└' : '├'} ${rankEmoji} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.commits_today}</code> commits 🔥\n`;
      });
      html += `\n`;
    }

    html += `🧩 <b>LeetCode Top Solvers:</b>\n`;
    if (topLcSolvers.length === 0) {
      html += ` └ <i>No problems solved today.</i>\n\n`;
    } else {
      topLcSolvers.forEach((r, idx) => {
        const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const isLast = idx === topLcSolvers.length - 1;
        html += ` ${isLast ? '└' : '├'} ${rankEmoji} <b>${escapeHtml(r.full_name)}</b> ➔ <code>${r.solved_today}</code> solved 💎\n`;
      });
      html += `\n`;
    }

    // Add Year-wise Coding Summary
    let yearHtml = `🏢 <b>YEAR-WISE CODING SUMMARY:</b>\n`;
    let yearAdded = false;
    Object.keys(yearStats).sort().forEach(y => {
      const label = yearMap[y];
      const s = yearStats[y];
      if (s.total > 0) {
        yearHtml += `🎓 <b>${label}:</b>\n`;
        yearHtml += ` ├ 🧩 LeetCode: <b>${s.solves}</b> solved (<b>${s.activeSolvers}</b> active)\n`;
        yearHtml += ` └ 💻 GitHub: <b>${s.commits}</b> commits (<b>${s.activeCommitters}</b> active)\n\n`;
        yearAdded = true;
      }
    });
    if (yearAdded) {
      html += yearHtml;
    }

    // Add Class-wise Coding Summary
    html += `🏫 <b>CLASS & SECTION SUMMARY:</b>\n`;
    const sortedClassKeys = Object.keys(classStats).sort();
    if (sortedClassKeys.length > 0) {
      sortedClassKeys.forEach(k => {
        const c = classStats[k];
        html += `• <b>${c.name}:</b> Total: <b>${c.totalStudents}</b>\n`;
        html += `   ├ 🧩 LeetCode: <b>${c.activeSolvers}</b> solvers (${c.solves} solves)\n`;
        html += `   └ 💻 GitHub: <b>${c.activeCommitters}</b> committers (${c.commits} commits)\n\n`;
      });
    } else {
      html += ` └ <i>No class summaries available.</i>\n\n`;
    }

    html += `📎 <b>DETAILED INCOMPLETE REPORT:</b>\n`;
    html += `<i>Full lists of pending LeetCode solvers, inactive GitHub students, and task submissions are attached in the Excel sheet below.</i>\n`;

    html += getWatermarkHtml();

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⚠️ Defaulters', callback_data: 'cb_defaulters' },
          { text: '🏆 Leaderboard', callback_data: 'cb_leaderboard' }
        ],
        [
          { text: '🌐 Open Admin Portal', url: getPortalUrl() }
        ]
      ]
    };

    const res = await sendTelegramMessage(destChatId, html, { reply_markup: inlineKeyboard });
    if (res.ok) {
      // Generate and send the Excel report attachment if there are incomplete students
      const hasIncompletes = lcIncompleteRows.length > 0 || pendingTasksData.length > 0;
      if (hasIncompletes) {
        try {
          const excelBuffer = await buildIncompleteExcelBuffer(lcIncompleteRows, pendingTasksData, studentProgressRes.rows);
          await sendTelegramDocument(
            destChatId,
            excelBuffer,
            `Incomplete_Report_${dateStr}.xlsx`,
            `📊 LeetCode, GitHub & Tasks Pending Report — ${dateStr}`
          );
        } catch (excelErr) {
          console.error('[Telegram Summary] Error generating/sending Excel report:', excelErr);
        }
      }
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
 * ⏰ Notify Group Chat about tasks with deadlines within the next 24 hours
 */
export async function sendGroupDeadlineAlert(targetChatId?: string): Promise<{ success: boolean; count: number; message: string }> {
  const destChatId = targetChatId || await getGroupChatId() || getAdminChatId();
  if (!destChatId) {
    return { success: false, count: 0, message: 'No destination Telegram Chat ID configured.' };
  }

  try {
    const tasksRes = await pool.query(`
      SELECT 
        t.id, 
        t.title, 
        t.category, 
        t.deadline, 
        u.full_name as creator_name,
        string_agg(DISTINCT c.name, ', ') as class_names,
        COUNT(DISTINCT tc.class_id) as class_count,
        (
          SELECT COUNT(DISTINCT ts.id) 
          FROM task_submissions ts 
          WHERE ts.task_id = t.id AND ts.status IN ('SUBMITTED', 'VERIFIED')
        ) as submitted_count,
        (
          SELECT COUNT(DISTINCT usr.id)
          FROM users usr
          JOIN task_classes tcl ON tcl.class_id = usr.class_id
          WHERE tcl.task_id = t.id AND usr.role = 'STUDENT'
        ) as total_targeted
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      JOIN task_classes tc ON tc.task_id = t.id
      JOIN classes c ON tc.class_id = c.id
      WHERE t.status = 'OPEN'
        AND t.deadline IS NOT NULL
        AND t.deadline > CURRENT_TIMESTAMP
        AND t.deadline <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
      GROUP BY t.id, t.title, t.category, t.deadline, u.full_name
      ORDER BY t.deadline ASC
    `);

    if (tasksRes.rows.length === 0) {
      return { success: true, count: 0, message: 'No tasks due within the next 24 hours.' };
    }

    const tasks = tasksRes.rows;
    let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  ⏰  <b>UPCOMING TASK DEADLINE ALERT!</b>  ⏳\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    html += `<blockquote>⚠️ <i>The following assignment(s) are closing within the next <b>24 hours</b>. Please complete and submit before the deadline!</i></blockquote>\n\n`;

    tasks.forEach((t, i) => {
      const deadlineStr = new Date(t.deadline).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
      const pending = Math.max(0, Number(t.total_targeted) - Number(t.submitted_count));

      html += `📌 <b>${i + 1}. ${escapeHtml(t.title)}</b>\n`;
      if (t.category) html += `   📂 <code>${escapeHtml(t.category)}</code>\n`;
      html += `   🏫 <b>Classes:</b> <code>${escapeHtml(t.class_names || 'All Classes')}</code>\n`;
      html += `   ⏰ <b>Deadline:</b> <i>${deadlineStr}</i>\n`;
      html += `   📊 <b>Submissions:</b> <b>${t.submitted_count} / ${t.total_targeted}</b> (${pending} pending)\n\n`;
    });

    html += `👉 <i>Log in to the portal now to review the requirements and upload your proof!</i>\n`;
    html += getWatermarkHtml();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📋 View Tasks', callback_data: 'cb_tasks' },
          { text: '🌐 Submit on Portal', url: getPortalUrl() }
        ]
      ]
    };

    const res = await sendTelegramMessage(destChatId, html, { reply_markup: keyboard });
    return {
      success: res.ok,
      count: tasks.length,
      message: res.ok ? `Deadline alerts posted to group for ${tasks.length} task(s).` : (res.description || 'Failed to send')
    };
  } catch (err: any) {
    console.error('[Telegram] sendGroupDeadlineAlert error:', err);
    return { success: false, count: 0, message: err.message };
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
      const chatIdStr = info.telegramChatId ? String(info.telegramChatId).trim() : '';
      if (!chatIdStr || chatIdStr.startsWith('-')) {
        unlinkedCount++;
        continue;
      }

      let html = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  🔔  <b>PENDING TASK REMINDER</b>  ⏰\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
      html += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(info.fullName)}</b>\n`;
      html += `🆔 <b>Reg No:</b> <code>${escapeHtml(info.registerNumber)}</code>\n`;
      html += `⏳ <b>Pending Assignments:</b> <b>${info.tasks.length}</b> awaiting submission</blockquote>\n\n`;

      info.tasks.slice(0, 5).forEach((t, i) => {
        const dStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
          : 'No deadline';
        const isLast = i === Math.min(info.tasks.length, 5) - 1;
        html += ` ${isLast ? '└' : '├'} 📌 <b>${escapeHtml(t.title)}</b>\n`;
        if (t.category) html += `     📂 <code>${escapeHtml(t.category)}</code>\n`;
        html += `     ⏰ <i>Due:</i> ${dStr}\n`;
      });
      html += `\n`;

      if (info.tasks.length > 5) {
        html += `<i>...and ${info.tasks.length - 5} more pending task(s).</i>\n\n`;
      }

      html += `👉 <i>Please complete and upload your submission proof before the deadline!</i>\n`;
      html += getWatermarkHtml();

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '📋 My Tasks', callback_data: 'cb_tasks' },
            { text: '🌐 Submit on Portal', url: portalUrl }
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
    let rawClean = identifier.trim().replace(/^[\/#]?(?:link|start|user)[_\s-]+/i, '').trim();
    if (!rawClean) rawClean = identifier.trim();
    const cleanNoSpaces = rawClean.replace(/\s+/g, '').toLowerCase();

    const strChatId = String(personalChatId).trim();
    if (strChatId.startsWith('-')) {
      return {
        success: false,
        message: 'Cannot link a Telegram group or channel chat ID as a student account. Please message the bot in a private DM.'
      };
    }

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

            if (!cbChatId || !cbUserId) return;

            const cbIsGroup = cb.message?.chat?.type === 'group' || cb.message?.chat?.type === 'supergroup';
            const personalCallbackKeys = ['cb_tasks', 'view_tasks', 'cb_leetcode', 'cb_github', 'cb_stats', 'cb_profile'];

            if (cbIsGroup && personalCallbackKeys.includes(cbData)) {
              if (cb.id) {
                await answerCallbackQuery(cb.id, '⚠️ Personal actions are disabled in group chats. Message the bot privately!', true);
              }
              return;
            }

            // Fire answerCallbackQuery immediately to dismiss loading spinner
            if (cb.id) {
              answerCallbackQuery(cb.id).catch(() => { });
            }

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
            } else if (cbData === 'cb_profile') {
              const card = await getProfileCard(user);
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_leaderboard') {
              const card = await getLeaderboardCard();
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_defaulters') {
              const card = await getDefaultersCard();
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_summary') {
              await sendGroupSummary(String(cbChatId));
            } else if (cbData === 'cb_deadlines') {
              await sendGroupDeadlineAlert(String(cbChatId));
            } else if (cbData === 'cb_task_status') {
              const card = await getFacultyTaskStatusCard();
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
            } else if (cbData === 'cb_search_help') {
              await sendTelegramMessage(
                cbChatId,
                `🔎 <b>STUDENT SEARCH GUIDE</b>\n\nTo check any student's scorecard instantly, simply reply with their 12-digit Register Number or Username:\n<code>/check 922524205171</code>\n\n<i>You can also directly send the register number into the chat without any command prefix!</i>\n${getWatermarkHtml()}`,
                { reply_markup: getInteractiveMenuKeyboard(user?.role) }
              );
            } else if (cbData === 'cb_group_link') {
              const card = await getGroupRecommendationCard();
              await sendTelegramMessage(cbChatId, card.html, { reply_markup: card.keyboard });
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
            }).catch(() => { });
          }

          // Command: /id
          if (text.startsWith('/id')) {
            await sendTelegramMessage(
              chatId,
              `ℹ️ <b>Chat Details:</b>\n• Chat ID: <code>${chatId}</code>\n• Chat Type: <code>${msg.chat?.type}</code>\n• Your User ID: <code>${senderUserId}</code>\n${getWatermarkHtml()}`
            );
            return;
          }

          // Command: /group, /join, /community
          if (text.startsWith('/group') || text.startsWith('/join') || text.startsWith('/community')) {
            const card = await getGroupRecommendationCard();
            await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
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
                /^(?:link)?\s*(?:year|y)?\s*([1-4])\s*(?:it|year|yr)?$/i.test(cleanParam) ||
                /^(?:link)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i.test(cleanParam) ||
                /^(?:link)?\s*(?:it)?\s*([1-4])\s*([a-d])$/i.test(cleanParam) ||
                /^(?:class)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i.test(cleanParam) ||
                /^(?:iii|ii|iv|i)\s*(?:it)?\s*([a-d])?$/i.test(cleanParam) ||
                cleanParam.startsWith('year') ||
                cleanParam.startsWith('class');

              if (isClassOrYear) {
                const card = await getClassOrYearAnalysisCard(param, chatId);
                await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
                return;
              }

              // Otherwise link student account with register number / username
              if (isGroup) {
                await sendPrivateActionWarning(chatId);
                return;
              }

              const linkResult = await linkStudentTelegram(param, senderUserId, fromUsername);
              if (linkResult.success) {
                const groupInviteUrl = await getGroupInviteLink();
                let welcomeHtml = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  🎉  <b>ACCOUNT LINKED SUCCESSFULLY!</b>  ✅\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
                welcomeHtml += `<blockquote>👤 <b>Student:</b> <b>${escapeHtml(linkResult.studentName)}</b>\n`;
                welcomeHtml += `✨ <i>Your Telegram is now securely connected to IT TaskManager! You will receive private deadline alerts and evaluation notices here.</i></blockquote>\n\n`;
                welcomeHtml += `👥 <b>RECOMMENDED NEXT STEP:</b>\n`;
                welcomeHtml += `Join our <b>Official Department Telegram Group</b> to receive daily coding leaderboards, class briefs, and announcements!\n`;
                welcomeHtml += getWatermarkHtml();

                const keyboard: any = {
                  inline_keyboard: []
                };

                if (groupInviteUrl) {
                  keyboard.inline_keyboard.push([
                    { text: '👥 Join Official Telegram Group', url: groupInviteUrl }
                  ]);
                } else {
                  keyboard.inline_keyboard.push([
                    { text: '👥 Join Official Telegram Group', callback_data: 'cb_group_link' }
                  ]);
                }

                keyboard.inline_keyboard.push([
                  { text: '📋 My Tasks', callback_data: 'cb_tasks' },
                  { text: '📊 My Scorecard', callback_data: 'cb_stats' }
                ]);
                keyboard.inline_keyboard.push([
                  { text: '📱 Main Menu', callback_data: 'cb_menu' },
                  { text: '🌐 Open Portal', url: getPortalUrl() }
                ]);

                await sendTelegramMessage(chatId, welcomeHtml, { reply_markup: keyboard });
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
                  `👋 <b>Welcome to IT TASK MANAGER!</b>\n\n📌 <b>Group ID:</b> <code>${chatId}</code>\n\nThis group receives automated daily task reports and department announcements.\n\n💡 <i>Students: To link your account for private alerts, message @${cachedBotUsername} directly or use 1-Click Connect from the portal!</i>\n${getWatermarkHtml()}`
                );
              } else {
                const groupInviteUrl = await getGroupInviteLink();
                let greetingHtml = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  👋  <b>WELCOME TO IT TASK MANAGER</b>  🎓\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
                greetingHtml += `<blockquote>Hello <b>${escapeHtml(senderName)}</b>!\n`;
                greetingHtml += `Stay connected and never miss an assignment deadline or coding goal!</blockquote>\n\n`;
                greetingHtml += `📌 <b>LINK YOUR ACCOUNT:</b>\n`;
                greetingHtml += `Reply with your 12-digit Register Number:\n<code>/link YOUR_REGISTER_NUMBER</code>\n<i>(Or simply send your Register Number directly into the chat!)</i>\n\n`;
                greetingHtml += `👥 <b>OFFICIAL DEPARTMENT COMMUNITY:</b>\n`;
                greetingHtml += `Make sure to join our official Telegram group for daily coding podiums, class briefs, and announcements!\n`;
                greetingHtml += getWatermarkHtml();

                const keyboard: any = {
                  inline_keyboard: []
                };

                if (groupInviteUrl) {
                  keyboard.inline_keyboard.push([
                    { text: '👥 Join Official Telegram Group', url: groupInviteUrl }
                  ]);
                } else {
                  keyboard.inline_keyboard.push([
                    { text: '👥 Join Official Telegram Group', callback_data: 'cb_group_link' }
                  ]);
                }

                keyboard.inline_keyboard.push([
                  { text: '🌐 Open Web Portal', url: getPortalUrl() }
                ]);

                await sendTelegramMessage(chatId, greetingHtml, { reply_markup: keyboard });
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
            let helpHtml = `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\n  📱  <b>IT TASK MANAGER MENU</b>  ⚡\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
            if (user) {
              helpHtml += `<blockquote>👤 <b>Connected:</b> <b>${escapeHtml(user.full_name)}</b>\n🆔 <b>Reg No:</b> <code>${escapeHtml(user.register_number)}</code>\n🏫 <b>Class:</b> <code>${escapeHtml(user.class_name || 'IT Department')}</code></blockquote>\n\n`;
            }
            helpHtml += `<b>Available Commands:</b>\n`;
            helpHtml += `• <code>/check &lt;Reg_No&gt;</code> - Complete student scorecard (Tasks + LC + GH)\n`;
            helpHtml += `• <code>/3ita</code>, <code>/3itb</code>, <code>/2ita</code> - Instant class analysis\n`;
            helpHtml += `• <code>/year3</code>, <code>/year2</code> - Year-wise department analysis\n`;
            helpHtml += `• <code>/tasks</code> - View assigned tasks\n`;
            helpHtml += `• <code>/deadlines</code> - 24-hour upcoming deadlines\n`;
            helpHtml += `• <code>/leetcode</code> - Daily LeetCode progress\n`;
            helpHtml += `• <code>/github</code> - Daily GitHub commits\n`;
            helpHtml += `• <code>/stats</code> - Full performance scorecard\n`;
            helpHtml += `• <code>/leaderboard</code> - Daily coding rankings\n`;
            helpHtml += `• <code>/group</code> - Join official department Telegram group\n`;
            helpHtml += `• <code>/status</code> - Connected profile info\n`;
            helpHtml += `• <code>/unlink</code> - Disconnect account\n`;

            if (user?.role === 'SUPREME_ADMIN' || user?.role === 'STAFF' || user?.role === 'COORDINATOR' || user?.role === 'HOD' || user?.role === 'CLASS_ADVISOR') {
              helpHtml += `\n<b>Staff / Coordinator Commands:</b>\n`;
              helpHtml += `• <code>/defaulters [class]</code> - Target defaulters report\n`;
              helpHtml += `• <code>/broadcast &lt;msg&gt;</code> - Announcement to all students\n`;
              helpHtml += `• <code>/summary</code> - Class daily brief\n`;
            }

            helpHtml += `\n👥 <i>Join our Department Telegram group for live podium alerts!</i>\n`;
            helpHtml += getWatermarkHtml();
            await sendTelegramMessage(chatId, helpHtml, { reply_markup: keyboard });
            return;
          }

          // Command: /check <query>, /lookup <query>, /student <query>, /progress <query>, or /status <query>
          if (
            text.startsWith('/check') ||
            text.startsWith('/lookup') ||
            text.startsWith('/student') ||
            (text.startsWith('/progress') && text.split(/\s+/).length > 1) ||
            (text.startsWith('/status') && text.split(/\s+/).length > 1)
          ) {
            const parts = text.split(/\s+/);
            const query = parts.slice(1).join(' ').trim();
            if (query) {
              const cleanQ = query.toLowerCase().replace(/[@#/_]/g, '').trim();

              // 1. Check if department / group summary requested
              if (cleanQ === 'dept' || cleanQ === 'department' || cleanQ === 'summary' || cleanQ === 'all' || cleanQ === 'group') {
                await sendGroupSummary(String(chatId));
                return;
              }

              // 2. Check if query is class or year (e.g. 3itc, 2ita, 3ita, 2itb, 3it, 2it, year3, year2, 3it a, ii it c)
              const isClassOrYear =
                /^(?:link)?\s*(?:year|y)?\s*([1-4])\s*(?:it|year|yr)?$/i.test(cleanQ) ||
                /^(?:link)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i.test(cleanQ) ||
                /^(?:link)?\s*(?:it)?\s*([1-4])\s*([a-d])$/i.test(cleanQ) ||
                /^(?:class)?\s*([1-4])\s*(?:it)?\s*([a-d])$/i.test(cleanQ) ||
                /^(?:iii|ii|iv|i)\s*(?:it)?\s*([a-d])?$/i.test(cleanQ) ||
                cleanQ.startsWith('year') ||
                cleanQ.startsWith('class');

              if (isClassOrYear) {
                const card = await getClassOrYearAnalysisCard(query, chatId);
                await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
                return;
              }

              // 3. Otherwise treat as student query (reg no or name/username)
              if (isGroup) {
                await sendPrivateActionWarning(chatId);
                return;
              }

              const card = await getComprehensiveStudentProgressCard(query);
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
              return;
            } else {
              await sendTelegramMessage(
                chatId,
                `ℹ️ <b>Usage:</b>\n• Student: <code>/check 922524205171</code>\n• Class: <code>/check 3itc</code> or <code>/check 2ita</code>\n• Year: <code>/check 3it</code> or <code>/check 2it</code>\n• Department: <code>/check dept</code>\n${getWatermarkHtml()}`
              );
              return;
            }
          }

          // ── Class & Year Analysis Reports (Direct Commands & Text) ─────────
          // Supports: /3ita, /3itb, /3itc, /2ita, /2itb, /2itc, /year3, /year2, /class 3ita, etc.
          const cleanNoMention = text.replace(/@\w+/g, '').trim();
          const cleanCandidate = text.replace(/[@#]/g, '').trim();
          const cleanDirectQ = text.toLowerCase().replace(/[@#/_]/g, '').trim();

          const isClassOrYearShortcut =
            text.startsWith('/class') ||
            text.startsWith('/year') ||
            /^\/(?:[1-4]\s*(?:it)?[a-d]|[1-4]\s*year|year\s*[1-4])$/i.test(cleanNoMention) ||
            /^(?:[1-4]\s*it[a-d]|[1-4]\s*year|year\s*[1-4])$/i.test(cleanCandidate) ||
            /^(?:[1-4]\s*(?:it)?[a-d]|[1-4]\s*it|[1-4]\s*year|year\s*[1-4])$/i.test(cleanDirectQ) ||
            /^(?:iii|ii|iv|i)\s*it\s*[a-d]$/i.test(cleanDirectQ) ||
            cleanDirectQ === '3ita' || cleanDirectQ === '3itb' || cleanDirectQ === '3itc' ||
            cleanDirectQ === '2ita' || cleanDirectQ === '2itb' || cleanDirectQ === '2itc' ||
            cleanDirectQ === '1ita' || cleanDirectQ === '1itb' || cleanDirectQ === '1itc' ||
            cleanDirectQ === '4ita' || cleanDirectQ === '4itb' || cleanDirectQ === '4itc';

          if (isClassOrYearShortcut) {
            let classQuery = cleanNoMention;
            if (text.startsWith('/class') || text.startsWith('/year')) {
              const parts = cleanNoMention.split(/\s+/);
              classQuery = parts.slice(1).join(' ').trim() || parts[0];
            }
            const card = await getClassOrYearAnalysisCard(classQuery, chatId);
            if (card.found || text.startsWith('/')) {
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
              return;
            }
          }

          // ── Automatic Register Number / Username Lookup & Auto-Link ─────────
          // If anyone in a private DM simply types a Register Number
          if (!isGroup && !text.startsWith('/') && cleanCandidate.length >= 4 && cleanCandidate.length <= 25) {
            const studentCheck = await pool.query(`
              SELECT id, full_name, register_number, username, telegram_chat_id FROM users 
              WHERE (REPLACE(LOWER(register_number), ' ', '') = $1 
                 OR LOWER(register_number) = $2 
                 OR REPLACE(LOWER(username), ' ', '') = $1
                 OR LOWER(username) = $2)
                AND role = 'STUDENT'
              LIMIT 1
            `, [cleanCandidate.toLowerCase().replace(/\s+/g, ''), cleanCandidate.toLowerCase()]);

            if (studentCheck.rows.length > 0) {
              const matchedStudent = studentCheck.rows[0];
              // If sender doesn't have an account linked yet, auto-link to this student account!
              if (!user && (!matchedStudent.telegram_chat_id || matchedStudent.telegram_chat_id === String(senderUserId))) {
                await linkStudentTelegram(cleanCandidate, senderUserId, fromUsername);
              }
              const card = await getComprehensiveStudentProgressCard(cleanCandidate);
              if (card.found) {
                await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
                return;
              }
            }
          }

          // Command: /leaderboard or /top or /rank
          if (text.startsWith('/leaderboard') || text.startsWith('/top') || text.startsWith('/rank')) {
            try {
              const card = await getLeaderboardCard();
              await sendTelegramMessage(chatId, card.html, { reply_markup: card.keyboard });
            } catch (err: any) {
              console.error('[Telegram] leaderboard command error:', err);
              await sendTelegramMessage(chatId, `⚠️ Failed to fetch leaderboard: ${err.message}\n${getWatermarkHtml()}`);
            }
            return;
          }

          // Command: /leetcode or /lc
          if (text.startsWith('/leetcode') || text.startsWith('/lc')) {
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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
            const rawChatIds = studentsRes.rows.map(s => s.telegram_chat_id ? String(s.telegram_chat_id).trim() : '').filter(Boolean);
            const studentChatIds = Array.from(new Set(rawChatIds)).filter(cid => !cid.startsWith('-'));
            let count = 0;
            const broadcastHtml = `📢 <b>DEPARTMENT ANNOUNCEMENT</b>\n\n${escapeHtml(broadcastText)}\n\n— <i>Sent by ${escapeHtml(user.full_name)} (${user.role})</i>${getWatermarkHtml()}`;

            for (const cid of studentChatIds) {
              await sendTelegramMessage(cid, broadcastHtml);
              count++;
              await new Promise(r => setTimeout(r, 40));
            }

            await sendTelegramMessage(chatId, `✅ <b>Broadcast sent to ${count} student(s) successfully!</b>\n${getWatermarkHtml()}`);
            return;
          }

          // Command: /tasks or /pending or /mytasks
          if (text.startsWith('/tasks') || text.startsWith('/pending') || text.startsWith('/mytasks')) {
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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
            if (isGroup) {
              await sendPrivateActionWarning(chatId);
              return;
            }
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



          // Command: /deadlines or /due
          if (text.startsWith('/deadlines') || text.startsWith('/due')) {
            const res = await sendGroupDeadlineAlert(String(chatId));
            if (!res.success && res.message !== 'No tasks due within the next 24 hours.') {
              await sendTelegramMessage(chatId, `⚠️ ${escapeHtml(res.message)}\n${getWatermarkHtml()}`);
            } else if (res.count === 0) {
              await sendTelegramMessage(chatId, `✅ <b>No assignments closing within the next 24 hours!</b>\n${getWatermarkHtml()}`);
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
  const botUsername = (await fetchBotUsername()) || cachedBotUsername || 'IT_TaskManager_Alerts_bot';

  const res = await pool.query(`
    SELECT 
      COUNT(*) as total_students,
      COUNT(telegram_chat_id) as linked_students
    FROM users
    WHERE role = 'STUDENT'
  `);

  return {
    botConfigured: Boolean(token),
    botUsername,
    adminChatId,
    groupChatId,
    totalStudents: parseInt(res.rows[0]?.total_students || '0', 10),
    linkedStudents: parseInt(res.rows[0]?.linked_students || '0', 10)
  };
}
