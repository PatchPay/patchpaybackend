const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
const authenticateToken = async (req, res, next) => {
  try {
    console.log('Auth middleware called');
    console.log('Headers:', JSON.stringify(req.headers));
    
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
      });
    }

    // Get token without Bearer prefix
    const token = authHeader.split(' ')[1];
    console.log('Token received:', token ? 'Token exists' : 'No token');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
      });
    }

    try {
      // Use the same fallback JWT secret as in loginUser
      const jwtSecret = process.env.JWT_SECRET || 'patchpay-secret-key-7d9ac52e';
      
      // Verify token
      const decoded = jwt.verify(token, jwtSecret);
      
      // Check if token is expired
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
        });
      }
      
      // The token contains userId
      const userId = decoded.userId;
      
      if (!userId) {
        console.log('No userId found in token');
        return res.status(401).json({
          success: false,
          message: 'Invalid token format',
        });
      }
      
      // Check if user exists
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        console.log('User not found with ID:', userId);
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found',
        });
      }

      console.log('User found:', user._id.toString());

      // Attach user to request object
      req.user = user;
      
      // Proceed to next middleware or route handler
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Export the middleware functions
module.exports = {
  authenticateToken,
  authMiddleware: authenticateToken // Export the same function with both names for backward compatibility
};
