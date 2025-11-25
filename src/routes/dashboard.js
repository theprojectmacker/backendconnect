import express from 'express'
import { query } from '../db/connection.js'
import { verifyTokenMiddleware } from '../utils/jwt.js'

const router = express.Router()

/**
 * GET /api/dashboard/users
 * Get all users with their status (for display in admin dashboard)
 */
router.get('/users', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        id,
        email,
        is_online,
        last_seen,
        created_at,
        updated_at,
        is_admin,
        first_name,
        last_name,
        date_of_birth,
        country,
        state,
        city,
        street,
        house_number
       FROM users
       ORDER BY created_at DESC`
    )

    res.status(200).json({
      success: true,
      users: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error('Get users error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get users',
    })
  }
})

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats', verifyTokenMiddleware, async (req, res) => {
  try {
    // Total users count
    const totalUsersResult = await query('SELECT COUNT(*) as count FROM users')
    const totalUsers = totalUsersResult.rows[0]?.count || 0

    // Online users count
    const onlineUsersResult = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_online = TRUE'
    )
    const onlineUsers = onlineUsersResult.rows[0]?.count || 0

    // Total conversations
    const totalConversationsResult = await query(
      'SELECT COUNT(*) as count FROM conversations'
    )
    const totalConversations = totalConversationsResult.rows[0]?.count || 0

    // Total messages
    const totalMessagesResult = await query(
      'SELECT COUNT(*) as count FROM messages'
    )
    const totalMessages = totalMessagesResult.rows[0]?.count || 0

    // Recent users (last 7 days)
    const recentUsersResult = await query(
      `SELECT COUNT(*) as count FROM users 
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    )
    const recentUsers = recentUsersResult.rows[0]?.count || 0

    // Recent messages (last 24 hours)
    const recentMessagesResult = await query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    )
    const recentMessages = recentMessagesResult.rows[0]?.count || 0

    // User growth data (last 30 days)
    const userGrowthResult = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    )

    // Message activity data (last 30 days)
    const messageActivityResult = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM messages
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    )

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        onlineUsers,
        offlineUsers: totalUsers - onlineUsers,
        totalConversations,
        totalMessages,
        recentUsers,
        recentMessages,
        timestamp: new Date().toISOString(),
      },
      charts: {
        userGrowth: userGrowthResult.rows,
        messageActivity: messageActivityResult.rows,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    })
  }
})

/**
 * GET /api/dashboard/user-stats/:userId
 * Get specific user statistics
 */
router.get('/user-stats/:userId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.params

    // User info
    const userResult = await query(
      'SELECT id, email, is_online, last_seen, created_at FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const user = userResult.rows[0]

    // User's conversations count
    const conversationsResult = await query(
      `SELECT COUNT(*) as count FROM conversations
       WHERE user1_id = $1 OR user2_id = $1`,
      [userId]
    )
    const conversationCount = conversationsResult.rows[0]?.count || 0

    // User's messages count
    const messagesResult = await query(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = $1',
      [userId]
    )
    const messageCount = messagesResult.rows[0]?.count || 0

    // User's last message
    const lastMessageResult = await query(
      `SELECT content, created_at FROM messages
       WHERE sender_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
    const lastMessage = lastMessageResult.rows[0] || null

    res.status(200).json({
      success: true,
      user,
      stats: {
        conversationCount,
        messageCount,
        lastMessage,
      },
    })
  } catch (error) {
    console.error('Get user stats error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get user stats',
    })
  }
})

/**
 * DELETE /api/dashboard/users/:userId
 * Delete a user (admin only)
 */
router.delete('/users/:userId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId: requestingUserId } = req.user
    const { userId } = req.params

    // Check if requesting user is admin
    const adminCheck = await query(
      'SELECT is_active FROM admin_accounts WHERE id = $1',
      [requestingUserId]
    )

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_active) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can delete users',
      })
    }

    // Prevent self-deletion
    if (parseInt(userId) === requestingUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own admin account',
      })
    }

    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [userId])

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Delete user error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    })
  }
})

export default router
