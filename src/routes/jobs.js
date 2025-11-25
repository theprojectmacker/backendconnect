import express from 'express'
import { query } from '../db/connection.js'
import { sendJobApplicationEmail } from '../utils/email.js'
import { verifyTokenMiddleware } from '../utils/jwt.js'

const router = express.Router()

/**
 * Initialize job inquiries table
 */
const initializeJobInquiriesTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS job_inquiries (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(255) NOT NULL,
        salary_range VARCHAR(255),
        job_type VARCHAR(50),
        requirements TEXT,
        benefits TEXT,
        company_name VARCHAR(255),
        contact_email VARCHAR(255),
        posted_by_admin_id INTEGER NOT NULL,
        total_clicks INTEGER DEFAULT 0,
        total_applications INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (posted_by_admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
      )
    `)
    console.log('✓ Job inquiries table initialized')

    try {
      await query('ALTER TABLE job_inquiries ADD COLUMN total_clicks INTEGER DEFAULT 0')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE job_inquiries ADD COLUMN total_applications INTEGER DEFAULT 0')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE job_inquiries ADD COLUMN status VARCHAR(50) DEFAULT \'active\'')
    } catch (e) {
      // Column already exists
    }
  } catch (error) {
    console.error('Error initializing job inquiries table:', error.message)
  }
}

/**
 * Initialize job applications table
 */
const initializeJobApplicationsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        job_inquiry_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        resume_url VARCHAR(500),
        cover_letter TEXT,
        phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_inquiry_id) REFERENCES job_inquiries(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(job_inquiry_id, user_id)
      )
    `)
    console.log('✓ Job applications table initialized')

    try {
      await query('ALTER TABLE job_applications ADD COLUMN resume_url VARCHAR(500)')
    } catch (e) {
      // Column already exists
    }

    try {
      await query('ALTER TABLE job_applications ADD COLUMN phone VARCHAR(20)')
    } catch (e) {
      // Column already exists
    }
  } catch (error) {
    console.error('Error initializing job applications table:', error.message)
  }
}

/**
 * Initialize job clicks tracking table
 */
const initializeJobClicksTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS job_clicks (
        id SERIAL PRIMARY KEY,
        job_inquiry_id INTEGER NOT NULL,
        user_id INTEGER,
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_inquiry_id) REFERENCES job_inquiries(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `)
    console.log('✓ Job clicks table initialized')
  } catch (error) {
    console.error('Error initializing job clicks table:', error.message)
  }
}

// Initialize tables on route load
initializeJobInquiriesTable()
initializeJobApplicationsTable()
initializeJobClicksTable()

/**
 * POST /api/jobs
 * Create a new job inquiry (admin only)
 */
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const {
      title,
      description,
      location,
      salaryRange,
      jobType,
      requirements,
      benefits,
      companyName,
      contactEmail,
    } = req.body

    // Validate required fields
    if (!title || !description || !location) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and location are required',
      })
    }

    // Check if user is admin
    const adminCheck = await query(
      'SELECT id FROM admin_accounts WHERE id = $1 AND is_active = TRUE',
      [userId]
    )

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can create job inquiries',
      })
    }

    // Create job inquiry
    const result = await query(
      `INSERT INTO job_inquiries (
        title, description, location, salary_range, job_type, 
        requirements, benefits, company_name, contact_email, posted_by_admin_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, description, location, salary_range, job_type,
        requirements, benefits, company_name, contact_email, posted_by_admin_id,
        total_clicks, total_applications, status, created_at`,
      [
        title,
        description,
        location,
        salaryRange || null,
        jobType || null,
        requirements || null,
        benefits || null,
        companyName || null,
        contactEmail || null,
        userId,
      ]
    )

    res.status(201).json({
      success: true,
      message: 'Job inquiry created successfully',
      job: result.rows[0],
    })
  } catch (error) {
    console.error('Create job error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to create job inquiry',
    })
  }
})

/**
 * GET /api/jobs
 * Get all active job inquiries
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, title, description, location, salary_range, job_type,
        requirements, benefits, company_name, contact_email,
        total_clicks, total_applications, status, created_at
       FROM job_inquiries
       WHERE status = 'active'
       ORDER BY created_at DESC`
    )

    res.status(200).json({
      success: true,
      jobs: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error('Get jobs error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job inquiries',
    })
  }
})

/**
 * GET /api/jobs/admin
 * Get all job inquiries posted by admin (for admin dashboard)
 */
