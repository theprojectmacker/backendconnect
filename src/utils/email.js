import nodemailer from 'nodemailer'

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
})

// Log email config on startup
if (process.env.EMAIL_USER) {
  console.log(`✓ Email configured with Gmail SMTP: ${process.env.EMAIL_USER}`)
} else {
  console.warn('⚠️  No email service configured - set EMAIL_USER and EMAIL_PASSWORD')
}

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
 * Send password reset email with Gmail SMTP
 */
export const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    const subject = '🔐 Password Reset Request - PWDE App'
    const html = generatePasswordResetEmail(resetCode, email)

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    }

    const sendMailPromise = transporter.sendMail(mailOptions)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timeout (10s)')), 10000)
    )

    const info = await Promise.race([sendMailPromise, timeoutPromise])
    console.log(`✓ Password reset email sent to ${email}. Message ID: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error(`✗ Failed to send password reset email to ${email}`)
    console.error(`   Error: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * Generate job application confirmation email HTML
 */
const generateJobApplicationEmail = (userName, jobTitle, companyName) => {
  const appName = 'PWDE App'

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Received</title>
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
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            .success-badge {
                display: inline-block;
                background-color: #10b981;
                color: white;
                padding: 10px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .job-details {
                background-color: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 20px;
                margin: 25px 0;
                border-radius: 4px;
            }
            .job-details-item {
                margin-bottom: 12px;
                font-size: 14px;
            }
            .job-details-label {
                color: #888;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: block;
                margin-bottom: 4px;
            }
            .job-details-value {
                color: #333;
                font-weight: 500;
                font-size: 15px;
            }
            .timeline-section {
                background-color: #f0f4ff;
                border: 1px solid #e0e7ff;
                padding: 20px;
                margin: 25px 0;
                border-radius: 6px;
            }
            .timeline-title {
                font-size: 14px;
                font-weight: 600;
                color: #667eea;
                margin-bottom: 15px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .timeline-item {
                display: flex;
                align-items: flex-start;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(102, 126, 234, 0.2);
            }
            .timeline-item:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .timeline-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                background-color: #667eea;
                color: white;
                border-radius: 50%;
                font-size: 14px;
                margin-right: 12px;
                flex-shrink: 0;
            }
            .timeline-content {
                flex: 1;
            }
            .timeline-label {
                font-size: 12px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .timeline-text {
                font-size: 14px;
                color: #333;
                font-weight: 500;
                margin-top: 2px;
            }
            .next-steps {
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                font-size: 14px;
                color: #856404;
            }
            .next-steps-title {
                font-weight: 600;
                margin-bottom: 8px;
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
                color: #667eea;
                text-decoration: none;
                margin: 0 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h1>🎉 Application Received!</h1>
                <p>Thank you for applying</p>
            </div>

            <!-- Content -->
            <div class="content">
                <div class="success-badge">✓ Application Submitted</div>

                <p>Hello ${userName},</p>

                <p>Thank you for your interest in the position! We have successfully received your application and appreciate you taking the time to apply.</p>

                <!-- Job Details -->
                <div class="job-details">
                    <div class="job-details-item">
                        <span class="job-details-label">Position Applied For</span>
                        <span class="job-details-value">${jobTitle}</span>
                    </div>
                    <div class="job-details-item">
                        <span class="job-details-label">Company</span>
                        <span class="job-details-value">${companyName || 'N/A'}</span>
                    </div>
                    <div class="job-details-item">
                        <span class="job-details-label">Application Date</span>
                        <span class="job-details-value">${new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                <!-- Timeline -->
                <div class="timeline-section">
                    <div class="timeline-title">What Happens Next?</div>
                    <div class="timeline-item">
                        <div class="timeline-icon">1</div>
                        <div class="timeline-content">
                            <div class="timeline-label">Review Phase</div>
                            <div class="timeline-text">Our hiring team will carefully review your application and qualifications.</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-icon">2</div>
                        <div class="timeline-content">
                            <div class="timeline-label">Selection</div>
                            <div class="timeline-text">If your profile matches the requirements, we will invite you for the next stage.</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-icon">3</div>
                        <div class="timeline-content">
                            <div class="timeline-label">Interview</div>
                            <div class="timeline-text">Shortlisted candidates will be contacted for interviews or assessments.</div>
                        </div>
                    </div>
                </div>

                <!-- Next Steps -->
                <div class="next-steps">
                    <div class="next-steps-title">📋 Please Note</div>
                    <p>We receive many applications and will review each one carefully. We will get back to you once we have reviewed your details. This may take a few days or weeks depending on the volume of applications.</p>
                </div>

                <p>If you have any questions in the meantime, please feel free to contact us. We wish you the best of luck!</p>

                <p>Best regards,<br><strong>${appName} Hiring Team</strong></p>
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
 * Send job application confirmation email with Gmail SMTP
 */
export const sendJobApplicationEmail = async (email, userName, jobTitle, companyName) => {
  try {
    const subject = `🎉 Application Received for ${jobTitle} - ${companyName || 'PWDE App'}`
    const html = generateJobApplicationEmail(userName, jobTitle, companyName)

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    }

    const sendMailPromise = transporter.sendMail(mailOptions)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timeout (10s)')), 10000)
    )

    const info = await Promise.race([sendMailPromise, timeoutPromise])
    console.log(`✓ Job application email sent to ${email}. Message ID: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error(`✗ Failed to send job application email to ${email}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Verify Gmail SMTP email configuration
 */
export const verifyEmailConfig = async () => {
  try {
    console.log('🔄 Verifying email configuration...')
    console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Not set'}`)
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Not set'}`)

    await transporter.verify()
    console.log('✓ Gmail SMTP email service is configured correctly')
    return true
  } catch (error) {
    console.error('✗ Email service configuration error:', error.code || '', error.message)
    console.error('   Hint: Set EMAIL_USER and EMAIL_PASSWORD for Gmail SMTP.')
    return false
  }
}
