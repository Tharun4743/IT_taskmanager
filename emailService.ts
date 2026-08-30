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

import nodemailer from 'nodemailer';
import { pool } from './db.js';
import { constantStudentByRegNoMap } from './studentDirectoryService.js';

const COLLEGE_LOGO_URL = 'https://raw.githubusercontent.com/Tharun4743/IT_taskmanager/main/public/logo.png';

function getTelegramCommunityBoxHtml(): string {
  return `
        <!-- Telegram Community & Alerts Connect Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #7dd3fc; border-radius: 12px; margin: 28px 0 16px 0; overflow: hidden; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.08);">
          <tr>
            <td style="padding: 18px 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top; width: 44px; padding-right: 14px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" width="42" height="42" style="display: block; width: 42px; height: 42px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.15);" />
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.05em;">
                      ⚡ Telegram Alerts Bot & Department Community
                    </p>
                    <p style="margin: 0 0 12px 0; font-size: 12.5px; color: #334155; line-height: 1.45;">
                      Stay updated with instant deadline alerts, daily coding leaderboards & official department briefs.
                    </p>
                    <div>
                      <a href="https://t.me/IT_TaskManager_Alerts_bot" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; padding: 8px 16px; border-radius: 6px; margin-right: 8px; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                        🤖 Open Telegram Bot
                      </a>
                      <a href="https://t.me/it_taskmanager" style="display: inline-block; background: linear-gradient(135deg, #0f766e 0%, #047857 100%); color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; padding: 8px 16px; border-radius: 6px; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(4, 120, 87, 0.25);">
                        👥 Join Department Group
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
  `;
}

export const VERCEL_PORTAL_URL = 'https://it-taskmanager.vercel.app';
export const RENDER_PORTAL_URL = 'https://it-taskmanager-6rgp.onrender.com';

export function getDefaultPortalUrl(): string {
  const envUrl = process.env.FRONTEND_URL || process.env.APP_URL;
  if (envUrl && !envUrl.includes('onrender.com') && !envUrl.includes('render.com')) {
    return envUrl.replace(/\/$/, '');
  }
  return VERCEL_PORTAL_URL;
}

export function getDualPortalCtaHtml(
  buttonLabel: string,
  primaryColor: string = '#0f172a',
  targetPath: string = ''
): string {
  const cleanPath = targetPath ? (targetPath.startsWith('/') || targetPath.startsWith('?') ? targetPath : `/${targetPath}`) : '';
  const vercelUrl = `${VERCEL_PORTAL_URL}${cleanPath ? (cleanPath.startsWith('?') ? `/${cleanPath}` : cleanPath) : ''}`;
  const renderUrl = `${RENDER_PORTAL_URL}${cleanPath ? (cleanPath.startsWith('?') ? `/${cleanPath}` : cleanPath) : ''}`;

  return `
        <!-- Dual Portal Access Links (Vercel Primary & Render Mirror) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 16px 0;">
          <tr>
            <td align="center">
              <div style="margin-bottom: 12px;">
                <a href="${vercelUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; padding: 13px 26px; border-radius: 6px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22); margin: 4px;">
                  ${buttonLabel}
                </a>
                <a href="${renderUrl}" style="display: inline-block; background-color: #f1f5f9; color: #1e293b; text-decoration: none; font-size: 12px; font-weight: 700; padding: 12px 20px; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04); margin: 4px;">
                  ⚡ Render Mirror Link
                </a>
              </div>
              <div style="font-size: 11.5px; color: #64748b; line-height: 1.6; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; display: inline-block; text-align: left; max-width: 90%;">
                <div>🌐 <b>Primary Portal:</b> <a href="${vercelUrl}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${vercelUrl}</a></div>
                <div>⚡ <b>Mirror Portal:</b> <a href="${renderUrl}" style="color: #475569; text-decoration: underline;">${renderUrl}</a></div>
              </div>
            </td>
          </tr>
        </table>
  `;
}

function resolveValidPortalUrl(portalUrl?: string): string {
  if (portalUrl && !portalUrl.includes('onrender.com') && !portalUrl.includes('render.com')) {
    return portalUrl.replace(/\/$/, '');
  }
  return getDefaultPortalUrl();
}

/**
 * 🛑 Automated Background Broadcast Toggle
 * Controls background automated mass-email broadcasts:
 *  - Automated New Task Announcement Emails
 *  - Automated Reopened Task Announcement Emails
 *  - Automated 2-Hour Incomplete Deadline Alert Cron
 *  - Automated Notice Board Broadcast Emails
 * 
 * Defaults to FALSE in this repository because this repository is deployed across
 * 2 Render instances (and another repository is deployed on Vercel), which prevents
 * duplicate and repeating background broadcast emails.
 */
export function isAutomatedEmailBroadcastEnabled(): boolean {
  if (process.env.DISABLE_AUTOMATED_EMAIL_BROADCASTS === 'true' || process.env.DISABLE_AUTOMATED_EMAIL_BROADCASTS === '1') {
    return false;
  }
  if (process.env.ENABLE_AUTOMATED_EMAIL_BROADCASTS === 'true' || process.env.ENABLE_AUTOMATED_EMAIL_BROADCASTS === '1') {
    return true;
  }
  // Default: Disabled in this repo to prevent duplicate automated broadcasts across deployments
  return false;
}

/**
 * 🛑 Task Status / Verification / Approval Email Toggle
 * Controls if evaluation status emails (Approved, Verified, Rejected) are sent.
 * Defaults to FALSE to prevent individual evaluation email traffic.
 */
export function isTaskStatusEmailEnabled(): boolean {
  if (process.env.ENABLE_TASK_STATUS_EMAILS === 'true' || process.env.ENABLE_TASK_STATUS_EMAILS === '1') {
    return true;
  }
  // Default: Disabled (no evaluation status emails sent)
  return false;
}

/**
 * ✉️ General Email Service Dispatch Toggle
 * Controls if direct, on-demand emails (such as Forgot Password OTP and Manual HOD Reminders) can be sent.
 * Defaults to TRUE so essential user-initiated actions work properly.
 */
export function isEmailServiceEnabled(): boolean {
  if (process.env.DISABLE_ALL_EMAILS === 'true' || process.env.DISABLE_ALL_EMAILS === '1') {
    return false;
  }
  if (process.env.ENABLE_EMAIL_SERVICE === 'false' || process.env.ENABLE_EMAIL_SERVICE === '0') {
    return false;
  }
  return true;
}


interface BrevoAccountNode {
  nodeId: string;
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

let roundRobinIndex = 0;
let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST;
  const port = (process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT) ? parseInt((process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT)!, 10) : 587;
  const user = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;

  if (host && user && pass) {
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    return smtpTransporter;
  }

  // Gmail direct service shortcut
  if (user && pass && (user.includes('@gmail.com') || process.env.GMAIL_USER)) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
    return smtpTransporter;
  }

  return null;
}

interface NodeHealthState {
  status: 'HEALTHY' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'AUTH_ERROR';
  exhaustedUntil: number;
  failureCount: number;
  lastError: string;
}

const nodeHealthMap = new Map<string, NodeHealthState>();

function isNodeAvailable(nodeId: string): boolean {
  const health = nodeHealthMap.get(nodeId);
  if (!health) return true;
  if (health.status === 'HEALTHY') return true;
  // If cooldown period has elapsed, allow retry
  if (Date.now() >= health.exhaustedUntil) {
    nodeHealthMap.delete(nodeId);
    return true;
  }
  return false;
}

