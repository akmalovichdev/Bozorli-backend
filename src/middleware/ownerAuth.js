const { authenticateToken } = require('./auth');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has owner role
 * Only users with 'owner' role can access admin panel
 */
const requireOwnerRole = async (req, res, next) => {
  try {
    logger.info('Owner authentication started');
    
    // First authenticate the token
    authenticateToken(req, res, (err) => {
      if (err) {
        logger.error('Token authentication failed:', err);
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      logger.info('Token authentication successful');
      logger.info(`User authenticated: ${req.user?.id}, role: ${req.user?.role}`);

      // Check if user has owner role
      if (!req.user || req.user.role !== 'owner') {
        logger.warn(`Access denied: User ${req.user?.id} with role ${req.user?.role} tried to access owner-only endpoint`);
        return res.status(403).json({
          success: false,
          error: 'Access denied. Owner role required.'
        });
      }

      logger.info('Owner authentication successful');
      next();
    });
  } catch (error) {
    logger.error('Owner authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
};

module.exports = { requireOwnerRole };
