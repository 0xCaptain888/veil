/**
 * Email & SMS notification service for Veil.
 *
 * Sends claim links to recipients via email or SMS.
 * In production, integrate with a transactional service (SendGrid, Twilio, etc.).
 *
 * Current implementation: logs to console (demo mode).
 * Production: replace sendEmail()/sendSms() with actual delivery.
 *
 * SMS fallback (§18/§25): for recipients without smartphones, a text message
 * with the claim link is sent instead of (or in addition to) email.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsPayload {
  to: string;       // phone number in E.164 format (+1234567890)
  body: string;
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@veil.payments';
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'console'; // 'console' | 'sendgrid' | 'ses'
const SMS_SERVICE = process.env.SMS_SERVICE || 'console';     // 'console' | 'twilio' | 'sns'
const SMS_FROM = process.env.SMS_FROM || '+15551234567';

/**
 * Send an email to a recipient.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, html, text } = payload;

  if (EMAIL_SERVICE === 'console') {
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
  // if (EMAIL_SERVICE === 'sendgrid') {
  //   const sgMail = require('@sendgrid/mail');
  //   sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  //   await sgMail.send({ to, from: EMAIL_FROM, subject, html, text });
  //   return;
  // }

  // if (EMAIL_SERVICE === 'ses') {
  //   const ses = new AWS.SES();
  //   await ses.sendEmail({ ... }).promise();
  //   return;
  // }

  throw new Error(`Email service '${EMAIL_SERVICE}' not implemented. Set EMAIL_SERVICE=console for demo mode.`);
}

/**
 * Send an SMS to a recipient (§18 — low-bandwidth / non-smartphone fallback).
 * 
 * SMS messages are kept short (< 160 chars when possible) with the claim link.
 * For recipients without smartphones, the SMS contains the claim link which
 * opens a lightweight web page that works on basic browsers.
 */
export async function sendSms(payload: SmsPayload): Promise<void> {
  const { to, body } = payload;

  if (SMS_SERVICE === 'console') {
    console.log(`[sms] To: ${to}`);
    console.log(`[sms] From: ${SMS_FROM}`);
    console.log(`[sms] Body: ${body}`);
    return;
  }

  // Production: integrate with SMS service
  // if (SMS_SERVICE === 'twilio') {
  //   const twilio = require('twilio');
  //   const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  //   await client.messages.create({ to, from: SMS_FROM, body });
  //   return;
  // }

  // if (SMS_SERVICE === 'sns') {
  //   const sns = new AWS.SNS();
  //   await sns.publish({ PhoneNumber: to, Message: body }).promise();
  //   return;
  // }

  throw new Error(`SMS service '${SMS_SERVICE}' not implemented. Set SMS_SERVICE=console for demo mode.`);
}

/**
 * Send a claim link email to a recipient.
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

/**
 * Send a claim link via SMS (§18 — fallback for non-smartphone users).
 * 
 * The SMS is kept concise. The claim URL opens a lightweight page that works
 * on basic mobile browsers (no JS framework required for the core flow).
 * 
 * @param recipientPhone - Phone number in E.164 format (+1234567890)
 * @param claimUrl - The full claim URL
 * @param employerName - The employer's name
 * @param displayAmount - Amount for display
 */
export async function sendClaimSms(
  recipientPhone: string,
  claimUrl: string,
  employerName: string,
  displayAmount: string,
): Promise<void> {
  // Keep SMS under 160 chars if possible (single SMS segment)
  const body = `${employerName}: You have a payment of ${displayAmount}. Claim: ${claimUrl} — Veil`;
  
  await sendSms({ to: recipientPhone, body });
}

/**
 * Send claim notification via the preferred channel.
 * If a phone number is provided, sends SMS (or both email + SMS).
 * If only email is provided, sends email only.
 */
export async function sendClaimNotification(params: {
  email?: string;
  phone?: string;
  claimUrl: string;
  employerName: string;
  displayAmount: string;
  targetCoinType?: string;
  preferSms?: boolean;
}): Promise<void> {
  const { email, phone, claimUrl, employerName, displayAmount, targetCoinType, preferSms } = params;

  // Send SMS if phone is available (or preferred)
  if (phone) {
    try {
      await sendClaimSms(phone, claimUrl, employerName, displayAmount);
    } catch (err) {
      console.error(`[notify] Failed to send SMS to ${phone}:`, err);
      // Fall through to email if SMS fails
      if (!email) throw err;
    }
  }

  // Send email if available (and not SMS-only mode)
  if (email && !preferSms) {
    try {
      await sendClaimEmail(email, claimUrl, employerName, displayAmount, targetCoinType);
    } catch (err) {
      console.error(`[notify] Failed to send email to ${email}:`, err);
      if (!phone) throw err;
    }
  }
}