function markNodeExhausted(nodeId: string, errorMsg: string, status?: number) {
  const isQuota = status === 402 || /quota|limit|credit|exceeded|maximum|not enough/i.test(errorMsg);
  const isRateLimit = status === 429 || /rate|too many requests/i.test(errorMsg);
  const isAuth = status === 401 || status === 403 || /unauthorized|forbidden|invalid.*key|suspended/i.test(errorMsg);

  // Quota exhausted: 6-hour cooldown; Rate limited: 5-minute cooldown; Auth error: 12-hour cooldown
  const cooldownMs = isQuota ? 6 * 60 * 60 * 1000 : isRateLimit ? 5 * 60 * 1000 : isAuth ? 12 * 60 * 60 * 1000 : 15 * 60 * 1000;

  nodeHealthMap.set(nodeId, {
    status: isQuota ? 'QUOTA_EXHAUSTED' : isRateLimit ? 'RATE_LIMITED' : isAuth ? 'AUTH_ERROR' : 'QUOTA_EXHAUSTED',
    exhaustedUntil: Date.now() + cooldownMs,
    failureCount: (nodeHealthMap.get(nodeId)?.failureCount || 0) + 1,
    lastError: errorMsg
  });

  console.warn(`[EmailService] ⚡ Node [${nodeId}] marked unavailable for ${Math.round(cooldownMs / 60000)}m due to: ${errorMsg}. Load balancer will route to next node.`);
}

function markNodeHealthy(nodeId: string) {
  if (nodeHealthMap.has(nodeId)) {
    nodeHealthMap.delete(nodeId);
  }
}

/**
 * 🔄 Returns active Brevo account nodes for Load Balancing & Failover (Supports up to 5 nodes)
 */
function getBrevoNodes(): BrevoAccountNode[] {
  const nodes: BrevoAccountNode[] = [];

  const nodeConfigs = [
    { key: process.env.BREVO_API_KEY, email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME, id: 'Brevo-Node-1' },
    { key: process.env.BREVO_API_KEY_2, email: process.env.BREVO_SENDER_EMAIL_2, name: process.env.BREVO_SENDER_NAME_2, id: 'Brevo-Node-2' },
    { key: (process.env as any).BREVO_API_KEY_3, email: (process.env as any).BREVO_SENDER_EMAIL_3, name: (process.env as any).BREVO_SENDER_NAME_3, id: 'Brevo-Node-3' },
    { key: (process.env as any).BREVO_API_KEY_4, email: (process.env as any).BREVO_SENDER_EMAIL_4, name: (process.env as any).BREVO_SENDER_NAME_4, id: 'Brevo-Node-4' },
    { key: (process.env as any).BREVO_API_KEY_5, email: (process.env as any).BREVO_SENDER_EMAIL_5, name: (process.env as any).BREVO_SENDER_NAME_5, id: 'Brevo-Node-5' }
  ];

  for (const cfg of nodeConfigs) {
    if (cfg.key && cfg.key.trim()) {
      const defaultSender = cfg.id === 'Brevo-Node-2'
        ? 'campusvsb4743@gmail.com'
        : cfg.id === 'Brevo-Node-3'
        ? 'campusconnectvsb@gmail.com'
        : 'vsbecitc2428@gmail.com';

      nodes.push({
        nodeId: cfg.id,
        apiKey: cfg.key.trim(),
        senderEmail: cfg.email || defaultSender,
        senderName: cfg.name || 'VSBEC IT Department'
      });
    }
  }

  return nodes;
}

/**
 * 🔄 Live Available Credits & Multi-Node Pool Health Monitor
 */
export interface EmailNodeLiveStatus {
  nodeId: string;
  provider: 'Brevo' | 'Resend' | 'SMTP';
  senderEmail: string;
  senderName: string;
  status: 'HEALTHY' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'UNAVAILABLE';
  credits?: number | null;
  creditsType?: string;
  planType?: string;
  relayEnabled?: boolean;
  lastChecked: string;
  error?: string | null;
}

export async function getLiveEmailNodesStatus(): Promise<{
  nodes: EmailNodeLiveStatus[];
  totalAvailableCredits: number;
  healthyNodesCount: number;
  activeFallback: string;
  isEmailServiceEnabled: boolean;
  isAutomatedBroadcastEnabled: boolean;
}> {
  if (!isEmailServiceEnabled()) {
    return {
      nodes: [],
      totalAvailableCredits: 0,
      healthyNodesCount: 0,
      activeFallback: 'STOPPED / DISABLED (All email services disabled)',
      isEmailServiceEnabled: false,
      isAutomatedBroadcastEnabled: false
    };
  }

  const brevoNodes = getBrevoNodes();
  const statuses: EmailNodeLiveStatus[] = [];
  let totalCredits = 0;
  let healthyCount = 0;

  for (const node of brevoNodes) {
    const health = nodeHealthMap.get(node.nodeId);
    let nodeStatus: 'HEALTHY' | 'QUOTA_EXHAUSTED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'UNAVAILABLE' =
      health ? health.status : 'HEALTHY';
    let credits: number | null = null;
    let planType = 'Free (300 / day)';
    let creditsType = 'sendLimit';
    let relayEnabled = true;
    let errorMsg: string | null = health?.lastError || null;

    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'api-key': node.apiKey,
          'accept': 'application/json'
        }
      });

      if (response.ok) {
        const data: any = await response.json();
        if (data.plan && Array.isArray(data.plan) && data.plan.length > 0) {
          const mainPlan = data.plan[0];
          credits = typeof mainPlan.credits === 'number' ? mainPlan.credits : null;
          planType = mainPlan.type ? `${mainPlan.type.toUpperCase()}` : 'Free';
          creditsType = mainPlan.creditsType || 'sendLimit';
        }
        if (data.relay) {
          relayEnabled = !!data.relay.enabled;
        }
        if (credits !== null && credits > 0 && nodeStatus !== 'AUTH_ERROR') {
          nodeStatus = 'HEALTHY';
          markNodeHealthy(node.nodeId);
        } else if (credits === 0) {
          nodeStatus = 'QUOTA_EXHAUSTED';
        }
      } else {
        const errData: any = await response.json().catch(() => ({}));
        errorMsg = errData.message || `HTTP ${response.status}`;
        if (response.status === 401 || response.status === 403) {
          nodeStatus = 'AUTH_ERROR';
        } else if (response.status === 402) {
          nodeStatus = 'QUOTA_EXHAUSTED';
        }
      }
    } catch (err: any) {
      errorMsg = err.message || 'Network error';
      nodeStatus = 'UNAVAILABLE';
    }

    if (nodeStatus === 'HEALTHY') {
      healthyCount++;
      if (typeof credits === 'number') totalCredits += credits;
    }

    statuses.push({
      nodeId: node.nodeId,
      provider: 'Brevo',
      senderEmail: node.senderEmail,
      senderName: node.senderName,
      status: nodeStatus,
      credits,
      creditsType,
      planType,
      relayEnabled,
      lastChecked: new Date().toISOString(),
      error: errorMsg
    });
  }

  // Check Resend status
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim()) {
    const resendHealth = nodeHealthMap.get('Resend');
    statuses.push({
      nodeId: 'Resend-Node-1',
      provider: 'Resend',
      senderEmail: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      senderName: 'VSBEC IT Department',
      status: resendHealth ? resendHealth.status : 'HEALTHY',
      credits: 100,
      creditsType: 'apiSendLimit',
      planType: 'Free Tier (100 / day)',
      relayEnabled: true,
      lastChecked: new Date().toISOString(),
      error: resendHealth?.lastError || null
    });
  }

  // Check SMTP Relay status
  const smtp = getSmtpTransporter();
  if (smtp) {
    statuses.push({
      nodeId: 'SMTP-Relay-Fallback',
      provider: 'SMTP',
      senderEmail: process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL || 'vsbecitc2428@gmail.com',
      senderName: 'VSBEC IT Department',
      status: 'HEALTHY',
      credits: null,
      creditsType: 'unlimitedRelay',
      planType: 'Direct SMTP Relay',
      relayEnabled: true,
      lastChecked: new Date().toISOString(),
      error: null
    });
  }

  return {
    nodes: statuses,
    totalAvailableCredits: totalCredits,
    healthyNodesCount: healthyCount,
    activeFallback: smtp ? 'SMTP Relay' : resendKey ? 'Resend' : 'Brevo HTTPS Pool (Port 443)',
    isEmailServiceEnabled: true,
    isAutomatedBroadcastEnabled: isAutomatedEmailBroadcastEnabled()
  };
}

