import express from 'express'
import { query } from '../db/connection.js'
import { verifyTokenMiddleware } from '../utils/jwt.js'

const router = express.Router()

/**
 * Initialize location tracking tables if they don't exist
 */
const initializeLocationTables = async () => {
  try {
    // User contacts table - stores contacts that a user has added
    await query(`
      CREATE TABLE IF NOT EXISTS user_contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, contact_user_id)
      )
    `)
    console.log('✓ User contacts table initialized')

    // Location tracking table - stores real-time location data
    await query(`
      CREATE TABLE IF NOT EXISTS location_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Location tracking table initialized')

    // Create index for faster location queries
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_location_user_id ON location_tracking(user_id)')
    } catch (e) {
      // Index already exists
    }

    // Location alerts table - stores when a user sends an alert
    await query(`
      CREATE TABLE IF NOT EXISTS location_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        alert_status VARCHAR(50) DEFAULT 'active',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Location alerts table initialized')

    // Create index for faster alert queries
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_location_alerts_user_id ON location_alerts(user_id)')
    } catch (e) {
      // Index already exists
    }
  } catch (error) {
    console.error('Error initializing location tables:', error.message)
  }
}

// Initialize tables on route load
initializeLocationTables()

/**
 * POST /api/location/search-users
 * Search for users by name (first name or last name)
 */
router.post('/search-users', verifyTokenMiddleware, async (req, res) => {
  try {
    const { firstName, lastName } = req.body
    const { userId } = req.user

    if (!firstName && !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Name search is required',
      })
    }

    let query_sql = 'SELECT id, email, first_name, last_name FROM users WHERE id != $1'
    let params = [userId]
    let paramIndex = 2

    // If we have a single search term, search in both first_name and last_name with OR
    if (firstName && !lastName) {
      query_sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`
      params.push(`%${firstName}%`)
      paramIndex++
    } else if (lastName && !firstName) {
      // If only lastName is provided, search both fields with OR
      query_sql += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`
      params.push(`%${lastName}%`)
      paramIndex++
    } else if (firstName && lastName) {
      // If both provided, search first_name AND last_name (old behavior)
      query_sql += ` AND first_name ILIKE $${paramIndex} AND last_name ILIKE $${paramIndex + 1}`
      params.push(`%${firstName}%`, `%${lastName}%`)
      paramIndex += 2
    }

    query_sql += ' LIMIT 20'

    const result = await query(query_sql, params)

    res.status(200).json({
      success: true,
      users: result.rows,
    })
  } catch (error) {
    console.error('Search users error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
    })
  }
})

/**
 * POST /api/location/add-contact
 * Add a user as a contact
 */
router.post('/add-contact', verifyTokenMiddleware, async (req, res) => {
  try {
    const { contactUserId } = req.body
    const { userId } = req.user

    if (!contactUserId) {
      return res.status(400).json({
        success: false,
        error: 'Contact user ID is required',
      })
    }

    // Check if contact user exists
    const contactCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [contactUserId]
    )

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact user not found',
      })
    }

    // Add contact
    const result = await query(
      `INSERT INTO user_contacts (user_id, contact_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, contact_user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id, user_id, contact_user_id, created_at`,
      [userId, contactUserId]
    )

    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      contact: result.rows[0],
    })
  } catch (error) {
    console.error('Add contact error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to add contact',
    })
  }
})

/**
 * GET /api/location/contacts
 * Get all contacts for the current user
 */
router.get('/contacts', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    const result = await query(
      `SELECT 
        uc.id,
        uc.contact_user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_online,
        uc.created_at
      FROM user_contacts uc
      JOIN users u ON uc.contact_user_id = u.id
      WHERE uc.user_id = $1
      ORDER BY uc.created_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      contacts: result.rows,
    })
  } catch (error) {
    console.error('Get contacts error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts',
    })
  }
})

/**
 * DELETE /api/location/contacts/:contactId
 * Remove a contact
 */
router.delete('/contacts/:contactId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params
    const { userId } = req.user

    const result = await query(
      'DELETE FROM user_contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [contactId, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Contact removed successfully',
    })
  } catch (error) {
    console.error('Remove contact error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to remove contact',
    })
  }
})

/**
 * POST /api/location/send-alert
 * Send a location alert to a contact
 */
router.post('/send-alert', verifyTokenMiddleware, async (req, res) => {
  try {
    const { contactUserId, latitude, longitude } = req.body
    const { userId } = req.user

    if (!contactUserId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Contact user ID, latitude, and longitude are required',
      })
    }

    // Check if contact exists in user's contacts
    const contactCheck = await query(
      'SELECT id FROM user_contacts WHERE user_id = $1 AND contact_user_id = $2',
      [userId, contactUserId]
    )

    if (contactCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'This user is not in your contacts',
      })
    }

    // Deactivate any existing active alerts from this user to the contact
    await query(
      `UPDATE location_alerts 
       SET alert_status = 'inactive', ended_at = NOW() 
       WHERE user_id = $1 AND contact_user_id = $2 AND alert_status = 'active'`,
      [userId, contactUserId]
    )

    // Create new alert
    const alertResult = await query(
      `INSERT INTO location_alerts (user_id, contact_user_id, alert_status, started_at)
       VALUES ($1, $2, 'active', NOW())
       RETURNING id, user_id, contact_user_id, alert_status, started_at`,
      [userId, contactUserId]
    )

    // Update user's current location
    await query(
      `INSERT INTO location_tracking (user_id, latitude, longitude, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET 
         latitude = $2,
         longitude = $3,
         updated_at = NOW()`,
      [userId, latitude, longitude]
    )

    res.status(201).json({
      success: true,
      message: 'Alert sent successfully',
      alert: alertResult.rows[0],
    })
  } catch (error) {
    console.error('Send alert error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to send alert',
    })
  }
})

/**
 * POST /api/location/update-location
 * Update user's current location
 */
router.post('/update-location', verifyTokenMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body
    const { userId } = req.user

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      })
    }

    const result = await query(
      `INSERT INTO location_tracking (user_id, latitude, longitude, accuracy, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET 
         latitude = $2,
         longitude = $3,
         accuracy = $4,
         updated_at = NOW()
       RETURNING id, user_id, latitude, longitude, accuracy, updated_at`,
      [userId, latitude, longitude, accuracy || null]
    )

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      location: result.rows[0],
    })
  } catch (error) {
    console.error('Update location error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to update location',
    })
  }
})

/**
 * GET /api/location/contact-locations
 * Get real-time locations of contacts who have active alerts
 */
router.get('/contact-locations', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    const result = await query(
      `SELECT 
        la.id as alert_id,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        lt.latitude,
        lt.longitude,
        lt.accuracy,
        la.started_at,
        lt.updated_at as location_updated_at
      FROM location_alerts la
      JOIN users u ON la.user_id = u.id
      LEFT JOIN location_tracking lt ON la.user_id = lt.user_id
      WHERE la.contact_user_id = $1 AND la.alert_status = 'active'
      ORDER BY la.started_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      locations: result.rows,
    })
  } catch (error) {
    console.error('Get contact locations error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get contact locations',
    })
  }
})

/**
 * POST /api/location/stop-alert/:alertId
 * Stop/deactivate a location alert
 */
router.post('/stop-alert/:alertId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { alertId } = req.params
    const { userId } = req.user

    const result = await query(
      `UPDATE location_alerts 
       SET alert_status = 'inactive', ended_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING id, alert_status, ended_at`,
      [alertId, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Alert stopped successfully',
      alert: result.rows[0],
    })
  } catch (error) {
    console.error('Stop alert error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to stop alert',
    })
  }
})

export default router
