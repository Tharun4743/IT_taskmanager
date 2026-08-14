import { pool } from './db.js';

export function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

export function getAdminChatId(): string {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || '';
}

export async function getGroupChatId(): Promise<string | null> {
  try {
    const res = await pool.query(`SELECT value FROM system_settings WHERE key = 'telegram_group_chat_id' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value.trim()) {
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
 * Low-level message sender using Telegram Bot API
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any } = { parse_mode: 'Markdown' }
): Promise<{ ok: boolean; description?: string; result?: any }> {
  const token = getBotToken();
  if (!token) {
    console.warn('[Telegram] Cannot send message: No bot token configured.');
    return { ok: false, description: 'No bot token configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode || 'Markdown',
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
 * 📢 Generate & Dispatch Daily Group Summary
 * Posts a formatted overview of active tasks, completion rate, and pending counts.
 */
export async function sendGroupSummary(targetChatId?: string): Promise<{ success: boolean; message: string; data?: any }> {
  const destChatId = targetChatId || await getGroupChatId() || getAdminChatId();
  if (!destChatId) {
    return { success: false, message: 'No destination Telegram Chat ID configured for Group Summary.' };
  }

  try {
    // 1. Fetch open/active tasks
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

    // 2. Fetch total students count
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

    let msg = `📊 *IT TASKMANAGER — DAILY SUMMARY*\n`;
    msg += `📅 *Date:* ${dateStr}\n`;
    msg += `👥 *Total Students:* ${totalStudents} | 📱 *Telegram Linked:* ${linkedTelegram}\n`;
    msg += `─────────────────────────\n\n`;

    if (tasksRes.rows.length === 0) {
      msg += `✨ *No active pending tasks for today! Keep up the great work!* 🎉\n`;
    } else {
      msg += `📌 *Active Tasks Overview:*\n\n`;
      tasksRes.rows.forEach((t, idx) => {
        const completed = parseInt(t.completed_count || '0', 10);
        const deadlineStr = t.deadline ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No deadline';
        
        msg += `${idx + 1}. *${t.title}*\n`;
        if (t.category) msg += `   📂 Category: \`${t.category}\`\n`;
        msg += `   ⏰ Deadline: ${deadlineStr}\n`;
        msg += `   ✅ Submissions: *${completed}* received\n\n`;
      });
      msg += `─────────────────────────\n`;
      msg += `💡 _Students can submit their tasks on the IT TaskManager portal._`;
    }

    const res = await sendTelegramMessage(destChatId, msg, { parse_mode: 'Markdown' });
    if (res.ok) {
      return { success: true, message: `Group summary sent successfully to ${destChatId}.` };
    } else {
      return { success: false, message: `Telegram error: ${res.description}` };
    }
  } catch (err: any) {
    console.error('[Telegram] sendGroupSummary error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * 👤 Send 1-to-1 Private Reminders to Students with Pending Tasks
 */
export async function triggerPendingTaskReminders(): Promise<{
  success: boolean;
  notifiedCount: number;
  totalPendingCount: number;
  unlinkedCount: number;
  details: string;
}> {
  try {
    // Find all open tasks with upcoming or pending deadlines
    const query = `
      SELECT DISTINCT 
        u.id as user_id, 
        u.full_name, 
        u.register_number, 
        u.telegram_chat_id,
        t.id as task_id, 
        t.title as task_title, 
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

    // Group pending tasks by student
    const studentTasksMap = new Map<string, {
      fullName: string;
      registerNumber: string;
      telegramChatId: string | null;
      tasks: { title: string; deadline: string | null }[];
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
        deadline: row.deadline
      });
    }

    let notifiedCount = 0;
    let unlinkedCount = 0;

    for (const [userId, info] of studentTasksMap.entries()) {
      if (!info.telegramChatId) {
        unlinkedCount++;
        continue;
      }

      let reminderText = `🔔 *IT TASKMANAGER — PENDING TASK REMINDER*\n\n`;
      reminderText += `Hello *${info.fullName}*,\n`;
      reminderText += `You have *${info.tasks.length}* pending task(s) awaiting submission:\n\n`;

      info.tasks.slice(0, 5).forEach((t, i) => {
        const dStr = t.deadline
          ? new Date(t.deadline).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'No deadline';
        reminderText += `${i + 1}. 📌 *${t.title}*\n   ⏰ Due: ${dStr}\n`;
      });

      if (info.tasks.length > 5) {
        reminderText += `\n_...and ${info.tasks.length - 5} more task(s)._\n`;
      }

      reminderText += `\n👉 Please complete and submit your proof on the IT TaskManager portal!`;

      const sendRes = await sendTelegramMessage(info.telegramChatId, reminderText, { parse_mode: 'Markdown' });
      if (sendRes.ok) {
        notifiedCount++;
      }
    }

    return {
      success: true,
      notifiedCount,
      totalPendingCount: studentTasksMap.size,
      unlinkedCount,
      details: `Sent reminders to ${notifiedCount} student(s) directly on Telegram. (${unlinkedCount} students do not have Telegram linked yet).`
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
 * 🔗 Link Student Telegram Account by Register Number or Username
 */
export async function linkStudentTelegram(
  identifier: string,
  chatId: string | number,
  telegramUsername?: string
): Promise<{ success: boolean; studentName?: string; message: string }> {
  try {
    const cleanId = identifier.trim().toLowerCase();
    
    // Find student by register_number, username, or email prefix
    const res = await pool.query(`
      SELECT id, full_name, register_number, username, role
      FROM users
      WHERE (LOWER(register_number) = $1 OR LOWER(username) = $1 OR LOWER(email) = $1)
      LIMIT 1
    `, [cleanId]);

    if (res.rows.length === 0) {
      return {
        success: false,
        message: `Student with Register Number or Username "${identifier}" was not found.`
      };
    }

    const user = res.rows[0];
    await pool.query(`
      UPDATE users
      SET telegram_chat_id = $1,
          telegram_username = $2,
          telegram_linked_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [String(chatId), telegramUsername || null, user.id]);

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
 * 🤖 Background Poller for Telegram Bot Updates
 * Listens for students clicking deep links (e.g. /start 7376222IT101) or texting /link <reg_no>
 */
let isPolling = false;
let lastUpdateId = 0;

export function startTelegramPoller(): void {
  const token = getBotToken();
  if (!token || isPolling) return;

  isPolling = true;
  console.log('[Telegram Bot] Starting update poller for automated linking...');

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const text = msg.text.trim();
          const chatId = msg.chat.id;
          const fromUsername = msg.from?.username || '';
          const senderName = msg.from?.first_name || 'there';

          // Check if message is /start <param> or /link <param>
          if (text.startsWith('/start') || text.startsWith('/link')) {
            const parts = text.split(/\s+/);
            const param = parts[1]?.trim();

            if (param) {
              const linkResult = await linkStudentTelegram(param, chatId, fromUsername);
              if (linkResult.success) {
                await sendTelegramMessage(
                  chatId,
                  `🎉 *Account Connected Successfully!*\n\nHello *${linkResult.studentName}*,\nYour Telegram is now securely linked to *IT TaskManager*.\n\nYou will automatically receive private alerts for upcoming deadlines and target updates here! 🚀`
                );
              } else {
                await sendTelegramMessage(
                  chatId,
                  `⚠️ *Could Not Link Account*\n\n${linkResult.message}\n\nPlease verify your Register Number or click the "Connect Telegram" button in your IT TaskManager portal.`
                );
              }
            } else {
              // Plain /start command
              await sendTelegramMessage(
                chatId,
                `👋 *Hello ${senderName}!* Welcome to the *IT TaskManager Bot*.\n\nTo link your account and receive private task reminders, reply with:\n\`/link YOUR_REGISTER_NUMBER\`\n\n_Example:_ \`/link 7376222IT101\``
              );
            }
          } else if (text === '/status') {
            const userRes = await pool.query(`SELECT full_name, register_number FROM users WHERE telegram_chat_id = $1`, [String(chatId)]);
            if (userRes.rows.length > 0) {
              await sendTelegramMessage(chatId, `✅ *Connected Account:* ${userRes.rows[0].full_name} (${userRes.rows[0].register_number})`);
            } else {
              await sendTelegramMessage(chatId, `ℹ️ This Telegram chat is not yet linked to any student account. Send \`/link <Your_Register_Number>\` to link.`);
            }
          }
        }
      }
    } catch (err: any) {
      // Ignore network aborts/timeouts
    } finally {
      if (isPolling) {
        setTimeout(poll, 2500);
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