router.get('/admin/all', verifyTokenMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    // Check if user is admin
    const adminCheck = await query(
      'SELECT id FROM admin_accounts WHERE id = $1 AND is_active = TRUE',
      [userId]
    )

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can view all job inquiries',
      })
    }

    const result = await query(
      `SELECT 
        id, title, description, location, salary_range, job_type,
        requirements, benefits, company_name, contact_email,
        total_clicks, total_applications, status, created_at, updated_at
       FROM job_inquiries
       WHERE posted_by_admin_id = $1
       ORDER BY created_at DESC`,
      [userId]
    )

    res.status(200).json({
      success: true,
      jobs: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error('Get admin jobs error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job inquiries',
    })
  }
})

/**
 * GET /api/jobs/:jobId
 * Get specific job inquiry details with click tracking
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null

    // Get job details
    const jobResult = await query(
      `SELECT 
        id, title, description, location, salary_range, job_type,
        requirements, benefits, company_name, contact_email,
        total_clicks, total_applications, status, created_at
       FROM job_inquiries
       WHERE id = $1 AND status = 'active'`,
      [jobId]
    )

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      })
    }

    // Track click
    try {
      await query(
        'INSERT INTO job_clicks (job_inquiry_id, user_id) VALUES ($1, $2)',
        [jobId, userId]
      )

      // Update total clicks count
      await query(
        'UPDATE job_inquiries SET total_clicks = total_clicks + 1 WHERE id = $1',
        [jobId]
      )

      // Get updated click count
      const updatedJob = await query(
        'SELECT total_clicks, total_applications FROM job_inquiries WHERE id = $1',
        [jobId]
      )

      const job = jobResult.rows[0]
      if (updatedJob.rows.length > 0) {
        job.total_clicks = updatedJob.rows[0].total_clicks
        job.total_applications = updatedJob.rows[0].total_applications
      }
    } catch (clickError) {
      console.error('Error tracking click:', clickError.message)
      // Don't fail the request if tracking fails
    }

    res.status(200).json({
      success: true,
      job: jobResult.rows[0],
    })
  } catch (error) {
    console.error('Get job details error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job details',
    })
  }
})

/**
 * POST /api/jobs/:jobId/apply
 * Apply for a job
 */
router.post('/:jobId/apply', verifyTokenMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params
    const { userId, email: authEmail } = req.user
    const { userName, email, phone, coverLetter, resumeUrl } = req.body

    const userEmail = email || authEmail

    // Validate required fields
    if (!userName) {
      return res.status(400).json({
        success: false,
        error: 'User name is required',
      })
    }

    // Check if job exists
    const jobResult = await query(
      'SELECT id, title, company_name FROM job_inquiries WHERE id = $1',
      [jobId]
    )

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      })
    }

    const job = jobResult.rows[0]

    // Check if user already applied
    const existingApplication = await query(
      'SELECT id FROM job_applications WHERE job_inquiry_id = $1 AND user_id = $2',
      [jobId, userId]
    )

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already applied for this job',
      })
    }

    // Create application
    const result = await query(
      `INSERT INTO job_applications (
        job_inquiry_id, user_id, user_email, user_name, phone, cover_letter, resume_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, job_inquiry_id, user_id, user_email, user_name, phone,
        cover_letter, resume_url, status, applied_at`,
      [jobId, userId, userEmail, userName, phone || null, coverLetter || null, resumeUrl || null]
    )

    // Update total applications count
    await query(
      'UPDATE job_inquiries SET total_applications = total_applications + 1 WHERE id = $1',
      [jobId]
    )

    // Send thank you email
    try {
      const emailResult = await sendJobApplicationEmail(userEmail, userName, job.title, job.company_name)
      if (!emailResult.success) {
        console.warn(`Warning: Failed to send email to ${userEmail}, but application was created`)
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError.message)
      // Don't fail the application if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Check your email for confirmation.',
      application: result.rows[0],
    })
  } catch (error) {
    console.error('Apply for job error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to submit application',
    })
  }
})

/**
 * GET /api/jobs/:jobId/applications
 * Get all applications for a job (admin only)
 */
