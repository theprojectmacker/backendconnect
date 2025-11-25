import { config } from 'dotenv'

config()

/**
 * Get environment variables with defaults
 */
export const getEnv = () => {
  const port = process.env.PORT || process.env.APP_PORT || 5000

  return {
    PORT: Number(port),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL,
  }
}


/**
 * Validate required environment variables
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export const validateEnv = () => {
  const env = getEnv()
  const errors = []

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is not defined in .env')
  }

  return {
    valid: errors.length === 0,
    errors,
    env,
  }
}

/**
 * Log environment configuration (safe, no secrets)
 */
export const logEnv = () => {
  const env = getEnv()
  console.log('\n📋 Environment Configuration:')
  console.log(`   PORT: ${env.PORT}`)
  console.log(`   NODE_ENV: ${env.NODE_ENV}`)
  console.log(`   DATABASE_URL: ${env.DATABASE_URL ? '***' : 'NOT SET'}\n`)
}
