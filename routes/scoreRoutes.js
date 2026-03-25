const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { getDb } = require('../db/database');
const { asyncHandler } = require('../lib/asyncHandler');
const { authenticate, requireSubscription } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireSubscription, asyncHandler(async (req, res) => {
  const db = getDb();
  const scores = await db.prepare(`
    SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5
  `).all(req.user.id);
  res.json(scores);
}));

router.post('/', authenticate, requireSubscription, [
  body('score').isInt({ min: 1, max: 45 }).withMessage('Score must be between 1 and 45'),
  body('playedDate').isDate().withMessage('Valid date required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { score, playedDate } = req.body;
  const db = getDb();
  const userId = req.user.id;

  const existing = await db.prepare('SELECT id FROM scores WHERE user_id = ? ORDER BY played_date DESC').all(userId);
  if (existing.length >= 5) {
    const oldest = existing[existing.length - 1];
    await db.prepare('DELETE FROM scores WHERE id = ?').run(oldest.id);
  }

  const id = uuidv4();
  await db.prepare('INSERT INTO scores (id, user_id, score, played_date) VALUES (?, ?, ?, ?)')
    .run(id, userId, score, playedDate);

  const all = await db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC').all(userId);
  res.status(201).json({ message: 'Score added', scores: all });
}));

router.patch('/:id', authenticate, requireSubscription, [
  body('score').isInt({ min: 1, max: 45 }).withMessage('Score must be between 1 and 45'),
  body('playedDate').isDate().withMessage('Valid date required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const existing = await db.prepare('SELECT id FROM scores WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Score not found.' });

  await db.prepare('UPDATE scores SET score = ?, played_date = ? WHERE id = ? AND user_id = ?')
    .run(req.body.score, req.body.playedDate, req.params.id, req.user.id);

  const all = await db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC').all(req.user.id);
  res.json({ message: 'Score updated', scores: all });
}));

router.delete('/:id', authenticate, requireSubscription, asyncHandler(async (req, res) => {
  const db = getDb();
  const score = await db.prepare('SELECT * FROM scores WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!score) return res.status(404).json({ error: 'Score not found.' });
  await db.prepare('DELETE FROM scores WHERE id = ?').run(req.params.id);
  res.json({ message: 'Score deleted' });
}));

module.exports = router;
