const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createAuthMiddleware(jwtSecret) {
  async function authenticate(req, res, next) {
    const token = req.cookies.stayease_token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = await User.findById(payload.sub).select('_id name email role');
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      req.user = user;
      return next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return next(error);
    }
  }

  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    return next();
  }

  return { authenticate, requireAdmin };
}

module.exports = { createAuthMiddleware };
