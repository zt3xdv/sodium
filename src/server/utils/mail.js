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

export async function sendTestEmail(toEmail) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Test Email`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #141414; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${panelName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Test Email Successful!</h2>
                    <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                      If you're reading this, your email configuration is working correctly. 
                      You can now use email features like password resets and notifications.
                    </p>
                    <div style="background-color: #1a1a1a; border-radius: 8px; padding: 16px; border-left: 4px solid #6366f1;">
                      <p style="margin: 0; color: #71717a; font-size: 12px;">
                        <strong style="color: #ffffff;">Configuration:</strong><br>
                        Host: ${config.mail?.host || 'Not set'}<br>
                        Port: ${config.mail?.port || '587'}<br>
                        Secure: ${config.mail?.secure ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px; background-color: #0f0f0f; text-align: center;">
                    <p style="margin: 0; color: #52525b; font-size: 12px;">
                      This is an automated test email from ${panelName}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${panelName} - Test Email\n\nIf you're reading this, your email configuration is working correctly.`
  });
}

export async function sendPasswordReset(toEmail, username, resetToken, resetUrl) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  const panelUrl = config.panel?.url || resetUrl.split('/auth')[0];
  
  const fullResetUrl = `${panelUrl}/auth/reset-password?token=${resetToken}`;
  
  return sendMail({
    to: toEmail,
    subject: `${panelName} - Password Reset`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #141414; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${panelName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Password Reset Request</h2>
                    <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                      Hi <strong style="color: #ffffff;">${username}</strong>,<br><br>
                      We received a request to reset your password. Click the button below to create a new password.
                    </p>
                    <a href="${fullResetUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Reset Password
                    </a>
                    <p style="margin: 24px 0 0; color: #71717a; font-size: 12px;">
                      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px; background-color: #0f0f0f; text-align: center;">
                    <p style="margin: 0; color: #52525b; font-size: 12px;">
                      ${panelName} • This is an automated message
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${panelName} - Password Reset\n\nHi ${username},\n\nWe received a request to reset your password. Visit this link to create a new password:\n\n${fullResetUrl}\n\nThis link will expire in 1 hour. If you didn't request this, you can safely ignore this email.`
  });
}

export async function sendWelcomeEmail(toEmail, username) {
  const config = loadConfig();
  const panelName = config.panel?.name || 'Sodium Panel';
  const panelUrl = config.panel?.url || '';
  
  return sendMail({
    to: toEmail,
    subject: `Welcome to ${panelName}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #141414; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${panelName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px;">Welcome, ${username}!</h2>
                    <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                      Your account has been created successfully. You can now log in and start managing your game servers.
                    </p>
                    ${panelUrl ? `
                    <a href="${panelUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Go to Panel
                    </a>
                    ` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px; background-color: #0f0f0f; text-align: center;">
                    <p style="margin: 0; color: #52525b; font-size: 12px;">
                      ${panelName} • Thank you for joining us
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Welcome to ${panelName}!\n\nHi ${username},\n\nYour account has been created successfully. You can now log in and start managing your game servers.${panelUrl ? `\n\nVisit: ${panelUrl}` : ''}`
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
