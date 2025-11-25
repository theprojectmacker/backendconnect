import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const JWT_EXPIRE_IN = process.env.JWT_EXPIRE_IN || '24h'
const JWT_REFRESH_EXPIRE_IN = process.env.JWT_REFRESH_EXPIRE_IN || '7d'

/**
 * Generate JWT access token
 */
export const generateAccessToken = (userId, email) => {
  try {
    const token = jwt.sign(
      {
        userId,
        email,
        type: 'access',
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRE_IN,
        algorithm: 'HS256',
      }
    )
    return token
  } catch (error) {
    console.error('Error generating access token:', error.message)
    throw error
  }
}

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (userId, email) => {
  try {
    const token = jwt.sign(
      {
        userId,
        email,
        type: 'refresh',
      },
      JWT_REFRESH_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRE_IN,
        algorithm: 'HS256',
      }
    )
    return token
  } catch (error) {
    console.error('Error generating refresh token:', error.message)
    throw error
  }
}

/**
 * Generate both access and refresh tokens
 */
export const generateTokens = (userId, email) => {
  const accessToken = generateAccessToken(userId, email)
  const refreshToken = generateRefreshToken(userId, email)
  return { accessToken, refreshToken }
}

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    })
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type')
    }
    return decoded
  } catch (error) {
    console.error('Access token verification failed:', error.message)
    return null
  }
}

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    })
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type')
    }
    return decoded
  } catch (error) {
    console.error('Refresh token verification failed:', error.message)
    return null
  }
}

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }
  return parts[1]
}

/**
 * Middleware to verify access token
 */
export const verifyTokenMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = extractTokenFromHeader(authHeader)

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      })
    }

    const decoded = verifyAccessToken(token)

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      })
    }

    req.user = decoded
    next()
  } catch (error) {
    console.error('Token verification middleware error:', error.message)
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    })
  }
}
