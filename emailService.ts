/**
 * 📧 Automated Email Notification Service (Render & Cloud Compatible via HTTPS REST API)
 * Supports Brevo API (primary, unrestricted to any student email) and Resend API (fallback)
 */

const COLLEGE_LOGO_URL = 'https://raw.githubusercontent.com/Tharun4743/IT_taskmanager/main/public/logo.png';

export interface EmailNotificationPayload {
  to: string;
  studentName: string;
  registerNumber: string;
  taskTitle: string;
  status: 'VERIFIED' | 'REJECTED';
  noteOrReason?: string;
  portalUrl?: string;
}

/**
 * 📜 Send Formal Academic Task Status Notification (Approved / Rejected)
 */
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
    
    <!-- Top Government / College Gold Stripe -->
    <tr>
      <td height="6" style="background: linear-gradient(90deg, #1e3a8a 0%, #d97706 50%, #1e3a8a 100%);"></td>
    </tr>

    <!-- Institutional Letterhead Header -->
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

    <!-- Formal Reference Bar -->
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

    <!-- Main Content Area -->
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

        <!-- Formal Outcome Announcement -->
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          This official memorandum serves to inform you that your academic submission for the above-referenced assignment has been formally reviewed and evaluated by the department.
        </p>

        <!-- Official Status Seal Card -->
        <div style="background-color: ${badgeBg}; border: 2px solid ${badgeBorder}; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; display: block; margin-bottom: 6px;">
            EVALUATION STATUS
          </span>
          <span style="font-size: 18px; font-weight: 900; color: ${badgeColor}; letter-spacing: 0.05em;">
            ${isVerified ? '✅' : '⚠️'} ${statusText}
          </span>
        </div>

        <!-- Faculty Remarks Box -->
        ${noteOrReason ? `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${badgeColor}; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
            ${isVerified ? '📝 Faculty Remarks & Assessment:' : '📌 Reason for Correction / Instructions:'}
          </span>
          <p style="margin: 0; font-size: 13.5px; color: #1e293b; line-height: 1.5; font-style: italic;">
            "${noteOrReason}"
          </p>
        </div>` : ''}

        <!-- Official Portal Access Button -->
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

    <!-- Institutional Seal & Accreditation Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a; text-transform: uppercase;">
          Department of Information Technology • VSB Engineering College (Autonomous)
        </p>
        <p style="margin: 0 0 8px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: This transmission is intended solely for the registered student. Generated automatically by VSB Academic Task Management System.</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  // 1. Try Brevo HTTPS REST API (Port 443 — Unrestricted student delivery)
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey.trim(),
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME || 'VSBEC IT Department',
            email: process.env.BREVO_SENDER_EMAIL || 'vsbecitc2428@gmail.com'
          },
          to: [{ email: to, name: studentName }],
          subject,
          htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Official Academic Notification dispatched via Brevo to ${to} (${resData.messageId})`);
        return { success: true, messageId: resData.messageId };
      } else {
        console.warn(`[EmailService] Brevo API returned error:`, resData);
      }
    } catch (err: any) {
      console.warn(`[EmailService] Brevo network error:`, err.message);
    }
  }

  // 2. Try Resend HTTPS API (Fallback)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
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
        console.log(`[EmailService] ✅ Email dispatched via Resend to ${to} (${resData.id})`);
        return { success: true, messageId: resData.id };
      }
    } catch (err: any) {
      console.warn(`[EmailService] Resend network error:`, err.message);
    }
  }

  return { success: false, error: 'No active email provider configured' };
}

export interface PasswordResetOtpPayload {
  to: string;
  studentName: string;
  registerNumber?: string;
  otpCode: string;
  expiresInMinutes?: number;
}

/**
 * 🔐 Send Formal Password Reset Verification Code (OTP) Email
 */
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

    <!-- Institutional Letterhead Header -->
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

    <!-- Formal Reference Bar -->
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
        <p style="margin: 0 0 8px 0;">
          NH-67, Covai Road, Karur — 639 111, Tamil Nadu, India
        </p>
        <p style="margin: 0; font-size: 10px; color: #94a3b8;">
          🔒 <i>CONFIDENTIALITY NOTICE: Automated Security Transmission • Department of Information Technology</i>
        </p>
      </td>
    </tr>

  </table>

</body>
</html>
  `;

  // 1. Try Brevo HTTPS REST API
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey.trim(),
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: process.env.BREVO_SENDER_NAME || 'VSBEC IT Security Desk',
            email: process.env.BREVO_SENDER_EMAIL || 'vsbecitc2428@gmail.com'
          },
          to: [{ email: to, name: studentName }],
          subject,
          htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Official Security OTP dispatched via Brevo to ${to} (${resData.messageId})`);
        return { success: true, messageId: resData.messageId };
      } else {
        console.warn(`[EmailService] Brevo OTP error:`, resData);
      }
    } catch (err: any) {
      console.warn(`[EmailService] Brevo network error on OTP:`, err.message);
    }
  }

  // 2. Try Resend Fallback
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'VSBEC IT Security Desk <onboarding@resend.dev>',
          to: [to],
          subject,
          html: htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Password Reset OTP dispatched via Resend to ${to} (${resData.id})`);
        return { success: true, messageId: resData.id };
      }
    } catch (err: any) {
      console.warn(`[EmailService] Resend network error on OTP:`, err.message);
    }
  }

  return { success: false, error: 'No active email provider configured for OTP' };
}