/**
 * ⚡ Intelligent Multi-Node Email Dispatcher (Round-Robin Load Balancing + Instant Quota Failover)
 */
async function dispatchEmailThroughPool(
  to: string,
  recipientName: string,
  subject: string,
  htmlContent: string,
  customSenderName?: string
): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
  if (!isEmailServiceEnabled()) {
    console.log(`[EmailService] 🛑 Email service is stopped/disabled in this repo. Suppressed dispatch to: ${to} (Subject: "${subject}")`);
    return { success: true, messageId: 'SUPPRESSED_EMAIL_SERVICE_DISABLED_IN_REPO', provider: 'DISABLED' };
  }

  const allNodes = getBrevoNodes();
  // Filter only healthy, non-exhausted nodes
  const availableNodes = allNodes.filter(n => isNodeAvailable(n.nodeId));
  const nodesToTry = availableNodes.length > 0 ? availableNodes : allNodes;
  let lastErrorMsg = '';

  if (nodesToTry.length > 0) {
    const startIdx = roundRobinIndex % nodesToTry.length;
    roundRobinIndex++;

    for (let i = 0; i < nodesToTry.length; i++) {
      const activeNode = nodesToTry[(startIdx + i) % nodesToTry.length];
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
          markNodeHealthy(activeNode.nodeId);
          console.log(`[EmailService] ✅ Email dispatched via [${activeNode.nodeId} | <${activeNode.senderEmail}>] to ${to} (${resData.messageId})`);
          return { success: true, messageId: resData.messageId, provider: activeNode.nodeId };
        } else {
          lastErrorMsg = resData?.message || JSON.stringify(resData);
          console.warn(`[EmailService] ⚠️ ${activeNode.nodeId} returned status ${response.status}:`, lastErrorMsg);
          // Mark circuit breaker if limit reached or auth error
          markNodeExhausted(activeNode.nodeId, lastErrorMsg, response.status);
        }
      } catch (err: any) {
        lastErrorMsg = err.message || 'Brevo network error';
        console.warn(`[EmailService] ⚠️ Network error on ${activeNode.nodeId}:`, err.message);
      }
    }
  }

  // Priority 2: Fallback to Resend if Brevo pool is exhausted
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim() && isNodeAvailable('Resend')) {
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
        markNodeHealthy('Resend');
        console.log(`[EmailService] ✅ Fallback email dispatched via Resend to ${to} (${resData.id})`);
        return { success: true, messageId: resData.id, provider: 'Resend' };
      } else {
        lastErrorMsg = resData?.message || JSON.stringify(resData);
        markNodeExhausted('Resend', lastErrorMsg, response.status);
      }
    } catch (err: any) {
      lastErrorMsg = err.message || 'Resend network error';
      console.warn(`[EmailService] Resend fallback network error:`, err.message);
    }
  }

  // Priority 3: Fallback to Nodemailer SMTP Relay / Direct Gmail
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const fromAddr = process.env.SMTP_FROM || process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'vsbecitc2428@gmail.com';
      const senderDisplayName = customSenderName || 'VSBEC IT Department';
      const info = await transporter.sendMail({
        from: `"${senderDisplayName}" <${fromAddr}>`,
        to,
        subject,
        html: htmlContent
      });
      console.log(`[EmailService] ✅ Fallback email dispatched via SMTP/Nodemailer to ${to} (${info.messageId})`);
      return { success: true, messageId: info.messageId, provider: 'SMTP' };
    } catch (err: any) {
      lastErrorMsg = err.message || 'SMTP network error';
      console.warn(`[EmailService] SMTP fallback network error:`, err.message);
    }
  }

  return { success: false, error: lastErrorMsg || 'All email dispatch nodes in pool exhausted.' };
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
  const portalLink = resolveValidPortalUrl(portalUrl);
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

        <!-- Top Color Bar -->
    <tr>
      <td style="height: 5px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #d97706 100%); font-size: 0; line-height: 0;">&nbsp;</td>
    </tr>
    <!-- Institutional Header -->
    <tr>
      <td style="padding: 28px 24px 20px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
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
            <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
              TASK: ${taskTitle}
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

        <!-- CTA Buttons -->
        ${getDualPortalCtaHtml('📝 View Assignment & Submit', '#0f172a')}
        ${getTelegramCommunityBoxHtml()}


      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
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
  if (!isAutomatedEmailBroadcastEnabled()) {
    console.log(`[EmailService] 🛑 Automated email broadcasts disabled in this deployment. Skipped new task broadcast for "${task.title}".`);
    return;
  }
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

/**
 * 🔄 Send Individual Task Reopened & Deadline Extended Email
 */
export interface TaskReopenedEmailPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  taskTitle: string;
  taskCategory?: string;
  deadline?: string | Date | null;
  newDeadline?: string | Date | null;
  reopenedBy?: string;
  reopenReason?: string;
  submissionType?: string;
  portalUrl?: string;
}

export async function sendTaskReopenedEmail(payload: TaskReopenedEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, taskTitle, taskCategory, reopenedBy, submissionType, portalUrl } = payload;
  const deadline = payload.newDeadline || payload.deadline;
  const portalLink = resolveValidPortalUrl(portalUrl);
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      })
    : 'Open / Extended (No Strict Cutoff)';

  const refCode = `VSB-REOPEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const subject = `🔄 Assignment Reopened & Extended: "${taskTitle}" — VSBEC IT TaskManager`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assignment Reopened</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 24px auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="background-color: #0f172a; padding: 24px; text-align: left; border-bottom: 3px solid #10b981;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                VSB Engineering College
              </h1>
              <h2 style="margin: 0 0 10px 0; color: #94a3b8; font-size: 12px; font-weight: 500; text-transform: uppercase;">
                Department of Information Technology • Academic Portal
              </h2>
              <span style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: #047857; letter-spacing: 0.05em;">
                🔄 ASSIGNMENT REOPENED & DEADLINE EXTENDED
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1e293b; padding: 10px 24px; color: #f8fafc; font-size: 11px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
              TASK: ${taskTitle}
            </td>
            <td align="right" style="font-weight: 600; color: #34d399;">
              DATE: ${currentDate}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 24px;">
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;">
          Dear <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          The submission window for the assignment <b>"${taskTitle}"</b> has been reopened and the deadline has been extended. If you have pending or incomplete submissions, please submit your proof on the portal before the new deadline.
        </p>
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
              New Extended Deadline
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #047857;">
              ⏰ ${formattedDeadline}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px;">
              Extended By
            </td>
            <td style="padding: 12px 16px; color: #0f172a; font-weight: 600;">
              ${reopenedBy || 'HOD / Faculty'}
            </td>
          </tr>
        </table>
        <!-- CTA Buttons -->
        ${getDualPortalCtaHtml('📝 View & Submit Proof on Portal', '#047857')}
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
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
 * 🔄 Broadcast Task Reopened & Deadline Extended Email to all Students in Assigned Classes (Background non-blocking)
 */
export async function notifyTaskReopenedEmail(task: {
  id: string | number;
  title: string;
  category?: string;
  deadline?: string | Date | null;
  reopened_by?: string;
  submission_type?: string;
}, classIds?: string[]) {
  if (!isAutomatedEmailBroadcastEnabled()) {
    console.log(`[EmailService] 🛑 Automated email broadcasts disabled in this deployment. Skipped reopened task broadcast for "${task.title}".`);
    return;
  }
  try {
    let studentRows: any[] = [];
    const validClassIds = Array.isArray(classIds)
      ? classIds.filter(id => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id).trim()))
      : [];

    if (validClassIds.length > 0) {
      const res = await pool.query(
        `SELECT full_name, register_number, email FROM users WHERE class_id = ANY($1::uuid[]) AND role = 'STUDENT' AND email IS NOT NULL AND email != ''`,
        [validClassIds]
      );
      studentRows = res.rows;
    } else if (task.id) {
      const res = await pool.query(`
        SELECT u.full_name, u.register_number, u.email
        FROM users u
        WHERE u.role = 'STUDENT' AND u.email IS NOT NULL AND u.email != ''
          AND (
            u.class_id IN (SELECT class_id FROM task_classes WHERE task_id = $1)
            OR u.department_id IN (SELECT department_id FROM tasks WHERE id = $1)
          )
      `, [task.id]);
      studentRows = res.rows;
    } else {
      const res = await pool.query(
        `SELECT full_name, register_number, email FROM users WHERE role = 'STUDENT' AND email IS NOT NULL AND email != ''`
      );
      studentRows = res.rows;
    }

    if (studentRows.length === 0) return;

    console.log(`[EmailService] 🔄 Broadcasting Reopened Task email for "${task.title}" to ${studentRows.length} students...`);

    for (let i = 0; i < studentRows.length; i += 5) {
      const batch = studentRows.slice(i, i + 5);
      await Promise.allSettled(batch.map(student => 
        sendTaskReopenedEmail({
          to: student.email,
          studentName: student.full_name,
          registerNumber: student.register_number,
          taskTitle: task.title,
          taskCategory: task.category,
          deadline: task.deadline,
          reopenedBy: task.reopened_by,
          submissionType: task.submission_type
        })
      ));
    }
    console.log(`[EmailService] ✅ Successfully dispatched reopened task emails for "${task.title}".`);
  } catch (err: any) {
    console.error('[EmailService] Error broadcasting reopened task email:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK VERIFIED / REJECTED NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailNotificationPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  taskTitle: string;
  status: 'VERIFIED' | 'REJECTED' | string;
  noteOrReason?: string;
  reason?: string;
  feedback?: string;
  reviewedBy?: string;
  reviewerRole?: string;
  taskCategory?: string;
  portalUrl?: string;
}

export async function sendTaskStatusEmail(payload: EmailNotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isTaskStatusEmailEnabled() || !isEmailServiceEnabled()) {
    console.log(`[EmailService] ℹ️ Task verification/approval status emails are disabled. Skipped status email to: ${payload.to} (Status: ${payload.status})`);
    return { success: true, messageId: 'SUPPRESSED_TASK_STATUS_EMAIL_DISABLED' };
  }
  const { to, studentName, registerNumber, taskTitle, status, portalUrl } = payload;
  const noteOrReason = payload.noteOrReason || payload.feedback || payload.reason || '';
  const isVerified = status === 'VERIFIED';
  const portalLink = resolveValidPortalUrl(portalUrl);

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

        <!-- Top Color Bar -->
    <tr>
      <td style="height: 5px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #d97706 100%); font-size: 0; line-height: 0;">&nbsp;</td>
    </tr>
    <!-- Institutional Header -->
    <tr>
      <td style="padding: 28px 24px 20px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
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
            <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
              TASK: ${taskTitle}
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

        <!-- CTA Buttons -->
        ${getDualPortalCtaHtml(isVerified ? '📊 Access Portal Scorecard' : '🔄 Access Portal to Resubmit', '#0f172a')}

        <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
          For any academic inquiries regarding this evaluation, kindly contact your designated <b>Class Advisor</b> or <b>Year Coordinator</b>.
        </p>
        ${getTelegramCommunityBoxHtml()}


      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
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
  const portalLink = resolveValidPortalUrl(portalUrl);
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

        <!-- Top Color Bar -->
    <tr>
      <td style="height: 5px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #d97706 100%); font-size: 0; line-height: 0;">&nbsp;</td>
    </tr>
    <!-- Institutional Header -->
    <tr>
      <td style="padding: 28px 24px 20px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #dc2626; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
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
            <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
              TASK: ${taskTitle}
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

        <!-- CTA Buttons -->
        ${getDualPortalCtaHtml('🚀 Submit Assignment Now', '#dc2626')}
        ${getTelegramCommunityBoxHtml()}


      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
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
  if (!isAutomatedEmailBroadcastEnabled()) {
    return { dispatchedCount: 0 };
  }
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
  studentName?: string;
  name?: string;
  registerNumber?: string;
  otpCode?: string | number;
  otp?: string | number;
  expiresInMinutes?: number;
  expiryMinutes?: number;
  portalUrl?: string;
}

export async function sendPasswordResetOtpEmail(payload: PasswordResetOtpPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, registerNumber } = payload;
  const studentName = payload.studentName || payload.name || 'User';
  const otpCode = String(payload.otpCode || payload.otp || '000000');
  const expiresInMinutes = payload.expiresInMinutes || payload.expiryMinutes || 10;
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

        <!-- Top Color Bar -->
    <tr>
      <td style="height: 5px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #d97706 100%); font-size: 0; line-height: 0;">&nbsp;</td>
    </tr>
    <!-- Institutional Header -->
    <tr>
      <td style="padding: 28px 24px 20px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="76" height="76" style="display: block; width: 76px; height: 76px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
            </td>
          </tr>
          <tr>
            <td align="center">
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
            <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
              SECURITY: PASSWORD RESET OTP
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

        <!-- Easy-to-Copy OTP Code Box -->
        <div style="background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; padding: 22px 16px; margin: 24px auto; text-align: center; max-width: 340px;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-bottom: 10px;">
            ONE-TIME SECURITY CODE
          </span>
          <div style="background: #ffffff; border: 2px dashed #94a3b8; border-radius: 8px; padding: 12px 20px; display: inline-block; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; cursor: pointer;">
            <span style="font-family: 'Courier New', Courier, monospace, 'Lucida Console'; font-size: 38px; font-weight: 900; letter-spacing: 6px; color: #0f172a; display: block; user-select: all; -webkit-user-select: all;">${otpCode}</span>
          </div>
          <span style="font-size: 11.5px; color: #64748b; font-weight: 600; display: block; margin-top: 10px;">
            📋 <i>Tap or click code to select all & copy</i>
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
        ${getDualPortalCtaHtml('🔐 Open Academic Portal', '#0f172a')}
        ${getTelegramCommunityBoxHtml()}


      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Security Desk');
}

/**
 * Dispatches an official Task Pending Reminder email to an incomplete student.
 */
export async function sendTaskPendingReminderEmail(
  toOrPayload: string | {
    to: string;
    studentName: string;
    registerNumber?: string;
    className?: string;
    taskTitle: string;
    deadline?: string;
    category?: string;
    customMessage?: string;
    senderTitle?: string;
    senderRole?: string;
    senderName?: string;
  },
  argStudentName?: string,
  argRegisterNumber?: string,
  argClassName?: string,
  argTaskTitle?: string,
  argDeadline?: string,
  argCategory?: string,
  argCustomMessage?: string,
  argSenderTitle?: string
): Promise<{ success: boolean; provider?: string; error?: string }> {
  let to: string;
  let studentName: string;
  let registerNumber: string;
  let className: string;
  let taskTitle: string;
  let deadline: string;
  let category: string | undefined;
  let customMessage: string | undefined;
  let senderTitle: string | undefined;

  if (typeof toOrPayload === 'object' && toOrPayload !== null) {
    to = toOrPayload.to;
    studentName = toOrPayload.studentName;
    registerNumber = toOrPayload.registerNumber || '';
    className = toOrPayload.className || '';
    taskTitle = toOrPayload.taskTitle;
    deadline = toOrPayload.deadline || 'Approaching Soon';
    category = toOrPayload.category;
    customMessage = toOrPayload.customMessage;
    senderTitle = toOrPayload.senderTitle || (toOrPayload.senderRole ? `${toOrPayload.senderName || 'Faculty'} (${toOrPayload.senderRole})` : 'VSBEC IT Department');
  } else {
    to = toOrPayload as string;
    studentName = argStudentName || '';
    registerNumber = argRegisterNumber || '';
    className = argClassName || '';
    taskTitle = argTaskTitle || 'Academic Assignment';
    deadline = argDeadline || 'Approaching Soon';
    category = argCategory;
    customMessage = argCustomMessage;
    senderTitle = argSenderTitle;
  }
  const formattedDeadline = new Date(deadline).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  });

  const subject = `⚠️ URGENT ACTION: Pending Submission for "${taskTitle}" — VSBEC IT Department`;
  const portalLink = resolveValidPortalUrl();
  const refCode = `VSBEC/IT/PENDING/${Date.now().toString(36).toUpperCase()}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pending Task Submission Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">

  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
    
    <!-- Institutional Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 24px 28px; text-align: center; border-bottom: 4px solid #f59e0b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px auto;">
          <tr>
            <td align="center" style="vertical-align: middle;">
              <img src="https://raw.githubusercontent.com/Tharun4743/IT_taskmanager/main/public/logo.png" alt="VSBEC Emblem" width="68" height="68" style="display: block; border-radius: 8px; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.25);" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.06em; text-transform: uppercase;">
          VSB ENGINEERING COLLEGE
        </h1>
        <p style="margin: 0; font-size: 13px; color: #fde047; font-weight: 700; letter-spacing: 0.04em;">
          DEPARTMENT OF INFORMATION TECHNOLOGY
        </p>
      </td>
    </tr>

    <!-- Reference & Alert Header -->
    <tr>
      <td style="padding: 20px 28px 0 28px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 11px; color: #64748b; font-weight: 700; letter-spacing: 0.05em;">
              ${refCode}
            </td>
            <td align="right" style="font-size: 11px; color: #dc2626; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
              ⚠️ ACTION REQUIRED
            </td>
          </tr>
        </table>
        <div style="border-bottom: 2px solid #e2e8f0; margin-top: 8px;"></div>
      </td>
    </tr>

    <!-- Main Body -->
    <tr>
      <td style="padding: 20px 28px 24px 28px;">
        <p style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
          Dear ${studentName} <span style="font-size: 13px; color: #64748b; font-weight: 600;">(${registerNumber || className})</span>,
        </p>
        
        <p style="margin: 0 0 18px 0; font-size: 13.5px; line-height: 1.6; color: #334155;">
          This is an official memorandum from the <b>${senderTitle || 'Department Head / Faculty Coordinator'}</b>. According to department records, you have not yet submitted your completion proof for the following academic task:
        </p>

        <!-- Task Summary Card -->
        <table width="100%" border="0" cellpadding="10" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
          <tr>
            <td width="30%" style="font-weight: 700; color: #991b1b;">Task Title:</td>
            <td style="font-weight: 800; color: #0f172a; font-size: 14px;">${taskTitle}</td>
          </tr>
          ${category ? `
          <tr>
            <td style="font-weight: 700; color: #991b1b;">Category:</td>
            <td style="font-weight: 600; color: #1e293b;">${category}</td>
          </tr>` : ''}
          <tr>
            <td style="font-weight: 700; color: #991b1b;">Class Section:</td>
            <td style="font-weight: 600; color: #1e293b;">${className}</td>
          </tr>
          <tr>
            <td style="font-weight: 700; color: #991b1b;">Final Deadline:</td>
            <td style="font-weight: 800; color: #b91c1c;">${formattedDeadline}</td>
          </tr>
        </table>

        <!-- Custom HOD / Coordinator Directive Note -->
        ${customMessage ? `
        <div style="background-color: #ffffff; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
            📢 Directive from ${senderTitle || 'Faculty Leadership'}:
          </span>
          <p style="margin: 0; font-size: 13.5px; color: #1e293b; line-height: 1.5; font-style: italic;">
            "${customMessage}"
          </p>
        </div>` : ''}

        <!-- Warning Callout -->
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 12.5px; color: #92400e; line-height: 1.45;">
            ⏳ <b>Urgent:</b> Please log in to the Task Management Portal immediately to upload your screenshot / completion proof prior to deadline closing to avoid academic non-compliance.
          </p>
        </div>

        <!-- CTA Buttons -->
        ${getDualPortalCtaHtml('🚀 Submit Task Proof Now', '#dc2626')}
        ${getTelegramCommunityBoxHtml()}


      </td>
    </tr>

    <!-- Institutional Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
          Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
        </p>
        <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSBEC IT DEPARTMENT.</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, senderTitle || 'VSBEC IT Department Desk');
}

/**
 * Triggers batch email reminders to all incomplete students for a specific task across all its assigned classes.
 */
export async function triggerManualTaskPendingReminders(
  taskId: string | number,
  customMessage?: string,
  senderRole?: string,
  senderName?: string
): Promise<{ success: boolean; totalStudents: number; sentCount: number; failedCount: number; errors: string[] }> {
  if (!isEmailServiceEnabled()) {
    console.log(`[EmailService] 🛑 Mail service disabled. Skipped manual pending reminder email for task ${taskId}.`);
    return {
      success: true,
      totalStudents: 0,
      sentCount: 0,
      failedCount: 0,
      errors: ['Mail service is disabled in this repo to prevent duplicate email dispatches across deployments.']
    };
  }
  try {
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [taskId]);
    const task = taskRes.rows[0];
    if (!task) {
      return { success: false, totalStudents: 0, sentCount: 0, failedCount: 0, errors: ['Task not found'] };
    }

    // 1. Resolve Target Classes for this task
    let targetClassIds: string[] = [];
    const tcRes = await pool.query('SELECT class_id FROM task_classes WHERE task_id = $1', [taskId]);
    if (tcRes.rows.length > 0) {
      targetClassIds = tcRes.rows.map(r => r.class_id);
    } else if (task.department_id) {
      const deptClassesRes = await pool.query('SELECT id FROM classes WHERE department_id = $1', [task.department_id]);
      targetClassIds = deptClassesRes.rows.map(r => r.id);
    } else {
      const allClassesRes = await pool.query('SELECT id FROM classes');
      targetClassIds = allClassesRes.rows.map(r => r.id);
    }

    if (targetClassIds.length === 0) {
      return { success: true, totalStudents: 0, sentCount: 0, failedCount: 0, errors: [] };
    }

    // 2. Query incomplete students depending on submission_type (TEAM vs INDIVIDUAL)
    let studentsRes;
    if (task.submission_type === 'TEAM') {
      studentsRes = await pool.query(`
        SELECT DISTINCT 
          u.id, 
          u.full_name, 
          u.register_number, 
          u.email, 
          c.name as class_name
        FROM users u
        JOIN classes c ON c.id = u.class_id
        WHERE u.role = 'STUDENT'
          AND u.class_id = ANY($1::uuid[])
          AND u.email IS NOT NULL 
          AND TRIM(u.email) != ''
          AND NOT EXISTS (
            SELECT 1 FROM teams t
            LEFT JOIN team_submissions ts ON ts.team_id = t.id
            WHERE t.task_id = $2
              AND (
                t.leader_id = u.id 
                OR EXISTS (
                  SELECT 1 FROM team_members tm 
                  WHERE tm.team_id = t.id AND tm.student_id = u.id AND tm.status = 'ACCEPTED'
                )
              )
              AND (t.status = 'SUBMITTED' OR ts.status IN ('PENDING', 'VERIFIED'))
          )
        ORDER BY c.name ASC, u.register_number ASC
      `, [targetClassIds, taskId]);
    } else {
      studentsRes = await pool.query(`
        SELECT DISTINCT 
          u.id, 
          u.full_name, 
          u.register_number, 
          u.email, 
          c.name as class_name
        FROM users u
        JOIN classes c ON c.id = u.class_id
        WHERE u.role = 'STUDENT'
          AND u.class_id = ANY($1::uuid[])
          AND u.email IS NOT NULL 
          AND TRIM(u.email) != ''
          AND NOT EXISTS (
            SELECT 1 FROM task_submissions ts
            WHERE ts.task_id = $2
              AND ts.user_id = u.id
              AND ts.status IN ('SUBMITTED', 'PENDING', 'VERIFIED', 'NOT_PARTICIPATING')
          )
        ORDER BY c.name ASC, u.register_number ASC
      `, [targetClassIds, taskId]);
    }

    const students = studentsRes.rows;
    if (students.length === 0) {
      return { success: true, totalStudents: 0, sentCount: 0, failedCount: 0, errors: [] };
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const senderTitle = senderRole === 'HOD' 
      ? 'Head of the Department (HOD)' 
      : (senderRole === 'SUPREME_ADMIN'
          ? 'Supreme Administrator / Head of Department'
          : (senderName ? `${senderName} (${senderRole === 'CLASS_ADVISOR' ? 'Class Advisor' : (senderRole || 'Coordinator')})` : 'Department Coordinator'));

    // Dispatch in batches through our Brevo multi-node load balancer pool
    const BATCH_SIZE = 5;
    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const chunk = students.slice(i, i + BATCH_SIZE);
      const promises = chunk.map(async (student) => {
        try {
          const res = await sendTaskPendingReminderEmail(
            student.email,
            student.full_name || 'Student',
            student.register_number || '',
            student.class_name || 'IT',
            task.title,
            task.deadline,
            task.category,
            customMessage,
            senderTitle
          );

          if (res.success) {
            sentCount++;
            // Insert in-app notification as well
            await pool.query(`
              INSERT INTO notifications (user_id, message, type)
              VALUES ($1, $2, 'TASK_PENDING_REMINDER')
            `, [student.id, `⚠️ Urgent Reminder: Submission pending for "${task.title}". Deadline: ${new Date(task.deadline).toLocaleString()}`]);
          } else {
            failedCount++;
            if (res.error) errors.push(`${student.email}: ${res.error}`);
          }
        } catch (err: any) {
          failedCount++;
          errors.push(`${student.email}: ${err.message || 'Unknown error'}`);
        }
      });

      await Promise.all(promises);
      if (i + BATCH_SIZE < students.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return {
      success: true,
      totalStudents: students.length,
      sentCount,
      failedCount,
      errors: errors.slice(0, 10)
    };
  } catch (err: any) {
    console.error('Error triggering manual task pending reminders:', err);
    return {
      success: false,
      totalStudents: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [err.message || 'Failed to trigger reminders']
    };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. NOTICE BOARD ANNOUNCEMENT NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export interface NoticeEmailPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  noticeId?: string | number;
  noticeTitle: string;
  noticeDescription: string;
  priority?: string;
  publisherName?: string;
  publisherRole?: string;
  attachmentUrl?: string | null;
  portalUrl?: string;
}

export async function sendNoticeAnnouncementEmail(payload: NoticeEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, noticeId, noticeTitle, noticeDescription, priority, publisherName, publisherRole, attachmentUrl, portalUrl } = payload;
  const portalLink = resolveValidPortalUrl(portalUrl);
  const directNoticeUrl = noticeId ? `${portalLink}/?tab=notice-board&noticeId=${noticeId}` : `${portalLink}/?tab=notice-board`;
  const isUrgent = priority === 'URGENT' || priority === 'HIGH';

  const subject = isUrgent
    ? `🚨 Urgent Official Announcement: "${noticeTitle}" — VSBEC IT Department`
    : `📢 Official Department Notice: "${noticeTitle}" — VSBEC IT Department`;

  const priorityBadgeColor = priority === 'URGENT' ? '#dc2626' : priority === 'HIGH' ? '#ea580c' : '#2563eb';
  const priorityBadgeBg = priority === 'URGENT' ? '#fef2f2' : priority === 'HIGH' ? '#fff7ed' : '#eff6ff';
  const priorityLabel = priority === 'URGENT' ? '🚨 URGENT NOTICE' : priority === 'HIGH' ? '⚠️ HIGH PRIORITY' : '📢 OFFICIAL NOTICE';
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  // Convert raw URLs inside text into clickable links
  const formattedDescription = (noticeDescription || '')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #2563eb; font-weight: 700; text-decoration: underline;" target="_blank">$1</a>')
    .replace(/\n/g, '<br/>');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8);">

          <!-- Top Gradient Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 40%, ${priorityBadgeColor} 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Institutional Header -->
          <tr>
            <td style="padding: 30px 24px 22px 24px; background-color: #ffffff; border-bottom: 2px solid #0f172a; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <img src="${COLLEGE_LOGO_URL}" alt="VSBEC IT Emblem" width="80" height="80" style="display: block; width: 80px; height: 80px; border-radius: 50%; border: 2px solid #d97706; box-shadow: 0 4px 10px rgba(0,0,0,0.12);" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0 0 4px 0; font-size: 21px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase; font-family: Georgia, 'Times New Roman', serif;">
                      VSB Engineering College
                    </h1>
                    <h2 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.08em; text-transform: uppercase;">
                      Department of Information Technology
                    </h2>
                    <span style="display: inline-block; background-color: ${priorityBadgeBg}; border: 1px solid ${priorityBadgeColor}; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 800; color: ${priorityBadgeColor}; letter-spacing: 0.06em;">
                      ${priorityLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reference Bar -->
          <tr>
            <td style="background-color: #0f172a; padding: 12px 24px; color: #f8fafc; font-size: 11px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1;">
                    DIGITAL NOTICE BOARD
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
            <td style="padding: 30px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #0f172a;">
                Dear <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                A new official circular has been published on the <b>Department Digital Notice Board</b>:
              </p>

              <!-- Notice Summary Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid ${priorityBadgeColor}; border-radius: 10px; padding: 20px 22px; margin-bottom: 24px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);">
                <div style="margin-bottom: 8px;">
                  <span style="display: inline-block; background-color: ${priorityBadgeBg}; color: ${priorityBadgeColor}; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                    ${priority || 'NORMAL'}
                  </span>
                </div>
                <h3 style="margin: 0 0 12px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.4;">
                  ${noticeTitle}
                </h3>
                <div style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.65; white-space: normal; word-break: break-word;">
                  ${formattedDescription}
                </div>
                <div style="padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; font-weight: 600;">
                  🏛 Published By: <b>${publisherName || 'Faculty / HOD'}</b> ${publisherRole ? `(${publisherRole})` : ''}
                </div>
              </div>

              ${attachmentUrl ? `
              <!-- Attachment Download Button -->
              <div style="text-align: center; margin: 16px 0 24px 0;">
                <a href="${attachmentUrl}" target="_blank" style="display: inline-block; background-color: #f1f5f9; color: #1e3a8a; border: 1px solid #cbd5e1; text-decoration: none; font-size: 12.5px; font-weight: 700; padding: 10px 22px; border-radius: 6px;">
                  📎 Download Attached Document / Circular
                </a>
              </div>` : ''}

              <!-- Direct CTA Section -->
              ${getDualPortalCtaHtml('📋 View Notice on Digital Portal', '#1e3a8a', noticeId ? `?tab=notice-board&noticeId=${noticeId}` : '?tab=notice-board')}

              <!-- Portal Status & Feature Summary Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; margin: 20px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 12.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                      🌐 Academic Portal Access Links
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #475569; line-height: 1.5;">
                      <b>Primary Portal (Vercel):</b> <a href="https://it-taskmanager.vercel.app/" style="color: #2563eb; font-weight: 700; text-decoration: underline;" target="_blank">https://it-taskmanager.vercel.app/</a>
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.5;">
                      <b>Mirror Portal (Render):</b> <a href="https://it-taskmanager-6rgp.onrender.com/" style="color: #475569; font-weight: 700; text-decoration: underline;" target="_blank">https://it-taskmanager-6rgp.onrender.com/</a>
                    </p>
                    <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
                      ✅ All existing accounts, tasks, LeetCode, and GitHub progress remain fully active and synced.
                    </p>
                  </td>
                </tr>
              </table>

              ${getTelegramCommunityBoxHtml()}

            </td>
          </tr>

          <!-- Institutional Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155; font-weight: 600; letter-spacing: 0.02em;">
                Developed and Maintained by <a href="https://tharunkumark4743.netlify.app/" style="color: #1d4ed8; text-decoration: underline; font-weight: 800;">Tharunkumar K</a>
              </p>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #94a3b8;">
                🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for registered students of the Department of Information Technology, VSB Engineering College.</i>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC IT Department Notices');
}

/**
 * Broadcasts an announcement email to all targeted students based on notice scope
 */
export async function notifyNoticeBoardAnnouncementEmail(notice: {
  id?: string | number;
  title: string;
  description: string;
  scope?: string;
  department_id?: string | number | null;
  class_id?: string | number | null;
  year?: string | number | null;
  priority?: string;
  attachment_url?: string | null;
  created_by?: string | number;
}): Promise<{ totalTargeted: number; totalDispatched: number }> {
  if (!isAutomatedEmailBroadcastEnabled()) {
    console.log(`[EmailService] 🛑 Automated email broadcasts disabled in this deployment. Skipped notice board email broadcast for "${notice.title}".`);
    return { totalTargeted: 0, totalDispatched: 0 };
  }
  try {
    let query = `
      SELECT u.id, u.full_name, u.register_number, u.email, u.class_id, u.department_id 
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.role = 'STUDENT'
    `;
    const params: any[] = [];

    if (notice.scope === 'CLASS' && notice.class_id) {
      params.push(notice.class_id);
      query += ` AND u.class_id = $1`;
    } else if (notice.scope === 'YEAR' && notice.year) {
      params.push(notice.year);
      query += ` AND c.year = $1`;
    } else if (notice.scope === 'DEPARTMENT' && notice.department_id) {
      params.push(notice.department_id);
      query += ` AND (u.department_id = $1 OR c.department_id = $1)`;
    }

    const studentsRes = await pool.query(query, params);
    const rawStudents = studentsRes.rows;

    let publisherName = 'Department Faculty';
    let publisherRole = 'STAFF';
    if (notice.created_by) {
      const pubRes = await pool.query('SELECT full_name, role FROM users WHERE id = $1 LIMIT 1', [notice.created_by]);
      if (pubRes.rows[0]) {
        publisherName = pubRes.rows[0].full_name;
        publisherRole = pubRes.rows[0].role;
      }
    }

    // Resolve valid emails with Student Directory fallback
    const targetStudents: { email: string; full_name: string; register_number?: string }[] = [];
    const seenEmails = new Set<string>();

    for (const st of rawStudents) {
      let email = st.email ? st.email.trim() : '';
      const regKey = st.register_number ? st.register_number.toLowerCase().trim() : '';
      if ((!email || !email.includes('@') || email.endsWith('@vsbec.ac.in')) && regKey) {
        const dir = constantStudentByRegNoMap.get(regKey);
        if (dir && dir.email && dir.email.includes('@')) {
          email = dir.email.trim();
        }
      }

      if (email && email.includes('@') && !seenEmails.has(email.toLowerCase())) {
        seenEmails.add(email.toLowerCase());
        targetStudents.push({
          email,
          full_name: st.full_name,
          register_number: st.register_number
        });
      }
    }

    console.log(`[EmailService] 📢 Broadcasting Notice Board Announcement "${notice.title}" (Notice ID: ${notice.id || 'N/A'}) to ${targetStudents.length} verified student email(s)...`);

    let dispatchedCount = 0;
    for (let i = 0; i < targetStudents.length; i += 5) {
      const batch = targetStudents.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(st =>
        sendNoticeAnnouncementEmail({
          to: st.email,
          studentName: st.full_name,
          registerNumber: st.register_number,
          noticeId: notice.id ? String(notice.id) : undefined,
          noticeTitle: notice.title,
          noticeDescription: notice.description,
          priority: notice.priority,
          publisherName,
          publisherRole,
          attachmentUrl: notice.attachment_url
        })
      ));

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.success) {
          dispatchedCount++;
        }
      }

      // Small throttle interval to avoid API rate bursts
      if (i + 5 < targetStudents.length) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    console.log(`[EmailService] ✅ Completed Notice Board broadcast: ${dispatchedCount}/${targetStudents.length} emails dispatched successfully.`);
    return { totalTargeted: targetStudents.length, totalDispatched: dispatchedCount };
  } catch (err: any) {
    console.error('[EmailService] Error broadcasting notice board email:', err.message);
    return { totalTargeted: 0, totalDispatched: 0 };
  }
}

