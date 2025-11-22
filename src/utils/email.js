import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

/**
 * Generate professional password reset email HTML
 */
const generatePasswordResetEmail = (resetCode, recipientEmail) => {
  const appName = 'PWDE App'
  const resetLink = `https://yourdomain.com/reset-password?code=${resetCode}&email=${encodeURIComponent(recipientEmail)}`

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background-color: #f5f5f5;
                color: #333;
                line-height: 1.6;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
                color: white;
                padding: 40px 20px;
                text-align: center;
            }
            .header h1 {
                font-size: 28px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .header p {
                font-size: 14px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .content p {
                margin-bottom: 20px;
                font-size: 15px;
                color: #555;
            }
            .reset-code-section {
                background-color: #f8f9fa;
                border-left: 4px solid #1e88e5;
                padding: 25px;
                margin: 30px 0;
                border-radius: 4px;
                text-align: center;
            }
            .reset-code-label {
                font-size: 13px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 12px;
                display: block;
            }
            .reset-code {
                font-size: 32px;
                font-weight: 700;
                color: #1e88e5;
                font-family: 'Courier New', monospace;
                letter-spacing: 4px;
                word-break: break-all;
            }
            .code-note {
                font-size: 12px;
                color: #999;
                margin-top: 15px;
            }
            .button-section {
                margin: 30px 0;
                text-align: center;
            }
            .reset-button {
                display: inline-block;
                background-color: #1e88e5;
                color: white;
                padding: 14px 40px;
                text-decoration: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                transition: background-color 0.3s ease;
            }
            .reset-button:hover {
                background-color: #1565c0;
            }
            .warning {
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                color: #856404;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                font-size: 13px;
            }
            .warning-title {
                font-weight: 600;
                margin-bottom: 5px;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
                font-size: 12px;
                color: #888;
            }
            .footer-links {
                margin-top: 15px;
            }
            .footer-links a {
                color: #1e88e5;
                text-decoration: none;
                margin: 0 10px;
            }
            .divider {
                height: 1px;
                background-color: #e9ecef;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h1>${appName}</h1>
                <p>Password Reset Request</p>
            </div>

            <!-- Content -->
            <div class="content">
                <p>Hello,</p>

                <p>We received a request to reset the password for your ${appName} account. If you didn't make this request, you can ignore this email.</p>

                <!-- Reset Code Section -->
                <div class="reset-code-section">
                    <span class="reset-code-label">Your Reset Code</span>
                    <div class="reset-code">${resetCode}</div>
                    <div class="code-note">This code expires in 1 hour</div>
                </div>

                <p>Enter this code in the password reset form to create a new password. Make sure to keep this code confidential.</p>

                <!-- Warning -->
                <div class="warning">
                    <div class="warning-title">⚠️ Security Notice</div>
                    <p>If you didn't request a password reset, your account may be at risk. Please change your password immediately if you notice any unusual activity.</p>
                </div>

                <p style="margin-top: 30px;">Need help? Contact our support team for assistance.</p>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                <p style="margin-top: 10px; color: #999;">This is an automated email, please do not reply directly.</p>
                <div class="footer-links">
                    <a href="https://yourdomain.com">Visit Website</a>
                    <a href="https://yourdomain.com/privacy">Privacy Policy</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: '🔐 Password Reset Request - PWDE App',
      html: generatePasswordResetEmail(resetCode, email),
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`✓ Password reset email sent to ${email}. Message ID: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error(`✗ Failed to send password reset email to ${email}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Verify email configuration
 */
export const verifyEmailConfig = async () => {
  try {
    await transporter.verify()
    console.log('✓ Email service is configured correctly')
    return true
  } catch (error) {
    console.error('✗ Email service configuration error:', error.message)
    return false
  }
}
