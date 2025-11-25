import express from 'express'
import { query } from '../db/connection.js'
import { verifyTokenMiddleware } from '../utils/jwt.js'

const router = express.Router()

/**
 * Initialize messaging tables if they don't exist
 */
const initializeMessagesTables = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_id, user2_id),
        CONSTRAINT different_users CHECK (user1_id != user2_id)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS chat_invitations (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id),
        CONSTRAINT different_users CHECK (sender_id != receiver_id)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS conversation_deleted_by (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `)

    console.log('✓ Messaging tables initialized')
  } catch (error) {
    console.error('Error initializing messaging tables:', error.message)
  }
}

// Initialize tables on route load
initializeMessagesTables()

/**
 * GET /api/messages/search-users
 * Search for users by email or name
 */
router.get('/search-users', verifyTokenMiddleware, async (req, res) => {
  try {
    const { q } = req.query
    const userId = req.user.userId

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      })
    }

    const result = await query(
      `SELECT id, email FROM users WHERE (email LIKE $1 OR email LIKE $2) AND id != $3 LIMIT 10`,
      [`%${q}%`, `${q}%`, userId]
    )

    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
    }))

    res.status(200).json({
      success: true,
      users,
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
 * POST /api/messages/send-invitation
 * Send chat invitation to another user
 */
router.post('/send-invitation', verifyTokenMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.body
    const senderId = req.user.userId

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        error: 'Receiver ID is required',
      })
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send invitation to yourself',
      })
    }

    // Check if receiver exists
    const receiverCheck = await query('SELECT id FROM users WHERE id = $1', [receiverId])
    if (receiverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Insert or update invitation
    const result = await query(
      `INSERT INTO chat_invitations (sender_id, receiver_id, status) 
       VALUES ($1, $2, 'pending')
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [senderId, receiverId]
    )

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: result.rows[0],
    })
  } catch (error) {
    console.error('Send invitation error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation',
    })
  }
})

/**
 * GET /api/messages/invitations/pending
 * Get pending invitations for the current user (received)
 */
router.get('/invitations/pending', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    const result = await query(
      `SELECT i.id, i.sender_id, u.email as sender_email, i.created_at
       FROM chat_invitations i
       JOIN users u ON i.sender_id = u.id
       WHERE i.receiver_id = $1 AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      invitations: result.rows,
    })
  } catch (error) {
    console.error('Get invitations error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get invitations',
    })
  }
})

/**
 * GET /api/messages/invitations/sent
 * Get sent invitations for the current user
 */
router.get('/invitations/sent', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    const result = await query(
      `SELECT i.id, i.receiver_id, u.email as receiver_email, i.status, i.created_at
       FROM chat_invitations i
       JOIN users u ON i.receiver_id = u.id
       WHERE i.sender_id = $1 AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      invitations: result.rows,
    })
  } catch (error) {
    console.error('Get sent invitations error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get sent invitations',
    })
  }
})

/**
 * POST /api/messages/invitations/:invitationId/accept
 * Accept a chat invitation
 */
router.post('/invitations/:invitationId/accept', verifyTokenMiddleware, async (req, res) => {
  try {
    const { invitationId } = req.params
    const userId = req.user.userId

    // Get invitation
    const invitationResult = await query(
      'SELECT * FROM chat_invitations WHERE id = $1',
      [invitationId]
    )

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      })
    }

    const invitation = invitationResult.rows[0]

    if (invitation.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to accept this invitation',
      })
    }

    // Update invitation status
    await query(
      'UPDATE chat_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['accepted', invitationId]
    )

    // Create conversation
    const conversationResult = await query(
      `INSERT INTO conversations (user1_id, user2_id)
       VALUES ($1, $2)
       ON CONFLICT (user1_id, user2_id) DO NOTHING
       RETURNING *`,
      [Math.min(invitation.sender_id, invitation.receiver_id), Math.max(invitation.sender_id, invitation.receiver_id)]
    )

    res.status(200).json({
      success: true,
      message: 'Invitation accepted',
      conversation: conversationResult.rows[0],
    })
  } catch (error) {
    console.error('Accept invitation error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation',
    })
  }
})

/**
 * POST /api/messages/invitations/:invitationId/decline
 * Decline a chat invitation
 */
router.post('/invitations/:invitationId/decline', verifyTokenMiddleware, async (req, res) => {
  try {
    const { invitationId } = req.params
    const userId = req.user.userId

    const invitationResult = await query(
      'SELECT * FROM chat_invitations WHERE id = $1',
      [invitationId]
    )

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      })
    }

    const invitation = invitationResult.rows[0]

    if (invitation.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to decline this invitation',
      })
    }

    await query(
      'UPDATE chat_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['declined', invitationId]
    )

    res.status(200).json({
      success: true,
      message: 'Invitation declined',
    })
  } catch (error) {
    console.error('Decline invitation error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to decline invitation',
    })
  }
})

