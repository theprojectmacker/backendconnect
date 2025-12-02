import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db/connection.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import { generateTokens, verifyRefreshToken, verifyTokenMiddleware } from '../utils/jwt.js'

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
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        date_of_birth DATE,
        country VARCHAR(255),
        state VARCHAR(255),
        city VARCHAR(255),
        street VARCHAR(255),
        house_number VARCHAR(50),
        is_online BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Users table initialized')

    // Add columns if they don't exist (for existing databases)
    try {
      await query('ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT FALSE')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN first_name VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN last_name VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN date_of_birth DATE')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN country VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN state VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN city VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN street VARCHAR(255)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE users ADD COLUMN house_number VARCHAR(50)')
    } catch (e) {
      // Column already exists
    }

    // Create default admin user if it doesn't exist
    try {
      const adminExists = await query(
        "SELECT id FROM users WHERE email = 'admin@example.com'"
      )
      if (adminExists.rows.length === 0) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash('admin123', salt)
        await query(
          'INSERT INTO users (email, password_hash, is_admin, is_online) VALUES ($1, $2, TRUE, FALSE)',
          ['admin@example.com', passwordHash]
        )
        console.log('✓ Default admin user created: admin@example.com / admin123')
      }
    } catch (error) {
      console.error('Error creating default admin user:', error.message)
    }
  } catch (error) {
    console.error('Error initializing users table:', error.message)
  }
}

/**
 * Initialize secret admin accounts table
 */
const initializeAdminAccountsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Admin accounts table initialized')

    // Create first admin account if it doesn't exist
    try {
      const adminExists = await query(
        "SELECT id FROM admin_accounts WHERE email = 'freefall@gmail.com'"
      )
      if (adminExists.rows.length === 0) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash('freezeme21', salt)
        await query(
          'INSERT INTO admin_accounts (email, password_hash, is_active) VALUES ($1, $2, TRUE)',
          ['freefall@gmail.com', passwordHash]
        )
        console.log('✓ Secret admin account created: freefall@gmail.com / freezeme21')
      }
    } catch (error) {
      console.error('Error creating first admin account:', error.message)
    }

    // Create second admin account if it doesn't exist
    try {
      const secondAdminExists = await query(
        "SELECT id FROM admin_accounts WHERE email = 'adminking21@gmail.com'"
      )
      if (secondAdminExists.rows.length === 0) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash('adminisking2', salt)
        await query(
          'INSERT INTO admin_accounts (email, password_hash, is_active) VALUES ($1, $2, TRUE)',
          ['adminking21@gmail.com', passwordHash]
        )
        console.log('✓ Secret admin account created: adminking21@gmail.com / adminisking2')
      }
    } catch (error) {
      console.error('Error creating second admin account:', error.message)
    }
  } catch (error) {
    console.error('Error initializing admin accounts table:', error.message)
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

/**
 * Initialize modules table if it doesn't exist
 */
const initializeModulesTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        file_type VARCHAR(100),
        public_url TEXT,
        admin_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Modules table initialized')

    // Make admin_id nullable if it exists but is not null
    try {
      await query(`
        ALTER TABLE modules ALTER COLUMN admin_id DROP NOT NULL
      `)
    } catch (e) {
      // Column already nullable or doesn't exist
    }
  } catch (error) {
    console.error('Error initializing modules table:', error.message)
  }
}

// Initialize tables on route load
initializeUsersTable()
initializePasswordResetTable()
initializeAdminAccountsTable()
initializeModulesTable()

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
    const {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      country,
      state,
      city,
      street,
      houseNumber,
    } = req.body

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

    // Insert user with profile information
    const result = await query(
      `INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        date_of_birth,
        country,
        state,
        city,
        street,
        house_number,
        is_online,
        is_admin,
        last_seen
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, FALSE, NOW())
      RETURNING id, email, first_name, last_name, date_of_birth, country, state, city, street, house_number, is_online, is_admin, last_seen, created_at`,
      [
        email,
        passwordHash,
        firstName || null,
        lastName || null,
        dateOfBirth || null,
        country || null,
        state || null,
        city || null,
        street || null,
        houseNumber || null,
      ]
    )

    const user = result.rows[0]

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email)

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
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
 * POST /api/auth/admin/login
 * Secret admin login (freefall@gmail.com only)
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      })
    }

    // Find admin account
    const result = await query('SELECT id, email, password_hash FROM admin_accounts WHERE email = $1 AND is_active = TRUE', [email])

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials',
      })
    }

    const admin = result.rows[0]

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials',
      })
    }

    // Generate JWT tokens with admin flag
    const { accessToken, refreshToken } = generateTokens(admin.id, admin.email)

    // Return success with tokens
    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      user: {
        id: admin.id,
        email: admin.email,
        is_admin: true,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    })
  } catch (error) {
    console.error('Admin login error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Admin login failed',
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
    const result = await query('SELECT id, email, password_hash, is_admin FROM users WHERE email = $1', [email])

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

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email)

    // Update user online status
    await query(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1',
      [user.id]
    )

    // Return success with tokens
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
      },
      tokens: {
        accessToken,
        refreshToken,
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

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      })
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      })
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId, decoded.email)

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      tokens,
    })
  } catch (error) {
    console.error('Token refresh error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    })
  }
})