router.get('/:jobId/applications', verifyTokenMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params
    const { userId } = req.user

    // Check if job is posted by this admin
    const jobCheck = await query(
      'SELECT id FROM job_inquiries WHERE id = $1 AND posted_by_admin_id = $2',
      [jobId, userId]
    )

    if (jobCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view applications for this job',
      })
    }

    const result = await query(
      `SELECT 
        id, job_inquiry_id, user_id, user_email, user_name, phone,
        cover_letter, resume_url, status, applied_at
       FROM job_applications
       WHERE job_inquiry_id = $1
       ORDER BY applied_at DESC`,
      [jobId]
    )

    res.status(200).json({
      success: true,
      applications: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error('Get applications error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
    })
  }
})

/**
 * PUT /api/jobs/:jobId
 * Update job inquiry (admin only)
 */
router.put('/:jobId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params
    const { userId } = req.user
    const {
      title,
      description,
      location,
      salaryRange,
      jobType,
      requirements,
      benefits,
      companyName,
      contactEmail,
      status,
    } = req.body

    // Check if job is posted by this admin
    const jobCheck = await query(
      'SELECT id FROM job_inquiries WHERE id = $1 AND posted_by_admin_id = $2',
      [jobId, userId]
    )

    if (jobCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this job',
      })
    }

    // Update job
    const result = await query(
      `UPDATE job_inquiries SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location = COALESCE($3, location),
        salary_range = COALESCE($4, salary_range),
        job_type = COALESCE($5, job_type),
        requirements = COALESCE($6, requirements),
        benefits = COALESCE($7, benefits),
        company_name = COALESCE($8, company_name),
        contact_email = COALESCE($9, contact_email),
        status = COALESCE($10, status),
        updated_at = NOW()
       WHERE id = $11
       RETURNING id, title, description, location, salary_range, job_type,
        requirements, benefits, company_name, contact_email, status, updated_at`,
      [
        title || null,
        description || null,
        location || null,
        salaryRange || null,
        jobType || null,
        requirements || null,
        benefits || null,
        companyName || null,
        contactEmail || null,
        status || null,
        jobId,
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Job inquiry updated successfully',
      job: result.rows[0],
    })
  } catch (error) {
    console.error('Update job error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to update job inquiry',
    })
  }
})

/**
 * DELETE /api/jobs/:jobId
 * Delete job inquiry (admin only)
 */
router.delete('/:jobId', verifyTokenMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params
    const { userId } = req.user

    // Check if job is posted by this admin
    const jobCheck = await query(
      'SELECT id FROM job_inquiries WHERE id = $1 AND posted_by_admin_id = $2',
      [jobId, userId]
    )

    if (jobCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this job',
      })
    }

    // Delete job (cascade will handle applications and clicks)
    await query('DELETE FROM job_inquiries WHERE id = $1', [jobId])

    res.status(200).json({
      success: true,
      message: 'Job inquiry deleted successfully',
    })
  } catch (error) {
    console.error('Delete job error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to delete job inquiry',
    })
  }
})

/**
 * GET /api/jobs/:jobId/analytics
 * Get analytics for a job (admin only)
 */
router.get('/:jobId/analytics', verifyTokenMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params
    const { userId } = req.user

    // Check if job is posted by this admin
    const jobCheck = await query(
      'SELECT id, total_clicks, total_applications FROM job_inquiries WHERE id = $1 AND posted_by_admin_id = $2',
      [jobId, userId]
    )

    if (jobCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view analytics for this job',
      })
    }

    const job = jobCheck.rows[0]

    // Get daily clicks (last 30 days)
    const clicksResult = await query(
      `SELECT 
        DATE(clicked_at) as date,
        COUNT(*) as clicks
       FROM job_clicks
       WHERE job_inquiry_id = $1 AND clicked_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(clicked_at)
       ORDER BY date ASC`,
      [jobId]
    )

    // Get daily applications (last 30 days)
    const applicationsResult = await query(
      `SELECT 
        DATE(applied_at) as date,
        COUNT(*) as applications
       FROM job_applications
       WHERE job_inquiry_id = $1 AND applied_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(applied_at)
       ORDER BY date ASC`,
      [jobId]
    )

    // Get application status breakdown
    const statusResult = await query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM job_applications
       WHERE job_inquiry_id = $1
       GROUP BY status`,
      [jobId]
    )

    res.status(200).json({
      success: true,
      analytics: {
        totalClicks: job.total_clicks,
        totalApplications: job.total_applications,
        clicksTrend: clicksResult.rows,
        applicationsTrend: applicationsResult.rows,
        statusBreakdown: statusResult.rows,
      },
    })
  } catch (error) {
    console.error('Get job analytics error:', error.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job analytics',
    })
  }
})

export default router
