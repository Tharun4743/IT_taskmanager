/**
 * 📧 Automated Email Notification Service (Render & Cloud Compatible via HTTPS REST API)
 * Multi-Account Load Balancer & High-Availability Failover System (Brevo Node 1 & Node 2 + Resend Fallback)
 * 
 * Features:
 *  1. 📢 New Task Posted Notification
 *  2. ✅ Task Verification / Approval Notification
 *  3. ⚠️ Task Rejection / Action Required Notification
 *  4. ⏰ Incomplete Task Approaching Deadline Alert (2 Hours Remaining)
 *  5. 🔐 Password Reset OTP Verification
 */

import { pool } from './db.js';

const COLLEGE_LOGO_URL = 'https://raw.githubusercontent.com/Tharun4743/IT_taskmanager/main/public/logo.png';

interface BrevoAccountNode {
  nodeId: string;
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

let roundRobinIndex = 0;

/**
 * 🔄 Returns active Brevo account nodes for Load Balancing & Failover
 */
function getBrevoNodes(): BrevoAccountNode[] {
  const nodes: BrevoAccountNode[] = [];

  // Node 1 (Primary)
  const key1 = process.env.BREVO_API_KEY;
  if (key1 && key1.trim()) {
    nodes.push({
      nodeId: 'Brevo-Node-1',
      apiKey: key1.trim(),
      senderEmail: process.env.BREVO_SENDER_EMAIL || 'vsbecitc2428@gmail.com',
      senderName: process.env.BREVO_SENDER_NAME || 'VSBEC IT Department'
    });
  }

  // Node 2 (Load Balancer & Automatic Failover)
  const key2 = process.env.BREVO_API_KEY_2;
  if (key2 && key2.trim()) {
    nodes.push({
      nodeId: 'Brevo-Node-2',
      apiKey: key2.trim(),
      senderEmail: process.env.BREVO_SENDER_EMAIL_2 || 'campusconnectvsb@gmail.com',
      senderName: process.env.BREVO_SENDER_NAME_2 || 'VSBEC IT Department'
    });
  }

  return nodes;
}

/**
 * ⚡ Intelligent Multi-Node Email Dispatcher (Round-Robin Load Balancing + Instant Failover)
 */
async function dispatchEmailThroughPool(
  to: string,
  recipientName: string,
  subject: string,
  htmlContent: string,
  customSenderName?: string
): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
  const nodes = getBrevoNodes();

