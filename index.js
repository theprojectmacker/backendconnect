import app from './src/server.js'
import { testConnection, closePool } from './src/db/connection.js'
import { getEnv, validateEnv, logEnv } from './src/utils/env.js'
import { verifyEmailConfig } from './src/utils/email.js'

// Validate environment variables
const validation = validateEnv()
if (!validation.valid) {
  console.error('❌ Environment validation failed:')
  validation.errors.forEach(err => console.error(`   - ${err}`))
  process.exit(1)
}

// Log configuration
logEnv()

// Get environment variables
const { PORT, NODE_ENV } = getEnv()

// Start server
const startServer = async () => {
  try {
    // Test database connection on startup
    console.log('🔄 Testing database connection...')
    const isConnected = await testConnection()

    if (!isConnected) {
      console.warn('⚠️  Database connection failed, but server will continue')
    }

    // Verify email configuration
    console.log('🔄 Verifying email configuration...')
    const emailConfigured = await verifyEmailConfig()

    if (!emailConfigured) {
      console.warn('⚠️  Email service not configured. Password reset emails will not be sent.')
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`)
      console.log(`📦 Environment: ${NODE_ENV}`)
      console.log(`📚 API docs: http://localhost:${PORT}/api\n`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...')
  await closePool()
  process.exit(0)
})

// Start the server
startServer()
