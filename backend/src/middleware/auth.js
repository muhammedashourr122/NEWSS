const jwt = require('jsonwebtoken');

// Existing middlewares
const sensitiveOperation = (req, res, next) => {
  const sensitiveRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  const isSensitiveRoute = sensitiveRoutes.some(route => req.path.includes(route));

  if (isSensitiveRoute) {
    console.log(`[Sensitive Operation] ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    res.setHeader('X-Sensitive-Operation', 'true');
  }
  next();
};

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'shipping-system',
      audience: 'shipping-app'
    });

    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    next();
  };
};

// Merchant-only middleware
const isMerchant = (req, res, next) => {
  if (req.user?.role !== 'merchant') {
    return res.status(403).json({ success: false, message: 'Merchant access only' });
  }
  next();
};

// Driver-only middleware
const isDriver = (req, res, next) => {
  if (req.user?.role !== 'driver') {
    return res.status(403).json({ success: false, message: 'Driver access only' });
  }
  next();
};

// Optional auth (attach user if token exists, otherwise continue)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'shipping-system',
        audience: 'shipping-app'
      });
    } catch (err) {
      console.warn('Optional auth token invalid, continuing without user');
    }
  }
  next();
};

// Require verified email
const requireEmailVerification = (req, res, next) => {
  if (!req.user?.isEmailVerified) {
    return res.status(403).json({ success: false, message: 'Email not verified' });
  }
  next();
};

module.exports = {
  sensitiveOperation,
  authenticate,
  authorize,
  isMerchant,
  isDriver,
  optionalAuth,
  requireEmailVerification
};