  if (nodes.length > 0) {
    const startIdx = roundRobinIndex % nodes.length;
    roundRobinIndex++;

    for (let i = 0; i < nodes.length; i++) {
      const activeNode = nodes[(startIdx + i) % nodes.length];
      const senderDisplayName = customSenderName || activeNode.senderName;

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': activeNode.apiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json'
          },
          body: JSON.stringify({
            sender: {
              name: senderDisplayName,
              email: activeNode.senderEmail
            },
            to: [{ email: to, name: recipientName }],
            subject,
            htmlContent
          })
        });

        const resData: any = await response.json();

        if (response.ok) {
          console.log(`[EmailService] ✅ Email dispatched via [${activeNode.nodeId} | <${activeNode.senderEmail}>] to ${to} (${resData.messageId})`);
          return { success: true, messageId: resData.messageId, provider: activeNode.nodeId };
        } else {
          console.warn(`[EmailService] ⚠️ ${activeNode.nodeId} returned status ${response.status}:`, resData?.message || resData);
        }
      } catch (err: any) {
        console.warn(`[EmailService] ⚠️ Network error on ${activeNode.nodeId}:`, err.message);
      }
    }
  }

  // Fallback to Resend if all Brevo nodes are exhausted
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim()) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'VSBEC IT Department <onboarding@resend.dev>',
          to: [to],
          subject,
          html: htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Fallback email dispatched via Resend to ${to} (${resData.id})`);
        return { success: true, messageId: resData.id, provider: 'Resend' };
      }
    } catch (err: any) {
      console.warn(`[EmailService] Resend fallback network error:`, err.message);
    }
  }

  return { success: false, error: 'All email dispatch nodes in pool exhausted.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NEW TASK POSTED NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface NewTaskEmailPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  taskTitle: string;
  taskCategory?: string;
  deadline?: string | null;
  creatorName?: string;
  submissionType?: string;
  portalUrl?: string;
}

export async function sendNewTaskPostedEmail(payload: NewTaskEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, taskTitle, taskCategory, deadline, creatorName, submissionType, portalUrl } = payload;
  const portalLink = portalUrl || process.env.FRONTEND_URL || 'https://it-taskmanager.onrender.com';
  const subject = `📢 New Academic Assignment: "${taskTitle}" — VSBEC IT`;
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const formattedDeadline = deadline 
    ? new Date(deadline).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : 'No strict deadline specified';
  const refCode = `VSBEC/IT/TASK/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 8px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
    
    <!-- Top Accent Stripe -->
    <tr>
      <td height="6" style="background: linear-gradient(90deg, #1e3a8a 0%, #d97706 50%, #1e3a8a 100%);"></td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="padding: 24px 24px 16px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <span style="font-size: 11px; font-weight: 800; color: #d97706; letter-spacing: 0.15em; text-transform: uppercase; display: block; margin-bottom: 2px;">
                Autonomous Institution • Accredited by NAAC with 'A' Grade
              </span>
              <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">
                VSB Engineering College
              </h1>
              <h2 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.08em; text-transform: uppercase;">
                Department of Information Technology
              </h2>
              <span style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: #1d4ed8; letter-spacing: 0.05em;">
                OFFICIAL ACADEMIC TASK ASSIGNMENT
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Reference Bar -->
    <tr>
      <td style="background-color: #0f172a; padding: 10px 24px; color: #f8fafc; font-size: 11px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="font-family: monospace; font-weight: 600; letter-spacing: 0.05em; color: #cbd5e1;">
              REF: ${refCode}
            </td>
            <td align="right" style="font-weight: 600; color: #f59e0b;">
              DATE: ${currentDate}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 28px 24px;">
        
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;">
          Dear <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
        </p>

        <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          A new official academic task has been posted for your class in the <b>VSB Academic Task Management Portal</b>. Please review the details below:
        </p>

        <!-- Task Metadata Table -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Assignment Title
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">
              ${taskTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Category
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e3a8a; font-weight: 700;">
              ${taskCategory || 'General Academic Task'}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Submission Deadline
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #b45309;">
              ⏰ ${formattedDeadline}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Mode of Submission
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600;">
              ${submissionType || 'Individual Submission'}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Posted By
            </td>
            <td style="padding: 12px 16px; color: #0f172a; font-weight: 600;">
              ${creatorName || 'Faculty / Coordinator'}
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; border-radius: 6px; border: 1px solid #1e3a8a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);">
            📝 View Assignment & Submit
          </a>
        </div>

      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a; text-transform: uppercase;">
          Department of Information Technology • VSB Engineering College (Autonomous)
        </p>
        <p style="margin: 0 0 4px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 6px 0 4px 0; font-size: 11px; color: #334155; font-weight: 600;">
          Developed by <a href="https://tharunkumark4743.netlify.app/" style="color: #1e3a8a; text-decoration: underline; font-weight: 800;">Tharunkumar K</a> • 🏛️ Department of Information Technology, VSBEC
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: Official Academic Notification • Generated automatically by VSB TaskManager</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Department');
}

/**
 * 📢 Broadcast New Task Announcement Email to all Students in Assigned Classes (Background non-blocking)
 */
