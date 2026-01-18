import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Create transporter with Gmail
// For production, use environment variables for credentials
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use App Password for Gmail
    },
  });
};

// Generate reset token
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash the token for storage
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, displayName) => {
  const transporter = createTransporter();
  
  // Create reset URL (frontend should handle this route)
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: {
      name: 'MonoPay',
      address: process.env.EMAIL_USER,
    },
    to: email,
    subject: '🎲 MonoPay - Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #d4a574 0%, #c99a69 100%); padding: 30px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header span { color: rgba(255,255,255,0.9); font-size: 14px; }
          .content { padding: 30px 20px; }
          .greeting { font-size: 18px; color: #2d2d3a; margin-bottom: 20px; }
          .message { color: #5a5a6e; line-height: 1.6; margin-bottom: 25px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #d4a574 0%, #c99a69 100%); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; }
          .btn:hover { opacity: 0.9; }
          .note { background: #fff8f0; border-left: 4px solid #d4a574; padding: 12px 16px; margin: 25px 0; font-size: 13px; color: #5a5a6e; }
          .footer { background: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #9898a8; border-top: 1px solid #f0f0f2; }
          .divider { height: 1px; background: #f0f0f2; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎩 MonoPay</h1>
            <span>Digital Monopoly Banking</span>
          </div>
          <div class="content">
            <p class="greeting">Hi ${displayName || 'there'},</p>
            <p class="message">
              We received a request to reset your MonoPay password. Click the button below to create a new password:
            </p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="btn">Reset Password</a>
            </p>
            <div class="note">
              ⏰ This link expires in 1 hour for security reasons.<br>
              If you didn't request this, you can safely ignore this email.
            </div>
            <div class="divider"></div>
            <p style="font-size: 12px; color: #9898a8; text-align: center;">
              Having trouble with the button? Copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #d4a574; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} MonoPay. All rights reserved.<br>
            This is an automated message, please do not reply.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${displayName || 'there'},
      
      We received a request to reset your MonoPay password.
      
      Click this link to reset your password: ${resetUrl}
      
      This link expires in 1 hour.
      
      If you didn't request this, you can safely ignore this email.
      
      - The MonoPay Team
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send email');
  }
};

export default {
  generateResetToken,
  hashToken,
  sendPasswordResetEmail,
};
