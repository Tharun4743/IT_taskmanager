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
 * 📢 Generate & Dispatch Optimized Daily Group Summary
 */
export async function sendGroupSummary(targetChatId?: string): Promise<{ success: boolean; message: string; data?: any }> {
  const destChatId = targetChatId || await getGroupChatId() || getAdminChatId();
  if (!destChatId) {
    return { success: false, message: 'No destination Telegram Chat ID configured for Group Summary.' };
  }

  try {
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
      LIMIT 10
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

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    let html = `📊 <b>IT TASKMANAGER — DAILY SUMMARY</b>\n`;
    html += `📅 <i>${dateStr}</i>\n`;
    html += `👥 <b>Total Students:</b> ${totalStudents} | 📱 <b>Telegram Linked:</b> ${linkedTelegram}\n`;
    html += `─────────────────────────\n\n`;

    if (tasksRes.rows.length === 0) {
      html += `✨ <b>No active pending tasks today! Keep up the great work!</b> 🎉\n`;
    } else {
      html += `📌 <b>Active Tasks Status:</b>\n\n`;
      tasksRes.rows.forEach((t, idx) => {
        const completed = parseInt(t.completed_count || '0', 10);
        const deadlineStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'No deadline';
        
        const progressBar = totalStudents > 0 ? makeProgressBar(completed, totalStudents, 8) : '';

        html += `<b>${idx + 1}. ${escapeHtml(t.title)}</b>\n`;
        if (t.category) html += `   📂 <i>Category:</i> <code>${escapeHtml(t.category)}</code>\n`;
        html += `   ⏰ <i>Due:</i> ${deadlineStr}\n`;
        html += `   ✅ <i>Progress:</i> <b>${completed}</b> submissions ${progressBar}\n\n`;
      });
      html += `─────────────────────────\n`;
    }

    const portalUrl = getPortalUrl();
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🚀 Open IT TaskManager', url: portalUrl },
          { text: '🔔 Connect My Telegram', url: `https://t.me/IT_TaskManager_Alerts_bot` }
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
 * 👤 Optimized 1-to-1 Private Reminders with Rate-Limiting & Inline Action Buttons
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

    // Throttled dispatch queue to avoid Telegram 429 rate limit errors
    for (const [, info] of studentTasksMap.entries()) {
      if (!info.telegramChatId) {
        unlinkedCount++;
        continue;
      }

      let html = `🔔 <b>IT TASKMANAGER — PENDING TASK REMINDER</b>\n\n`;
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

      html += `👉 <i>Please complete and upload your submission proof before the deadline!</i>`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🌐 Submit Proof on Portal', url: portalUrl }
          ]
        ]
      };

      const sendRes = await sendTelegramMessage(info.telegramChatId, html, { reply_markup: inlineKeyboard });
      if (sendRes.ok) {
        notifiedCount++;
      }

      // Small throttle delay (40ms) between student dispatches
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
 * 🤖 Background Poller for Interactive Telegram Commands
 */
let isPolling = false;
let lastUpdateId = 0;