export async function notifyNewTaskCreatedEmail(task: {
  id: string | number;
  title: string;
  category?: string;
  deadline?: string | null;
  creator_name?: string;
  submission_type?: string;
}, classIds: string[]) {
  try {
    let studentRows: any[] = [];
    if (classIds && classIds.length > 0) {
      const res = await pool.query(
        `SELECT full_name, register_number, email FROM users WHERE class_id = ANY($1::uuid[]) AND role = 'STUDENT' AND email IS NOT NULL AND email != ''`,
        [classIds]
      );
      studentRows = res.rows;
    } else {
      const res = await pool.query(
        `SELECT full_name, register_number, email FROM users WHERE role = 'STUDENT' AND email IS NOT NULL AND email != ''`
      );
      studentRows = res.rows;
    }

    if (studentRows.length === 0) return;

    console.log(`[EmailService] 📢 Broadcasting New Task email for "${task.title}" to ${studentRows.length} students...`);

    for (let i = 0; i < studentRows.length; i += 5) {
      const batch = studentRows.slice(i, i + 5);
      await Promise.allSettled(batch.map(student => 
        sendNewTaskPostedEmail({
          to: student.email,
          studentName: student.full_name,
          registerNumber: student.register_number,
          taskTitle: task.title,
          taskCategory: task.category,
          deadline: task.deadline,
          creatorName: task.creator_name,
          submissionType: task.submission_type
        })
      ));
    }
  } catch (err: any) {
    console.error('[EmailService] Error broadcasting new task email:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK VERIFIED / REJECTED NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailNotificationPayload {
  to: string;
  studentName: string;
  registerNumber: string;
  taskTitle: string;
  status: 'VERIFIED' | 'REJECTED';
  noteOrReason?: string;
  portalUrl?: string;
}

export async function sendTaskStatusEmail(payload: EmailNotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, taskTitle, status, noteOrReason, portalUrl } = payload;
  const isVerified = status === 'VERIFIED';
  const portalLink = portalUrl || process.env.FRONTEND_URL || 'https://it-taskmanager.onrender.com';

  const subject = isVerified 
    ? `📜 Official Academic Notification: Submission Approved — "${taskTitle}" — VSBEC IT`
    : `⚠️ Action Required: Submission Needs Correction — "${taskTitle}" — VSBEC IT`;

  const badgeColor = isVerified ? '#059669' : '#dc2626';
  const badgeBg = isVerified ? '#f0fdf4' : '#fef2f2';
  const badgeBorder = isVerified ? '#86efac' : '#fca5a5';
  const statusText = isVerified ? 'VERIFIED & APPROVED' : 'REJECTED — CORRECTION REQUIRED';
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const refCode = `VSBEC/IT/EVAL/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 8px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
    
    <!-- Top Accent Stripe -->
    <tr>
      <td height="6" style="background: linear-gradient(90deg, #1e3a8a 0%, #d97706 50%, #1e3a8a 100%);"></td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="padding: 24px 24px 16px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <span style="font-size: 11px; font-weight: 800; color: #d97706; letter-spacing: 0.15em; text-transform: uppercase; display: block; margin-bottom: 2px;">
                Autonomous Institution • Accredited by NAAC with 'A' Grade
              </span>
              <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">
                VSB Engineering College
              </h1>
              <h2 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.08em; text-transform: uppercase;">
                Department of Information Technology
              </h2>
              <span style="display: inline-block; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 600; color: #475569; letter-spacing: 0.05em;">
                OFFICIAL ACADEMIC TASK MANAGEMENT PORTAL
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Reference Bar -->
    <tr>
      <td style="background-color: #0f172a; padding: 10px 24px; color: #f8fafc; font-size: 11px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="font-family: monospace; font-weight: 600; letter-spacing: 0.05em; color: #cbd5e1;">
              REF: ${refCode}
            </td>
            <td align="right" style="font-weight: 600; color: #f59e0b;">
              DATE: ${currentDate}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 28px 24px;">
        
        <!-- Recipient Details Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; font-size: 13px;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Student Name
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">
              ${studentName}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Register Number
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 700; color: #1e3a8a; font-size: 14px;">
              ${registerNumber}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Task / Assignment
            </td>
            <td style="padding: 12px 16px; color: #0f172a; font-weight: 700;">
              ${taskTitle}
            </td>
          </tr>
        </table>

        <!-- Formal Announcement -->
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          This official memorandum serves to inform you that your academic submission for the above-referenced assignment has been formally reviewed and evaluated by the department.
        </p>

        <!-- Status Seal Card -->
        <div style="background-color: ${badgeBg}; border: 2px solid ${badgeBorder}; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; display: block; margin-bottom: 6px;">
            EVALUATION STATUS
          </span>
          <span style="font-size: 18px; font-weight: 900; color: ${badgeColor}; letter-spacing: 0.05em;">
            ${isVerified ? '✅' : '⚠️'} ${statusText}
          </span>
        </div>

        <!-- Remarks Box -->
        ${noteOrReason ? `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${badgeColor}; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
            ${isVerified ? '📝 Faculty Remarks & Assessment:' : '📌 Reason for Correction / Instructions:'}
          </span>
          <p style="margin: 0; font-size: 13.5px; color: #1e293b; line-height: 1.5; font-style: italic;">
            "${noteOrReason}"
          </p>
        </div>` : ''}

        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; border-radius: 6px; border: 1px solid #1e3a8a; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);">
            ${isVerified ? '📊 Access Portal Scorecard' : '🔄 Access Portal to Resubmit'}
          </a>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
          For any academic inquiries regarding this evaluation, kindly contact your designated <b>Class Advisor</b> or <b>Year Coordinator</b>.
        </p>

      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a; text-transform: uppercase;">
          Department of Information Technology • VSB Engineering College (Autonomous)
        </p>
        <p style="margin: 0 0 4px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 6px 0 4px 0; font-size: 11px; color: #334155; font-weight: 600;">
          Developed by <a href="https://tharunkumark4743.netlify.app/" style="color: #1e3a8a; text-decoration: underline; font-weight: 800;">Tharunkumar K</a> • 🏛️ Department of Information Technology, VSBEC
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSB Academic Task Management System.</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Department');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INCOMPLETE TASK DEADLINE ALERT (2 HOURS REMAINING)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeadlineAlertEmailPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  taskTitle: string;
  deadline: string;
  remainingText?: string;
  portalUrl?: string;
}

export async function sendDeadlineAlertEmail(payload: DeadlineAlertEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, taskTitle, deadline, remainingText = '2 Hours Remaining', portalUrl } = payload;
  const portalLink = portalUrl || process.env.FRONTEND_URL || 'https://it-taskmanager.onrender.com';
  const subject = `⏰ Urgent Reminder: ${remainingText} for "${taskTitle}" — VSBEC IT`;
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const formattedDeadline = new Date(deadline).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const refCode = `VSBEC/IT/URGENT/DEADLINE/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 8px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
    
    <!-- Top Urgent Stripe -->
    <tr>
      <td height="6" style="background: linear-gradient(90deg, #dc2626 0%, #f59e0b 50%, #dc2626 100%);"></td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="padding: 24px 24px 16px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #dc2626; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <span style="font-size: 11px; font-weight: 800; color: #dc2626; letter-spacing: 0.15em; text-transform: uppercase; display: block; margin-bottom: 2px;">
                Autonomous Institution • Accredited by NAAC with 'A' Grade
              </span>
              <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">
                VSB Engineering College
              </h1>
              <h2 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.08em; text-transform: uppercase;">
                Department of Information Technology
              </h2>
              <span style="display: inline-block; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 800; color: #b91c1c; letter-spacing: 0.05em;">
                ⚠️ URGENT DEADLINE EXPIRATION NOTICE
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Reference Bar -->
    <tr>
      <td style="background-color: #0f172a; padding: 10px 24px; color: #f8fafc; font-size: 11px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="font-family: monospace; font-weight: 600; letter-spacing: 0.05em; color: #cbd5e1;">
              REF: ${refCode}
            </td>
            <td align="right" style="font-weight: 600; color: #f59e0b;">
              DATE: ${currentDate}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 28px 24px;">
        
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;">
          Dear <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
        </p>

        <!-- Urgent Alert Banner -->
        <div style="background-color: #fff1f2; border: 2px solid #fecdd3; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <span style="font-size: 11px; font-weight: 800; color: #be123c; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">
            DEADLINE APPROACHING
          </span>
          <span style="font-size: 18px; font-weight: 900; color: #9f1239;">
            ⏳ ${remainingText}
          </span>
        </div>

        <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          Our academic records indicate that you have <b>NOT yet completed or submitted</b> your assignment for <b>"${taskTitle}"</b>. The portal submission window will close strictly at the deadline specified below:
        </p>

        <!-- Metadata Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Assignment
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">
              ${taskTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Submission Status
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #dc2626;">
              ⚠️ PENDING / NOT SUBMITTED
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Final Cut-off Time
            </td>
            <td style="padding: 12px 16px; font-weight: 800; color: #0f172a; font-family: monospace; font-size: 14px;">
              ⏰ ${formattedDeadline}
            </td>
          </tr>
        </table>

        <!-- Urgent Notice Box -->
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 12.5px; color: #92400e; font-weight: 600; line-height: 1.5;">
            📌 <b>Action Required:</b> Please upload your work and submit through the portal immediately to avoid late submission penalties or incomplete status in your internal assessment.
          </p>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${portalLink}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; border-radius: 6px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);">
            🚀 Submit Assignment Now
          </a>
        </div>

      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a; text-transform: uppercase;">
          Department of Information Technology • VSB Engineering College (Autonomous)
        </p>
        <p style="margin: 0 0 4px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 6px 0 4px 0; font-size: 11px; color: #334155; font-weight: 600;">
          Developed by <a href="https://tharunkumark4743.netlify.app/" style="color: #1e3a8a; text-decoration: underline; font-weight: 800;">Tharunkumar K</a> • 🏛️ Department of Information Technology, VSBEC
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: Automated Academic Urgency Transmission • Generated by VSB TaskManager</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Academic Desk');
}

/**
 * ⏰ Automated Scheduler: Scans tasks due within 2 hours for incomplete students and dispatches email alerts
 */
export async function triggerDeadlineUrgentEmailReminders(): Promise<{ dispatchedCount: number }> {
  try {
    const query = `
      SELECT DISTINCT 
        u.id as user_id, 
        u.full_name, 
        u.register_number, 
        u.email,
        t.id as task_id, 
        t.title as task_title, 
        t.deadline
      FROM users u
      JOIN task_classes tc ON tc.class_id = u.class_id
      JOIN tasks t ON t.id = tc.task_id
      LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = u.id
      LEFT JOIN task_deadline_alerts tda ON tda.task_id = t.id AND tda.user_id = u.id AND tda.alert_type = '2_HOUR'
      WHERE u.role = 'STUDENT'
        AND u.email IS NOT NULL AND u.email != ''
        AND t.status = 'OPEN'
        AND (ts.id IS NULL OR ts.status = 'REJECTED')
        AND t.deadline IS NOT NULL
        AND t.deadline > CURRENT_TIMESTAMP
        AND t.deadline <= CURRENT_TIMESTAMP + INTERVAL '2 hours 15 minutes'
        AND tda.id IS NULL
      ORDER BY t.deadline ASC
    `;

    const res = await pool.query(query);
    if (res.rows.length === 0) return { dispatchedCount: 0 };

    console.log(`[EmailService] ⏰ Found ${res.rows.length} pending submissions due in <= 2 hours. Dispatching urgent emails...`);

    let count = 0;
    for (const row of res.rows) {
      try {
        const sendRes = await sendDeadlineAlertEmail({
          to: row.email,
          studentName: row.full_name,
          registerNumber: row.register_number,
          taskTitle: row.task_title,
          deadline: row.deadline,
          remainingText: '2 Hours Remaining'
        });

        if (sendRes.success) {
          await pool.query(
            `INSERT INTO task_deadline_alerts (task_id, user_id, alert_type) VALUES ($1, $2, '2_HOUR') ON CONFLICT (task_id, user_id, alert_type) DO NOTHING`,
            [row.task_id, row.user_id]
          );
          count++;
        }
      } catch (err: any) {
        console.error(`[EmailService] Failed to send 2-hour deadline email to ${row.email}:`, err.message);
      }
    }

    console.log(`[EmailService] ⏰ Successfully dispatched ${count} urgent deadline reminder emails.`);
    return { dispatchedCount: count };
  } catch (err: any) {
    console.error('[EmailService] triggerDeadlineUrgentEmailReminders error:', err.message);
    return { dispatchedCount: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PASSWORD RESET OTP NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordResetOtpPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  otpCode: string;
  expiresInMinutes?: number;
}

export async function sendPasswordResetOtpEmail(payload: PasswordResetOtpPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, otpCode, expiresInMinutes = 10 } = payload;
  const subject = `🔐 Security Verification Code: ${otpCode} — VSBEC IT`;
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 8px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);">
    
    <!-- Top Accent Stripe -->
    <tr>
      <td height="6" style="background: linear-gradient(90deg, #1e3a8a 0%, #d97706 50%, #1e3a8a 100%);"></td>
    </tr>

    <!-- Institutional Header -->
    <tr>
      <td style="padding: 24px 24px 16px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
              <span style="font-size: 11px; font-weight: 800; color: #d97706; letter-spacing: 0.15em; text-transform: uppercase; display: block; margin-bottom: 2px;">
                Autonomous Institution • Accredited by NAAC with 'A' Grade
              </span>
              <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">
                VSB Engineering College
              </h1>
              <h2 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.08em; text-transform: uppercase;">
                Department of Information Technology
              </h2>
              <span style="display: inline-block; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 600; color: #475569; letter-spacing: 0.05em;">
                OFFICIAL PORTAL ACCESS & SECURITY DESK
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Reference Bar -->
    <tr>
      <td style="background-color: #0f172a; padding: 10px 24px; color: #f8fafc; font-size: 11px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="font-family: monospace; font-weight: 600; letter-spacing: 0.05em; color: #cbd5e1;">
              REF: VSBEC/IT/AUTH/RESET
            </td>
            <td align="right" style="font-weight: 600; color: #f59e0b;">
              DATE: ${currentDate}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 24px;">
        
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;">
          Dear <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
        </p>

        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
          An official password reset request was initiated for your account on the <b>VSB Academic Task Management System</b>. To authenticate your identity and assign a new password, use the one-time verification code (OTP) below:
        </p>

        <!-- OTP Code Box -->
        <div style="background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 10px; padding: 24px 16px; margin: 24px auto; text-align: center; max-width: 320px;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-bottom: 8px;">
            ONE-TIME SECURITY CODE
          </span>
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.25em; color: #0f172a; display: block;">
            ${otpCode}
          </span>
        </div>

        <!-- Expiry & Security Notice -->
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 12.5px; color: #92400e; font-weight: 600; line-height: 1.45;">
            ⚠️ <b>Notice:</b> This code is valid for exactly <b>${expiresInMinutes} minutes</b>. For security reasons, do not share or forward this verification code to anyone.
          </p>
        </div>

        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          If you did not make this request, please disregard this email. Your portal credentials remain secure.
        </p>

      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a; text-transform: uppercase;">
          Department of Information Technology • VSB Engineering College (Autonomous)
        </p>
        <p style="margin: 0 0 4px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 6px 0 4px 0; font-size: 11px; color: #334155; font-weight: 600;">
          Developed by <a href="https://tharunkumark4743.netlify.app/" style="color: #1e3a8a; text-decoration: underline; font-weight: 800;">Tharunkumar K</a> • 🏛️ Department of Information Technology, VSBEC
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: Automated Security Transmission • Department of Information Technology</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Security Desk');
}