/**
 * POST /api/messages/invitations/:invitationId/cancel
 * Cancel a sent invitation
 */
router.post('/invitations/:invitationId/cancel', verifyTokenMiddleware, async (req, res) => {
  try {
    const { invitationId } = req.params
    const userId = req.user.userId

    const invitationResult = await query(
      'SELECT * FROM chat_invitations WHERE id = $1',
      [invitationId]
    )

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      })
    }

    const invitation = invitationResult.rows[0]

    if (invitation.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to cancel this invitation',
      })
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Only pending invitations can be canceled',
      })
    }

    await query(
      'UPDATE chat_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['canceled', invitationId]
    )

    res.status(200).json({
      success: true,
      message: 'Invitation canceled',
    })
  } catch (error) {
    console.error('Cancel invitation error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel invitation',
    })
  }
})

/**
 * GET /api/messages/conversations
 * Get all conversations for the current user (excluding soft-deleted ones)
 */
router.get('/conversations', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId

    const result = await query(
      `SELECT
        c.id,
        CASE
          WHEN c.user1_id = $1 THEN c.user2_id
          ELSE c.user1_id
        END as other_user_id,
        u.email as other_user_email,
        c.created_at,
        c.updated_at
       FROM conversations c
       JOIN users u ON (
         CASE
           WHEN c.user1_id = $1 THEN c.user2_id = u.id
           ELSE c.user1_id = u.id
         END
       )
       WHERE (c.user1_id = $1 OR c.user2_id = $1)
       AND c.id NOT IN (SELECT conversation_id FROM conversation_deleted_by WHERE user_id = $1)
       ORDER BY c.updated_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      conversations: result.rows,
    })
  } catch (error) {
    console.error('Get conversations error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
    })
  }
})

/**
 * GET /api/messages/conversations/:conversationId/messages
 * Get messages for a conversation
 */
router.get('/conversations/:conversationId/messages', verifyTokenMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params
    const userId = req.user.userId
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    // Check if user is part of this conversation
    const conversationCheck = await query(
      'SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    )

    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this conversation',
      })
    }

    // Check if conversation was soft-deleted for this user and get the deletion timestamp
    const deletionCheck = await query(
      'SELECT deleted_at FROM conversation_deleted_by WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    )

    let messageQuery = `SELECT m.*, u.email as sender_email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1`
    const messageParams = [conversationId]

    // If conversation was deleted, only show messages AFTER deletion
    if (deletionCheck.rows.length > 0) {
      messageQuery += ` AND m.created_at > $2`
      messageParams.push(deletionCheck.rows[0].deleted_at)
      messageQuery += ` ORDER BY m.created_at DESC LIMIT $3 OFFSET $4`
      messageParams.push(limit)
      messageParams.push(offset)
    } else {
      messageQuery += ` ORDER BY m.created_at DESC LIMIT $2 OFFSET $3`
      messageParams.push(limit)
      messageParams.push(offset)
    }

    const result = await query(messageQuery, messageParams)

    // Mark messages as read
    await query(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE',
      [conversationId, userId]
    )

    res.status(200).json({
      success: true,
      messages: result.rows.reverse(),
    })
  } catch (error) {
    console.error('Get messages error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
    })
  }
})

/**
 * POST /api/messages/conversations/:conversationId/send
 * Send a message in a conversation
 */
router.post('/conversations/:conversationId/send', verifyTokenMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params
    const { content, messageType } = req.body
    const userId = req.user.userId

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
      })
    }

    // Check if user is part of this conversation
    const conversationCheck = await query(
      'SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    )

    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this conversation',
      })
    }

    // Get the other user in this conversation
    const conversation = conversationCheck.rows[0]
    const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id

    // If the other user soft-deleted this conversation, remove the deletion record (conversation "reappears")
    await query(
      'DELETE FROM conversation_deleted_by WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, otherUserId]
    )

    // Insert message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversationId, userId, content, messageType || 'text']
    )

    // Update conversation updated_at
    await query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [conversationId]
    )

    res.status(201).json({
      success: true,
      message: result.rows[0],
    })
  } catch (error) {
    console.error('Send message error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    })
  }
})

/**
 * POST /api/messages/conversations/:conversationId/delete
 * Soft delete a conversation for the current user
 */
router.post('/conversations/:conversationId/delete', verifyTokenMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params
    const userId = req.user.userId

    // Check if user is part of this conversation
    const conversationCheck = await query(
      'SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    )

    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this conversation',
      })
    }

    // Mark conversation as deleted for this user
    await query(
      `INSERT INTO conversation_deleted_by (conversation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, userId]
    )

    res.status(200).json({
      success: true,
      message: 'Conversation deleted',
    })
  } catch (error) {
    console.error('Delete conversation error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
    })
  }
})

export default router
