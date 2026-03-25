const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, sub_status, plan FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

function requireSubscription(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.sub_status !== 'active') {
    return res.status(403).json({ error: 'Active subscription required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireSubscription };
