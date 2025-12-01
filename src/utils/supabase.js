import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. File upload features will not work.')
}

let supabase = null

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

/**
 * Upload file to Supabase Storage
 * @param {string} bucketName - Bucket name
 * @param {string} filePath - File path in bucket
 * @param {Buffer} fileBuffer - File content
 * @returns {Promise<Object>} - Upload result with publicUrl
 */
export const uploadFile = async (bucketName, filePath, fileBuffer) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        upsert: true,
      })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    return {
      success: true,
      path: data.path,
      publicUrl: publicData.publicUrl,
    }
  } catch (error) {
    console.error('Upload file error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Delete file from Supabase Storage
 * @param {string} bucketName - Bucket name
 * @param {string} filePath - File path in bucket
 * @returns {Promise<Object>} - Delete result
 */
export const deleteFile = async (bucketName, filePath) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])

    if (error) {
      throw error
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Delete file error:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Get public URL for a file
 * @param {string} bucketName - Bucket name
 * @param {string} filePath - File path in bucket
 * @returns {string} - Public URL
 */
export const getPublicUrl = (bucketName, filePath) => {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
  return data.publicUrl
}

export default supabase
