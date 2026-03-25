const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { getDb } = require('../db/database');
const { asyncHandler } = require('../lib/asyncHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, charityId, charityPct } = req.body;
  const db = getDb();

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();

  await db.prepare(`
    INSERT INTO users (id, name, email, password, role, charity_id, charity_pct)
    VALUES (?, ?, ?, ?, 'subscriber', ?, ?)
  `).run(id, name, email, hash, charityId || null, charityPct || 10);

  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const user = await db.prepare('SELECT id, name, email, role, sub_status, plan, charity_id, charity_pct FROM users WHERE id = ?').get(id);

  res.status(201).json({ token, user });
}));

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const db = getDb();

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'Admin accounts must use the Admin sign-in tab.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const { password: _, ...safeUser } = user;

  res.json({ token, user: safeUser });
}));

router.post('/admin-login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const db = getDb();

  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, 'admin');
  if (!user) return res.status(401).json({ error: 'Admin not found.' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '12h' });
  const { password: _, ...safeUser } = user;

  res.json({ token, user: safeUser });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const db = getDb();
  const user = await db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct,handicap,created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json(user);
}));

module.exports = router;