// ─── Module 8: Skill Assessment & Placement Invitation Emails ────────────────
export async function sendAssessmentInvitationEmail(params: {
  to: string;
  studentName: string;
  registerNumber: string;
  className: string;
  classYear: number | string;
  trackTitle: string;
  trackType: string;
  cutoffPercentage: number;
  durationMins: number;
  questionCount: number;
  deadline?: string;
  customInstructions?: string;
  senderName?: string;
  senderRole?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    studentName,
    registerNumber,
    className,
    trackTitle,
    cutoffPercentage,
    durationMins,
    questionCount,
    deadline,
    customInstructions,
    senderName = 'HOD / Placement Coordinator',
    senderRole = 'Department of Information Technology'
  } = params;

  const subject = `🎯 Institutional Skill Assessment: ${trackTitle} — Official Notice`;
  const portalLink = `${getDefaultPortalUrl()}/#skill-assessment`;
  const formattedDeadline = deadline ? new Date(deadline).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : 'To be completed at the earliest';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
    <tr>
      <td style="background: linear-gradient(135deg, #09090b 0%, #1e1b4b 100%); padding: 32px 28px; text-align: left;">
        <span style="display: inline-block; background: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px;">
          Official Placement Assessment
        </span>
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">${trackTitle}</h1>
        <p style="color: #cbd5e1; font-size: 13px; margin: 0;">VSB Engineering College • Department of Information Technology</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">Dear <strong>${studentName}</strong> (${registerNumber || 'Student'}),</p>
        <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
          An official proctored assessment benchmark has been assigned for your cohort (<strong>${className}</strong>) by <strong>${senderName}</strong> (${senderRole}).
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; padding: 16px;">
          <tr>
            <td style="padding: 6px 12px; font-size: 12.5px; color: #64748b; font-weight: 600;">Assessment Track:</td>
            <td style="padding: 6px 12px; font-size: 13px; color: #0f172a; font-weight: 700;">${trackTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-size: 12.5px; color: #64748b; font-weight: 600;">Question Count:</td>
            <td style="padding: 6px 12px; font-size: 13px; color: #0f172a; font-weight: 700;">${questionCount} Questions</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-size: 12.5px; color: #64748b; font-weight: 600;">Duration Allowed:</td>
            <td style="padding: 6px 12px; font-size: 13px; color: #0f172a; font-weight: 700;">${durationMins} Minutes</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-size: 12.5px; color: #64748b; font-weight: 600;">Qualifying Cutoff:</td>
            <td style="padding: 6px 12px; font-size: 13px; color: #4338ca; font-weight: 800;">${cutoffPercentage}%</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; font-size: 12.5px; color: #64748b; font-weight: 600;">Submission Deadline:</td>
            <td style="padding: 6px 12px; font-size: 13px; color: #b45309; font-weight: 700;">${formattedDeadline}</td>
          </tr>
        </table>
        ${customInstructions ? `
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 12.5px; color: #92400e;"><strong>Special Instructions:</strong> ${customInstructions}</p>
        </div>` : ''}
        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalLink}" style="background: linear-gradient(135deg, #09090b 0%, #1e1b4b 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 30px; border-radius: 10px; display: inline-block;">
            🚀 Start Proctored Assessment Now →
          </a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return await dispatchEmailThroughPool(to, studentName, subject, htmlContent, 'VSBEC Placement Cell');
}

export async function triggerAssessmentCampaignEmails(params: {
  track_type: string;
  track_title?: string;
  target_year?: string;
  target_class_id?: string;
  custom_instructions?: string;
  deadline?: string;
  senderRole?: string;
  senderName?: string;
}): Promise<{ totalTargeted: number; totalDispatched: number; failedCount: number; errors: string[] }> {
  try {
    const {
      track_type,
      track_title: passedTitle,
      target_year = 'ALL',
      target_class_id = 'ALL',
      custom_instructions,
      deadline,
      senderRole,
      senderName
    } = params;

    const trackRes = await pool.query(`
      SELECT track_type, COALESCE(MAX(track_title), 'General Aptitude Benchmark') as track_title,
             COUNT(id)::int as question_count, COALESCE(MAX(cutoff_percentage), 60.00) as cutoff_percentage,
             15 as duration_mins
      FROM assessment_questions
      WHERE is_active = true AND track_type = $1
      GROUP BY track_type
    `, [track_type]);

    const track = trackRes.rows[0] || {
      track_type,
      track_title: passedTitle || 'Placement Skill Benchmark',
      question_count: 15,
      cutoff_percentage: 60,
      duration_mins: 15
    };

    let query = `
      SELECT u.id, u.full_name, u.register_number, u.email,
             c.name as class_name, c.year as class_year
      FROM users u
      JOIN classes c ON c.id = u.class_id
      WHERE u.role = 'STUDENT' AND u.email IS NOT NULL AND TRIM(u.email) != ''
    `;
    const values: any[] = [];
    let idx = 1;

    if (target_year && target_year !== 'ALL') {
      query += ` AND c.year = $${idx++}`;
      values.push(parseInt(target_year, 10));
    }
    if (target_class_id && target_class_id !== 'ALL') {
      query += ` AND c.id = $${idx++}`;
      values.push(target_class_id);
    }
    query += ` ORDER BY c.year ASC, c.name ASC, u.register_number ASC`;

    const studentsRes = await pool.query(query, values);
    const students = studentsRes.rows;

    if (students.length === 0) return { totalTargeted: 0, totalDispatched: 0, failedCount: 0, errors: [] };

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 2;

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const chunk = students.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (s) => {
        try {
          const res = await sendAssessmentInvitationEmail({
            to: s.email,
            studentName: s.full_name,
            registerNumber: s.register_number,
            className: s.class_name,
            classYear: s.class_year,
            trackTitle: track.track_title,
            trackType: track.track_type,
            cutoffPercentage: Number(track.cutoff_percentage),
            durationMins: Number(track.duration_mins),
            questionCount: Number(track.question_count),
            deadline,
            customInstructions: custom_instructions,
            senderName,
            senderRole
          });
          if (res.success) {
            sentCount++;
            await pool.query(`
              INSERT INTO notifications (user_id, message, type)
              VALUES ($1, $2, 'ASSESSMENT_INVITATION')
            `, [s.id, `🎯 New Placement Assessment Assigned: "${track.track_title}". Cutoff: ${track.cutoff_percentage}%.`]);
          } else {
            failedCount++;
            if (res.error) errors.push(`${s.email}: ${res.error}`);
          }
        } catch (e: any) {
          failedCount++;
          errors.push(`${s.email}: ${e.message}`);
        }
      }));
      if (i + BATCH_SIZE < students.length) await new Promise(r => setTimeout(r, 250));
    }

    return { totalTargeted: students.length, totalDispatched: sentCount, failedCount, errors: errors.slice(0, 10) };
  } catch (err: any) {
    return { totalTargeted: 0, totalDispatched: 0, failedCount: 0, errors: [err.message] };
  }
}