/**
 * GET /api/auth/verify
 * Verify access token and get user info (supports both regular users and admin accounts)
 */
router.get('/verify', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId, email } = req.user

    // Try to get user from users table first
    const userResult = await query('SELECT id, email, is_online, is_admin, last_seen, created_at FROM users WHERE id = $1', [userId])

    if (userResult.rows.length > 0) {
      return res.status(200).json({
        success: true,
        user: userResult.rows[0],
      })
    }

    // If not found in users table, check admin_accounts table (for admin logins)
    const adminResult = await query('SELECT id, email, is_active FROM admin_accounts WHERE id = $1 AND email = $2', [userId, email])

    if (adminResult.rows.length > 0) {
      return res.status(200).json({
        success: true,
        user: {
          id: adminResult.rows[0].id,
          email: adminResult.rows[0].email,
          is_online: true,
          is_admin: true,
          created_at: new Date().toISOString(),
        },
      })
    }

    // User not found in either table
    return res.status(404).json({
      success: false,
      error: 'User not found',
    })
  } catch (error) {
    console.error('Token verify error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to verify token',
    })
  }
})

/**
 * POST /api/auth/logout
 * Logout user and set offline status
 */
router.post('/logout', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    // Update user offline status
    await query(
      'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = $1',
      [userId]
    )

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    })
  } catch (error) {
    console.error('Logout error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to logout',
    })
  }
})

/**
 * POST /api/auth/update-status
 * Update user online status (heartbeat/keep-alive)
 */
router.post('/update-status', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    // Update last seen timestamp (keep user online)
    const result = await query(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1 RETURNING id, email, is_online, last_seen',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Update status error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
    })
  }
})

/**
 * GET /api/auth/user-status/:userId
 * Get user online status
 */
router.get('/user-status/:userId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.params

    const result = await query(
      'SELECT id, email, is_online, last_seen FROM users WHERE id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Get user status error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get user status',
    })
  }
})

/**
 * POST /api/auth/users-status
 * Get multiple users' online status
 */
router.post('/users-status', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userIds } = req.body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required',
      })
    }

    // Create placeholders for query
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',')

    const result = await query(
      `SELECT id, email, is_online, last_seen FROM users WHERE id IN (${placeholders})`,
      userIds
    )

    res.status(200).json({
      success: true,
      users: result.rows,
    })
  } catch (error) {
    console.error('Get users status error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get users status',
    })
  }
})

/**
 * POST /api/auth/make-admin/:userId
 * Make a user an admin (admin only)
 */
router.post('/make-admin/:userId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId: requestingUserId } = req.user
    const { userId } = req.params

    // Check if requesting user is admin
    const adminCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1',
      [requestingUserId]
    )

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can grant admin privileges',
      })
    }

    // Make user admin
    const result = await query(
      'UPDATE users SET is_admin = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_admin',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'User promoted to admin',
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Make admin error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to grant admin privileges',
    })
  }
})

/**
 * POST /api/auth/remove-admin/:userId
 * Remove admin privileges from a user (admin only)
 */
router.post('/remove-admin/:userId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId: requestingUserId } = req.user
    const { userId } = req.params

    // Check if requesting user is admin
    const adminCheck = await query(
      'SELECT is_admin FROM users WHERE id = $1',
      [requestingUserId]
    )

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can revoke admin privileges',
      })
    }

    // Prevent removing the last admin
    const adminCountResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE'
    )

    if (adminCountResult.rows[0].count <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove the last admin user',
      })
    }

    // Remove admin from user
    const result = await query(
      'UPDATE users SET is_admin = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_admin',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Admin privileges removed',
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Remove admin error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to revoke admin privileges',
    })
  }
})

/**
 * GET /api/auth/current-user
 * Get current user info with admin status (supports both regular users and admin accounts)
 */
router.get('/current-user', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId, email } = req.user

    // Try to get user from users table first
    const userResult = await query(
      'SELECT id, email, is_online, is_admin, last_seen, created_at FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length > 0) {
      return res.status(200).json({
        success: true,
        user: userResult.rows[0],
      })
    }

    // If not found in users table, check admin_accounts table (for admin logins)
    const adminResult = await query('SELECT id, email, is_active FROM admin_accounts WHERE id = $1 AND email = $2', [userId, email])

    if (adminResult.rows.length > 0) {
      return res.status(200).json({
        success: true,
        user: {
          id: adminResult.rows[0].id,
          email: adminResult.rows[0].email,
          is_online: true,
          is_admin: true,
          created_at: new Date().toISOString(),
        },
      })
    }

    // User not found in either table
    return res.status(404).json({
      success: false,
      error: 'User not found',
    })
  } catch (error) {
    console.error('Get current user error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
    })
  }
})

/**
 * GET /api/auth/profile
 * Get full user profile with all personal details
 */
router.get('/profile', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    const result = await query(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        date_of_birth,
        country,
        state,
        city,
        street,
        house_number,
        is_online,
        is_admin,
        last_seen,
        created_at,
        updated_at
       FROM users WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = result.rows[0]
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        country: user.country,
        state: user.state,
        city: user.city,
        street: user.street,
        houseNumber: user.house_number,
        isOnline: user.is_online,
        isAdmin: user.is_admin,
        lastSeen: user.last_seen,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    })
  } catch (error) {
    console.error('Get profile error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    })
  }
})

export default router
