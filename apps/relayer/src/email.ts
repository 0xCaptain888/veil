/**
 * Email notification service for Veil.
 *
 * Sends claim links to recipients via email. In production, integrate with
 * a transactional email service (SendGrid, Postmark, AWS SES, etc.).
 *
 * Current implementation: logs to console (demo mode).
 * Production: replace sendEmail() with actual email delivery.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@veil.payments';
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'console'; // 'console' | 'sendgrid' | 'ses' | etc.

/**
 * Send an email to a recipient.
 *
 * @param payload - The email to send
 * @returns Promise that resolves when the email is sent (or logged in demo mode)
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, html, text } = payload;

  if (EMAIL_SERVICE === 'console') {
    // Demo mode: log to console
    console.log(`[email] To: ${to}`);
    console.log(`[email] From: ${EMAIL_FROM}`);
    console.log(`[email] Subject: ${subject}`);
    console.log(`[email] Body (HTML): ${html.substring(0, 200)}...`);
    if (text) {
      console.log(`[email] Body (text): ${text.substring(0, 200)}...`);
    }
    return;
  }

  // Production: integrate with email service
  // Example: SendGrid
  // if (EMAIL_SERVICE === 'sendgrid') {
  //   const sgMail = require('@sendgrid/mail');
  //   sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  //   await sgMail.send({ to, from: EMAIL_FROM, subject, html, text });
  //   return;
  // }

  // Example: AWS SES
  // if (EMAIL_SERVICE === 'ses') {
  //   const ses = new AWS.SES();
  //   await ses.sendEmail({ ... }).promise();
  //   return;
  // }

  throw new Error(`Email service '${EMAIL_SERVICE}' not implemented. Set EMAIL_SERVICE=console for demo mode.`);
}

/**
 * Send a claim link email to a recipient.
 *
 * @param recipientEmail - The recipient's email address
 * @param claimUrl - The full claim URL (includes the one-time token)
 * @param employerName - The employer's name (for personalization)
 * @param displayAmount - The amount to be claimed (for display only)
 * @param targetCoinType - The target coin type (if FX swap is configured)
 */
export async function sendClaimEmail(
  recipientEmail: string,
  claimUrl: string,
  employerName: string,
  displayAmount: string,
  targetCoinType?: string,
): Promise<void> {
  const coinLabel = targetCoinType ? ` (${targetCoinType})` : '';

  const subject = `You have a payment from ${employerName} — Claim now`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0066FF; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h2>You have a payment from ${employerName}</h2>
    <p>Amount: <strong>${displayAmount}${coinLabel}</strong></p>
    <p>Click the button below to claim your payment. You'll need to connect your wallet to receive the funds.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${claimUrl}" class="button">Claim Payment</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #666;">${claimUrl}</p>
    <div class="footer">
      <p>This link is one-time use and will expire after claiming. If you didn't expect this payment, please contact ${employerName}.</p>
      <p>Powered by Veil — Confidential payroll on Sui</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
You have a payment from ${employerName}

Amount: ${displayAmount}${coinLabel}

Claim your payment: ${claimUrl}

This link is one-time use and will expire after claiming. If you didn't expect this payment, please contact ${employerName}.

Powered by Veil — Confidential payroll on Sui
  `.trim();

  await sendEmail({ to: recipientEmail, subject, html, text });
}
