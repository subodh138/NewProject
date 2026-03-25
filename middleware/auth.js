const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const db = getDb();
    const user = await db.prepare('SELECT id, name, email, role, sub_status, plan FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

function requireSubscription(req, res, next) {
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.sub_status !== 'active') {
    return res.status(403).json({ error: 'Active subscription required.' });
  }

  return next();
}

module.exports = { authenticate, requireAdmin, requireSubscription };
