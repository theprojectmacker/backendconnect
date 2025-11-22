import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db/connection.js'
import { sendPasswordResetEmail } from '../utils/email.js'

const router = express.Router()

/**
 * Initialize users table if it doesn't exist
 */
const initializeUsersTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Users table initialized')
  } catch (error) {
    console.error('Error initializing users table:', error.message)
  }
}

/**
 * Initialize password reset tokens table if it doesn't exist
 */
const initializePasswordResetTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        reset_code VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Password reset tokens table initialized')
  } catch (error) {
    console.error('Error initializing password reset table:', error.message)
  }
}

// Initialize tables on route load
initializeUsersTable()
initializePasswordResetTable()

/**
 * Generate a random reset code
 */
const generateResetCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * POST /api/auth/check-email
 * Check if email already exists
 */
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    const result = await query('SELECT id FROM users WHERE email = $1', [email])

    res.status(200).json({
      success: true,
      exists: result.rows.length > 0,
      email: email,
    })
  } catch (error) {
    console.error('Check email error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to check email',
    })
  }
})

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      })
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    // Insert user
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    )

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Register error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    })
  }
})

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      })
    }

    // Find user
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email])

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      })
    }

    const user = result.rows[0]

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      })
    }

    // Return success (without password hash)
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Login failed',
    })
  }
})

/**
 * POST /api/auth/forgot-password
 * Request password reset code
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    // Check if user exists
    const result = await query('SELECT id FROM users WHERE email = $1', [email])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
      })
    }

    // Generate reset code
    const resetCode = generateResetCode()

    // Set expiration time to 1 hour from now
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Store reset token
    await query(
      'INSERT INTO password_reset_tokens (email, reset_code, expires_at) VALUES ($1, $2, $3)',
      [email, resetCode, expiresAt]
    )

    // Send reset code via email
    const emailResult = await sendPasswordResetEmail(email, resetCode)

    if (!emailResult.success) {
      console.warn(`Warning: Failed to send email to ${email}, but token was stored`)
    }

    res.status(200).json({
      success: true,
      message: 'Reset code sent to email',
    })
  } catch (error) {
    console.error('Forgot password error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
    })
  }
})

/**
 * POST /api/auth/reset-password
 * Reset password with code
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body

    // Validation
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, reset code, and new password are required',
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      })
    }

    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email])

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
      })
    }

    // Check if reset code is valid and not expired
    const tokenResult = await query(
      'SELECT id FROM password_reset_tokens WHERE email = $1 AND reset_code = $2 AND expires_at > NOW()',
      [email, resetCode]
    )

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset code',
      })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(newPassword, salt)

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [newPasswordHash, email]
    )

    // Delete used reset token
    await query(
      'DELETE FROM password_reset_tokens WHERE email = $1 AND reset_code = $2',
      [email, resetCode]
    )

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    })
  }
})

export default router
