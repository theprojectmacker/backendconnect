import express from 'express'
import cors from 'cors'
import { testConnection, getConnectionStatus } from './db/connection.js'
import { getHealthStatus } from './utils/health.js'
import { verifyEmailConfig } from './utils/email.js'
import authRoutes from './routes/auth.js'

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)

// Routes

/**
 * Health check endpoint
 * Returns overall system health including database status
 */
app.get('/api/health', async (req, res) => {
  try {
    const health = await getHealthStatus()
    const statusCode = health.status === 'healthy' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    })
  }
})

/**
 * Database connection status endpoint
 * Provides detailed database connection information
 */
app.get('/api/db/status', async (req, res) => {
  try {
    const status = await getConnectionStatus()
    const statusCode = status.connected ? 200 : 503
    res.status(statusCode).json(status)
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message,
    })
  }
})

/**
 * Test database connection endpoint
 */
app.post('/api/db/test', async (req, res) => {
  try {
    const connected = await testConnection()
    res.status(connected ? 200 : 503).json({
      success: connected,
      message: connected ? 'Connected to database' : 'Failed to connect to database',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * Welcome endpoint
 */
app.get('/api', (req, res) => {
  res.json({
    message: 'Admin Dashboard API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      dbStatus: '/api/db/status',
      dbTest: '/api/db/test (POST)',
    },
  })
})

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  })
})

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

export default app
