import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailData {
  email: string;
  resetToken: string;
  userName?: string;
}

class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;
  private fromName: string;
  private resetUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }

    this.fromEmail = process.env.EMAIL_FROM || 'noreply@reporadar.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'RepoRadar';
    this.resetUrl = process.env.PASSWORD_RESET_URL || 'http://localhost:5000/reset-password';
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.resend) {
      console.error('Email service not configured. Set RESEND_API_KEY environment variable.');
      return false;
    }

    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    const resetLink = `${this.resetUrl}?token=${data.resetToken}`;
    const userName = data.userName || 'there';

    const html = this.getPasswordResetTemplate(userName, resetLink);
    const text = this.getPasswordResetTextTemplate(userName, resetLink);

    return this.sendEmail({
      to: data.email,
      subject: 'Reset Your RepoRadar Password',
      html,
      text,
    });
  }

  /**
   * HTML template for password reset email
   */
  private getPasswordResetTemplate(userName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #FF6B35;
      margin: 0;
      font-size: 28px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #FF6B35;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #E55A2B;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #666;
    }
    .warning {
      background-color: #FFF3CD;
      border-left: 4px solid #FFC107;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .link {
      word-break: break-all;
      color: #FF6B35;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🔍 RepoRadar</h1>
    </div>
    
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password for your RepoRadar account. Click the button below to create a new password:</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${resetLink}</p>
      
      <div class="warning">
        <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
      </div>
      
      <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>The RepoRadar Team</p>
      <p style="font-size: 12px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Plain text template for password reset email
   */
  private getPasswordResetTextTemplate(userName: string, resetLink: string): string {
    return `
Reset Your Password

Hi ${userName},

We received a request to reset your password for your RepoRadar account.

Click the link below to create a new password:
${resetLink}

IMPORTANT: This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The RepoRadar Team

---
This is an automated email. Please do not reply to this message.
    `.trim();
  }

  /**
   * Send password change confirmation email
   */
  async sendPasswordChangedEmail(email: string, userName?: string): Promise<boolean> {
    const name = userName || 'there';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #FF6B35;
      margin: 0;
      font-size: 28px;
    }
    .success {
      background-color: #D4EDDA;
      border-left: 4px solid #28A745;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🔍 RepoRadar</h1>
    </div>
    
    <div class="content">
      <h2>Password Changed Successfully</h2>
      <p>Hi ${name},</p>
      
      <div class="success">
        <strong>✓ Success:</strong> Your password has been changed successfully.
      </div>
      
      <p>If you didn't make this change, please contact our support team immediately.</p>
    </div>
    
    <div class="footer">
      <p>Best regards,<br>The RepoRadar Team</p>
      <p style="font-size: 12px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Password Changed Successfully

Hi ${name},

Your password has been changed successfully.

If you didn't make this change, please contact our support team immediately.

Best regards,
The RepoRadar Team

---
This is an automated email. Please do not reply to this message.
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Your RepoRadar Password Has Been Changed',
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
