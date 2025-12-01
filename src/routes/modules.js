import express from 'express'
import { query } from '../db/connection.js'
import { verifyTokenMiddleware } from '../utils/jwt.js'
import { uploadFile, deleteFile } from '../utils/supabase.js'

const router = express.Router()

const BUCKET_NAME = 'modules'
const ALLOWED_TYPES = ['image/gif', 'application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'video/mp4', 'video/webm']

/**
 * GET /api/modules
 * Get all modules
 */
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, file_name, file_type, file_size, public_url, created_at, updated_at
       FROM modules
       ORDER BY created_at DESC`
    )

    res.status(200).json({
      success: true,
      modules: result.rows,
    })
  } catch (error) {
    console.error('Get modules error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to get modules',
    })
  }
})

/**
 * POST /api/modules
 * Upload a new module
 */
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const { title, fileData, fileName, fileType, fileSize } = req.body

    // Validation
    if (!title || !fileData || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Title, file data, and file name are required',
      })
    }

    // Check file type
    if (fileType && !ALLOWED_TYPES.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
      })
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64')

    // Generate unique file path
    const timestamp = Date.now()
    const filePath = `${timestamp}_${fileName}`

    // Upload to Supabase Storage
    const uploadResult = await uploadFile(BUCKET_NAME, filePath, buffer)

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || 'Failed to upload file',
      })
    }

    // Save module metadata to database
    const result = await query(
      `INSERT INTO modules (title, file_name, file_path, file_size, file_type, public_url, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, file_name, file_type, file_size, public_url, created_at`,
      [title, fileName, filePath, fileSize || 0, fileType || 'application/octet-stream', uploadResult.publicUrl, userId]
    )

    res.status(201).json({
      success: true,
      module: result.rows[0],
    })
  } catch (error) {
    console.error('Upload module error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to upload module',
    })
  }
})

/**
 * PUT /api/modules/:moduleId
 * Update module title
 */
router.put('/:moduleId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { moduleId } = req.params
    const { title } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      })
    }

    // Check if module exists
    const moduleCheck = await query(
      'SELECT id FROM modules WHERE id = $1',
      [moduleId]
    )

    if (moduleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found',
      })
    }

    // Update module
    const result = await query(
      `UPDATE modules 
       SET title = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, title, file_name, file_type, file_size, public_url, created_at, updated_at`,
      [title, moduleId]
    )

    res.status(200).json({
      success: true,
      module: result.rows[0],
    })
  } catch (error) {
    console.error('Update module error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to update module',
    })
  }
})

/**
 * DELETE /api/modules/:moduleId
 * Delete a module
 */
router.delete('/:moduleId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { moduleId } = req.params

    // Get module details
    const moduleResult = await query(
      'SELECT id, file_path FROM modules WHERE id = $1',
      [moduleId]
    )

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Module not found',
      })
    }

    const module = moduleResult.rows[0]

    // Delete file from Supabase Storage
    const deleteResult = await deleteFile(BUCKET_NAME, module.file_path)

    if (!deleteResult.success) {
      console.warn(`Warning: Failed to delete file from storage: ${module.file_path}`)
    }

    // Delete module record from database
    await query(
      'DELETE FROM modules WHERE id = $1',
      [moduleId]
    )

    res.status(200).json({
      success: true,
      message: 'Module deleted successfully',
    })
  } catch (error) {
    console.error('Delete module error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to delete module',
    })
  }
})

export default router
