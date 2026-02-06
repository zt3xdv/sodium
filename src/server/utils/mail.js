import nodemailer from 'nodemailer';
import { loadConfig } from '../db.js';
import logger from './logger.js';

let transporter = null;

export function initMailer() {
  const config = loadConfig();
  const mail = config.mail;
  
  if (!mail?.host || !mail?.user) {
    transporter = null;
    return false;
  }
  
  try {
    transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port || 587,
      secure: mail.secure || false,
      auth: {
        user: mail.user,
        pass: mail.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    logger.info(`Mail transporter initialized: ${mail.host}:${mail.port}`);
    return true;
  } catch (e) {
    logger.error('Failed to initialize mail transporter:', e.message);
    transporter = null;
    return false;
  }
}

export function reloadMailer() {
  transporter = null;
  return initMailer();
}

export function getTransporter() {
  if (!transporter) {
    initMailer();
  }
  return transporter;
}

export async function sendMail(options) {
  const config = loadConfig();
  const mail = config.mail || {};
  
  const transport = getTransporter();
  if (!transport) {
    throw new Error('Mail not configured');
  }
  
  const mailOptions = {
    from: `"${mail.fromName || 'Sodium Panel'}" <${mail.fromEmail || mail.user}>`,
    ...options
  };
  
  try {
    const info = await transport.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (e) {
    logger.error('Failed to send email:', e.message);
    throw e;
  }
}

// Email template helper with Sodium branding
function emailTemplate(panelName, title, content, footer) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090b; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px;">
          <!-- Logo Header -->
          <tr>
            <td style="padding: 0 0 24px; text-align: center;">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#e07a3a">
                  <path d="M11,21h-1l1-7H7.5c-0.88,0-0.33-0.75-0.31-0.78C8.48,10.94,10.42,7.54,13.01,3h1l-1,7h3.51c0.4,0,0.62,0.19,0.4,0.66C12.97,17.55,11,21,11,21z"/>
                </svg>
                <span style="font-size: 18px; font-weight: 600; color: #fafafa;">${panelName}</span>
              </div>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; overflow: hidden;">
                <!-- Title Bar -->
                <tr>
                  <td style="padding: 20px 24px; border-bottom: 1px solid #27272a;">
                    <h1 style="margin: 0; color: #fafafa; font-size: 18px; font-weight: 600;">${title}</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 24px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 0 0; text-align: center;">
              <p style="margin: 0; color: #52525b; font-size: 12px;">
                ${footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailButton(text, url) {
  return `<a href="${url}" style="display: inline-block; padding: 12px 20px; background-color: #e07a3a; color: #000; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">${text}</a>`;
}

function emailNote(text) {
  return `<div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 6px; padding: 12px 14px; margin-top: 20px;">
    <p style="margin: 0; color: #71717a; font-size: 12px;">${text}</p>
  </div>`;
}

export async function sendTestEmail(toEmail) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  
  const content = `
    <p style="margin: 0 0 16px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
      If you're reading this, your email configuration is working correctly. 
      You can now use email features like password resets and notifications.
    </p>
    <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 6px; padding: 12px 14px;">
      <p style="margin: 0; color: #e07a3a; font-family: monospace; font-size: 13px;">
        Host: ${config.mail?.host || 'Not set'}<br>
        Port: ${config.mail?.port || '587'}<br>
        Secure: ${config.mail?.secure ? 'Yes' : 'No'}
      </p>
    </div>
  `;
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Test Email`,
    html: emailTemplate(panelName, 'Test Email Successful!', content, `This is an automated test email from ${panelName}`),
    text: `${panelName} - Test Email\n\nIf you're reading this, your email configuration is working correctly.`
  });
}

export async function sendPasswordReset(toEmail, username, resetToken, resetUrl) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  const panelUrl = config.panel?.url || resetUrl.split('/auth')[0];
  
  const fullResetUrl = `${panelUrl}/auth/reset-password?token=${resetToken}`;
  
  const content = `
    <p style="margin: 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
      Hi <strong style="color: #fafafa;">${username}</strong>,<br><br>
      We received a request to reset your password. Click the button below to create a new password.
    </p>
    ${emailButton('Reset Password', fullResetUrl)}
    ${emailNote("This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.")}
  `;
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Password Reset`,
    html: emailTemplate(panelName, 'Password Reset Request', content, `${panelName} • This is an automated message`),
    text: `${panelName} - Password Reset\n\nHi ${username},\n\nWe received a request to reset your password. Visit this link to create a new password:\n\n${fullResetUrl}\n\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.`
  });
}

export async function sendWelcomeEmail(toEmail, username) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  const panelUrl = config.panel?.url || '';
  
  const content = `
    <p style="margin: 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
      Hi <strong style="color: #fafafa;">${username}</strong>,<br><br>
      Your account has been created successfully. You can now log in and start managing your game servers.
    </p>
    ${panelUrl ? emailButton('Go to Panel', panelUrl) : ''}
  `;
  
  return sendMail({
    to: toEmail,
    subject: `Welcome to ${panelName}!`,
    html: emailTemplate(panelName, `Welcome, ${username}!`, content, `${panelName} • Thank you for joining us`),
    text: `Welcome to ${panelName}!\n\nHi ${username},\n\nYour account has been created successfully. You can now log in and start managing your game servers.${panelUrl ? `\n\nVisit: ${panelUrl}` : ''}`
  });
}

export async function sendVerificationEmail(toEmail, username, verificationToken) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  const panelUrl = config.panel?.url || '';
  
  const verifyUrl = `${panelUrl}/auth/verify-email?token=${verificationToken}`;
  
  const content = `
    <p style="margin: 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
      Hi <strong style="color: #fafafa;">${username}</strong>,<br><br>
      Thank you for registering! Please click the button below to verify your email address.
    </p>
    ${emailButton('Verify Email', verifyUrl)}
    ${emailNote("This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.")}
  `;
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Verify Your Email`,
    html: emailTemplate(panelName, 'Verify Your Email', content, `${panelName} • This is an automated message`),
    text: `${panelName} - Verify Your Email\n\nHi ${username},\n\nThank you for registering! Please visit this link to verify your email address:\n\n${verifyUrl}\n\nThis link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.`
  });
}

export async function send2FACode(toEmail, username, code) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  
  const content = `
    <p style="margin: 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
      Hi <strong style="color: #fafafa;">${username}</strong>,<br><br>
      Your verification code is:
    </p>
    <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: #e07a3a; letter-spacing: 8px;">${code}</span>
    </div>
    <p style="margin: 0; color: #71717a; font-size: 13px;">
      This code expires in 5 minutes. If you didn't try to log in, someone may be attempting to access your account.
    </p>
  `;
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Verification Code: ${code}`,
    html: emailTemplate(panelName, 'Two-Factor Authentication', content, `${panelName} • Security verification`),
    text: `${panelName} - Verification Code\n\nHi ${username},\n\nYour verification code is: ${code}\n\nThis code expires in 5 minutes. If you didn't try to log in, someone may be attempting to access your account.`
  });
}

export async function verifyConnection() {
  const transport = getTransporter();
  if (!transport) {
    throw new Error('Mail not configured');
  }
  
  try {
    await transport.verify();
    return true;
  } catch (e) {
    throw new Error(`Connection failed: ${e.message}`);
  }
}
