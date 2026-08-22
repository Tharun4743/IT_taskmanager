/**
 * 📧 Automated Email Notification Service (Render & Cloud Compatible via HTTPS REST API)
 * Supports Brevo API (primary, unrestricted to any student email) and Resend API (fallback)
 */

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
    ? `✅ Submission Approved: "${taskTitle}" — IT TaskManager`
    : `⚠️ Action Required: Submission Needs Correction on "${taskTitle}" — IT TaskManager`;

  const badgeColor = isVerified ? '#10b981' : '#ef4444';
  const badgeBg = isVerified ? '#ecfdf5' : '#fef2f2';
  const badgeBorder = isVerified ? '#a7f3d0' : '#fecaca';
  const statusText = isVerified ? 'APPROVED & VERIFIED' : 'ACTION REQUIRED / REJECTED';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">IT Department Task Manager</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Official Assignment & Verification System</p>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px 24px;">
      
      <!-- Greeting -->
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
        Dear <b>${studentName}</b> (${registerNumber}),
      </p>

      <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
        Your submission for the task <b>"${taskTitle}"</b> has been reviewed by your faculty / coordinator.
      </p>

      <!-- Status Badge Card -->
      <div style="background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
        <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Review Outcome</span>
        <span style="font-size: 16px; font-weight: 800; color: ${badgeColor};">
          ${isVerified ? '🎉' : '⚠️'} ${statusText}
        </span>
      </div>

      <!-- Remarks / Note Section -->
      ${noteOrReason ? `
      <div style="background: #f1f5f9; border-left: 4px solid ${badgeColor}; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
        <span style="font-size: 12px; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">
          ${isVerified ? '📝 Faculty / Reviewer Note:' : '📌 Rejection Reason / Instructions:'}
        </span>
        <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.45;">
          ${noteOrReason}
        </p>
      </div>` : ''}

      <!-- Call to Action Button -->
      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${portalLink}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">
          ${isVerified ? '📊 View Task Scorecard' : '🔄 Open Portal to Resubmit'}
        </a>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.4;">
        If you have questions, please reach out to your Class Advisor or Year Coordinator.
      </p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
      Department of Information Technology • Academic Task Management System<br>
      © ${new Date().getFullYear()} VSB Engineering College. All rights reserved.
    </div>

  </div>
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
            name: process.env.BREVO_SENDER_NAME || 'IT TaskManager',
            email: process.env.BREVO_SENDER_EMAIL || 'campusconnectvsb@gmail.com'
          },
          to: [{ email: to, name: studentName }],
          subject,
          htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Email dispatched via Brevo to ${to} (${resData.messageId})`);
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
          from: process.env.EMAIL_FROM || 'IT TaskManager <onboarding@resend.dev>',
          to: [to],
          subject,
          html: htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Email dispatched via Resend to ${to} (${resData.id})`);
        return { success: true, messageId: resData.id };
      } else {
        console.warn(`[EmailService] Resend API error:`, resData);
      }
    } catch (err: any) {
      console.warn(`[EmailService] Resend network error:`, err.message);
    }
  }

  console.warn('[EmailService] No active email provider configured (BREVO_API_KEY or RESEND_API_KEY).');
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
 * 🔐 Send Password Reset Verification Code (OTP) Email
 */
export async function sendPasswordResetOtpEmail(payload: PasswordResetOtpPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, studentName, registerNumber, otpCode, expiresInMinutes = 10 } = payload;
  const subject = `🔐 Password Reset Code: ${otpCode} — IT TaskManager`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 32px; margin-bottom: 8px;">🔐</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Password Reset Verification</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">IT Department Task Management Portal</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px; text-align: center;">
      
      <p style="margin: 0 0 12px 0; font-size: 15px; color: #334155; text-align: left;">
        Hello <b>${studentName}</b> ${registerNumber ? `(${registerNumber})` : ''},
      </p>

      <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b; line-height: 1.5; text-align: left;">
        We received a request to reset your password for the <b>IT TaskManager Portal</b>. Use the 6-digit verification code below to set a new password:
      </p>

      <!-- OTP Display Box -->
      <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 0 auto 24px auto; display: inline-block; min-width: 240px;">
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">Verification Code</span>
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 0.25em; color: #4f46e5;">
          ${otpCode}
        </span>
      </div>

      <!-- Expiry Notice -->
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #b45309; font-weight: 600;">
          ⏰ This code is valid for <b>${expiresInMinutes} minutes</b>. Do not share this OTP with anyone.
        </p>
      </div>

      <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">
        If you did not request a password reset, you can safely ignore this email. Your account remains secure.
      </p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
      Department of Information Technology • VSB Engineering College<br>
      Automated Security Notification • Please do not reply directly to this email.
    </div>

  </div>
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
            name: process.env.BREVO_SENDER_NAME || 'IT TaskManager Security',
            email: process.env.BREVO_SENDER_EMAIL || 'vsbecitc2428@gmail.com'
          },
          to: [{ email: to, name: studentName }],
          subject,
          htmlContent
        })
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[EmailService] ✅ Password Reset OTP dispatched via Brevo to ${to} (${resData.messageId})`);
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
          from: process.env.EMAIL_FROM || 'IT TaskManager <onboarding@resend.dev>',
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
