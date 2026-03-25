const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
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
  const draw = db.prepare('SELECT * FROM draws WHERE status = ? ORDER BY year DESC, month DESC LIMIT 1').get('published');
  res.json(draw || null);
});

// GET /api/draws/:id/my-result — check if logged-in user won
router.get('/:id/my-result', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const entry = db.prepare(`
    SELECT de.*, d.winning_numbers, d.month, d.year
    FROM draw_entries de JOIN draws d ON d.id = de.draw_id
    WHERE de.draw_id = ? AND de.user_id = ?
  `).get(req.params.id, req.user.id);
  res.json(entry || { matched: 0 });
});

// POST /api/draws/:id/enter — enter a draw (manual, or auto via subscription)
router.post('/:id/enter', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const draw = db.prepare('SELECT * FROM draws WHERE id = ? AND status != ?').get(req.params.id, 'archived');
  if (!draw) return res.status(404).json({ error: 'Draw not found or closed.' });

  const existing = db.prepare('SELECT id FROM draw_entries WHERE draw_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Already entered this draw.' });

  const scores = db.prepare('SELECT score FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5').all(req.user.id);
  if (scores.length < 5) return res.status(400).json({ error: 'You need 5 scores to enter a draw.' });

  const winningNums = JSON.parse(draw.winning_numbers || '[]');
  const userNums = scores.map(s => s.score);
  const matched = userNums.filter(n => winningNums.includes(n)).length;

  let prizeTier = null;
  if (matched === 5) prizeTier = '5-match';
  else if (matched === 4) prizeTier = '4-match';
  else if (matched === 3) prizeTier = '3-match';

  // Calculate prize amount based on pool shares
  let amount = 0;
  if (prizeTier && draw.total_pool > 0) {
    const pcts = { '5-match': 0.40, '4-match': 0.35, '3-match': 0.25 };
    const tier = pcts[prizeTier] || 0;
    // Count other winners in same tier to split
    const tierWinners = db.prepare('SELECT COUNT(*) as c FROM draw_entries WHERE draw_id = ? AND prize_tier = ?').get(req.params.id, prizeTier);
    amount = (draw.total_pool * tier) / (tierWinners.c + 1);
  }

  db.prepare(`INSERT INTO draw_entries (id,draw_id,user_id,matched,prize_tier,amount,pay_status) VALUES (?,?,?,?,?,?,?)`)
    .run(uuidv4(), req.params.id, req.user.id, matched, prizeTier, amount, prizeTier ? 'pending' : 'n/a');

  res.json({ matched, prizeTier, amount, userNums, winningNums });
});

module.exports = router;
