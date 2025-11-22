import pg from 'pg'
import { config } from 'dotenv'

config()

const { Pool } = pg

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

/**
 * Test database connection
 * @returns {Promise<boolean>} - Returns true if connected, false otherwise
 */
export const testConnection = async () => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    client.release()
    console.log('✓ Database connection successful at:', result.rows[0].now)
    return true
  } catch (error) {
    console.error('✗ Database connection failed:', error.message)
    return false
  }
}

/**
 * Query the database
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
export const query = async (sql, params) => {
  try {
    const result = await pool.query(sql, params)
    return result
  } catch (error) {
    console.error('Query error:', error.message)
    throw error
  }
}

/**
 * Get connection status
 * @returns {Promise<Object>} - Connection status details
 */
export const getConnectionStatus = async () => {
  try {
    const client = await pool.connect()
    const result = await client.query(`
      SELECT 
        version() as postgres_version,
        current_database() as database_name,
        current_user as connected_user,
        NOW() as current_time
    `)
    client.release()
    return {
      connected: true,
      ...result.rows[0],
    }
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    }
  }
}

/**
 * Close the connection pool
 */
export const closePool = async () => {
  try {
    await pool.end()
    console.log('Database pool closed')
  } catch (error) {
    console.error('Error closing pool:', error)
  }
}

export default pool