export function startTelegramPoller(): void {
  const token = getBotToken();
  if (!token || isPolling) return;

  isPolling = true;
  console.log('[Telegram Bot] Resilient update poller started for interactive commands...');

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
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
              `ℹ️ <b>Chat Details:</b>\n• Chat ID: <code>${chatId}</code>\n• Chat Type: <code>${msg.chat?.type}</code>\n• Your User ID: <code>${senderUserId}</code>`
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
                const inlineKeyboard = {
                  inline_keyboard: [
                    [
                      { text: '📋 View My Pending Tasks', callback_data: 'view_tasks' },
                      { text: '🌐 Open Portal', url: getPortalUrl() }
                    ]
                  ]
                };
                await sendTelegramMessage(
                  chatId,
                  `🎉 <b>Account Connected Successfully!</b>\n\nHello <b>${escapeHtml(linkResult.studentName)}</b>,\nYour Telegram is now securely connected to <b>IT TaskManager</b>.\n\nYou will receive private alerts for upcoming deadlines and target updates here! 🚀`,
                  { reply_markup: inlineKeyboard }
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `⚠️ <b>Could Not Link Account</b>\n\n${escapeHtml(linkResult.message)}\n\nPlease check your Register Number or connect via the IT TaskManager portal.`
                );
              }
            } else {
              if (isGroup) {
                await sendTelegramMessage(
                  chatId,
                  `👋 <b>Hello Everyone!</b> I am the <b>IT TaskManager Bot</b>.\n\n📌 <b>Group ID:</b> <code>${chatId}</code>\n\nThis group receives daily task reports and department announcements.\n\n💡 <i>Students: To link your account for private alerts, message @IT_TaskManager_Alerts_bot directly!</i>`
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `👋 <b>Hello ${escapeHtml(senderName)}!</b> Welcome to the <b>IT TaskManager Bot</b>.\n\nTo link your student account and receive private task reminders, reply with:\n<code>/link YOUR_REGISTER_NUMBER</code>\n\n<i>Example:</i> <code>/link 7376222IT101</code>`
                );
              }
            }
          }

          // Command: /tasks or /pending (Self-service check of student's active assignments)
          else if (text.startsWith('/tasks') || text.startsWith('/pending') || text.startsWith('/mytasks')) {
            const userRes = await pool.query(`
              SELECT u.id, u.full_name, u.class_id, u.register_number
              FROM users u
              WHERE u.telegram_chat_id = $1
              LIMIT 1
            `, [String(senderUserId)]);

            if (userRes.rows.length === 0) {
              await sendTelegramMessage(
                chatId,
                `ℹ️ Your Telegram is not yet connected to a student profile.\n\nReply with <code>/link YOUR_REGISTER_NUMBER</code> to connect!`
              );
            } else {
              const u = userRes.rows[0];
              const tasksRes = await pool.query(`
                SELECT t.id, t.title, t.category, t.deadline
                FROM tasks t
                JOIN task_classes tc ON tc.task_id = t.id
                LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = $1
                WHERE tc.class_id = $2
                  AND t.status = 'OPEN'
                  AND (ts.id IS NULL OR ts.status = 'REJECTED')
                ORDER BY t.deadline ASC
              `, [u.id, u.class_id]);

              if (tasksRes.rows.length === 0) {
                await sendTelegramMessage(
                  chatId,
                  `🎉 <b>Great job, ${escapeHtml(u.full_name)}!</b>\nYou have no pending tasks right now. All caught up!`
                );
              } else {
                let html = `📋 <b>Your Pending Tasks (${tasksRes.rows.length}):</b>\n\n`;
                tasksRes.rows.forEach((t, i) => {
                  const dStr = t.deadline
                    ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'No deadline';
                  html += `${i + 1}. 📌 <b>${escapeHtml(t.title)}</b>\n   ⏰ Due: ${dStr}\n\n`;
                });
                html += `👉 <i>Submit your proof on the IT TaskManager portal!</i>`;

                await sendTelegramMessage(chatId, html, {
                  reply_markup: {
                    inline_keyboard: [[{ text: '🌐 Submit on Portal', url: getPortalUrl() }]]
                  }
                });
              }
            }
          }

          // Command: /unlink
          else if (text.startsWith('/unlink')) {
            await pool.query(`
              UPDATE users
              SET telegram_chat_id = NULL, telegram_username = NULL, telegram_linked_at = NULL
              WHERE telegram_chat_id = $1
            `, [String(senderUserId)]);
            await sendTelegramMessage(chatId, `✅ Your Telegram has been disconnected from your IT TaskManager student account.`);
          }

          // Command: /status
          else if (text.startsWith('/status')) {
            const userRes = await pool.query(`SELECT full_name, register_number, role FROM users WHERE telegram_chat_id = $1`, [String(senderUserId)]);
            if (userRes.rows.length > 0) {
              await sendTelegramMessage(
                chatId,
                `✅ <b>Connected Account:</b>\n• <b>Name:</b> ${escapeHtml(userRes.rows[0].full_name)}\n• <b>Register No:</b> <code>${escapeHtml(userRes.rows[0].register_number)}</code>\n• <b>Role:</b> ${userRes.rows[0].role}`
              );
            } else {
              await sendTelegramMessage(chatId, `ℹ️ This chat is not yet linked to any student profile. Send <code>/link &lt;Your_Register_Number&gt;</code> to link.`);
            }
          }

          // Command: /summary or /report
          else if (text.startsWith('/summary') || text.startsWith('/report')) {
            const res = await sendGroupSummary(String(chatId));
            if (!res.success) {
              await sendTelegramMessage(chatId, `⚠️ ${escapeHtml(res.message)}`);
            }
          }

          // Friendly Chat Handler for Private DMs
          else if (!isGroup && (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello' || text.toLowerCase() === 'help')) {
            const userRes = await pool.query(`SELECT full_name, register_number FROM users WHERE telegram_chat_id = $1`, [String(senderUserId)]);
            if (userRes.rows.length > 0) {
              await sendTelegramMessage(
                chatId,
                `👋 Hello <b>${escapeHtml(userRes.rows[0].full_name)}</b>!\n\nYour account is linked (<code>${escapeHtml(userRes.rows[0].register_number)}</code>).\n\n<b>Available Commands:</b>\n• <code>/tasks</code> - View your pending assignments\n• <code>/status</code> - View connected profile\n• <code>/summary</code> - View class overview\n• <code>/unlink</code> - Disconnect account`
              );
            } else {
              await sendTelegramMessage(
                chatId,
                `🤖 <b>IT TaskManager Bot</b>\n\nHello! To receive private task deadline alerts, reply with:\n<code>/link YOUR_REGISTER_NUMBER</code>\n\n<i>Example:</i> <code>/link 7376222IT101</code>`
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
