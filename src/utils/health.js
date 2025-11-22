import { getConnectionStatus } from '../db/connection.js'

/**
 * Get overall system health status
 * @returns {Promise<Object>} - Health status
 */
export const getHealthStatus = async () => {
  const dbStatus = await getConnectionStatus()

  return {
    status: dbStatus.connected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: process.uptime(),
  }
}

/**
 * Quick health check (true/false)
 * @returns {Promise<boolean>}
 */
export const isHealthy = async () => {
  const health = await getHealthStatus()
  return health.status === 'healthy'
}
