const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { getLatestScoresForUser } = require('../lib/drawEngine');
const { authenticate, requireSubscription } = require('../middleware/auth');

const router = express.Router();

// GET /api/draws — list all published draws
router.get('/', (req, res) => {
  const db = getDb();
  const draws = db.prepare('SELECT * FROM draws WHERE status = ? ORDER BY year DESC, month DESC').all('published');
  res.json(draws);
});

// GET /api/draws/latest
router.get('/latest', (req, res) => {
  const db = getDb();
  const draw = db.prepare(`
    SELECT * FROM draws
    WHERE status IN ('pending', 'published')
    ORDER BY year DESC, month DESC, created_at DESC
    LIMIT 1
  `).get();
  res.json(draw || null);
});

// GET /api/draws/:id/my-result — check if logged-in user won
router.get('/:id/my-result', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const entry = db.prepare(`
    SELECT de.*, d.winning_numbers, d.month, d.year, d.title, d.status
    FROM draw_entries de JOIN draws d ON d.id = de.draw_id
    WHERE de.draw_id = ? AND de.user_id = ?
  `).get(req.params.id, req.user.id);
  res.json(entry || { matched: 0 });
});

// POST /api/draws/:id/enter — enter a draw using the user's current rolling 5 scores
router.post('/:id/enter', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const draw = db.prepare("SELECT * FROM draws WHERE id = ? AND status != 'archived'").get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found or closed.' });

  const existing = db.prepare('SELECT id FROM draw_entries WHERE draw_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Already entered this draw.' });
  if (draw.status === 'published') return res.status(400).json({ error: 'This draw is closed to new entries.' });

  const userNums = getLatestScoresForUser(db, req.user.id);
  if (userNums.length < 5) return res.status(400).json({ error: 'You need 5 scores to enter a draw.' });

  db.prepare(`
    INSERT INTO draw_entries (
      id, draw_id, user_id, matched, prize_tier, amount, pay_status, verified, proof_status, submitted_scores, entered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    req.params.id,
    req.user.id,
    0,
    null,
    0,
    draw.status === 'published' ? 'pending' : 'queued',
    0,
    'not_required',
    JSON.stringify(userNums),
    new Date().toISOString()
  );

  res.json({
    matched: 0,
    prizeTier: null,
    amount: 0,
    userNums,
    winningNums: [],
    status: 'queued',
    message: 'Draw entry saved. Results will appear when the admin publishes the draw.',
  });
});

module.exports = router;
