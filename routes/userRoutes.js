const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/user/dashboard
router.get('/dashboard', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct,handicap,created_at FROM users WHERE id = ?').get(req.user.id);
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5').all(req.user.id);
  const wins = db.prepare(`SELECT de.*, d.month, d.year, d.title FROM draw_entries de JOIN draws d ON d.id = de.draw_id WHERE de.user_id = ? AND de.prize_tier IS NOT NULL ORDER BY d.year DESC, d.month DESC`).all(req.user.id);
  const totalWon = wins.reduce((s, w) => s + (w.amount || 0), 0);
  const drawsEntered = db.prepare('SELECT COUNT(*) as c FROM draw_entries WHERE user_id = ?').get(req.user.id);
  const charity = user.charity_id ? db.prepare('SELECT * FROM charities WHERE id = ?').get(user.charity_id) : null;
  const latestDraw = db.prepare(`
    SELECT * FROM draws
    WHERE status IN ('pending', 'published')
    ORDER BY year DESC, month DESC, created_at DESC
    LIMIT 1
  `).get();
  const latestEntry = latestDraw
    ? db.prepare('SELECT * FROM draw_entries WHERE draw_id = ? AND user_id = ?').get(latestDraw.id, req.user.id)
    : null;

  res.json({
    user,
    scores,
    wins,
    totalWon,
    drawsEntered: drawsEntered.c,
    charity,
    latestDraw,
    latestEntry,
  });
});

// PATCH /api/user/profile
router.patch('/profile', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('handicap').optional().isInt({ min: 0, max: 54 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, handicap } = req.body;
  const db = getDb();
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  if (handicap !== undefined) db.prepare('UPDATE users SET handicap = ? WHERE id = ?').run(handicap, req.user.id);
  const user = db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct,handicap FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// POST /api/user/subscribe
router.post('/subscribe', authenticate, [
  body('plan').isIn(['monthly', 'yearly']).withMessage('Plan must be monthly or yearly'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { plan } = req.body;
  const db = getDb();
  const amount = plan === 'monthly' ? 9.99 : 99.99;
  const subEnd = new Date();
  if (plan === 'monthly') subEnd.setMonth(subEnd.getMonth() + 1);
  else subEnd.setFullYear(subEnd.getFullYear() + 1);

  db.prepare('UPDATE users SET plan = ?, sub_status = ?, sub_end = ? WHERE id = ?')
    .run(plan, 'active', subEnd.toISOString(), req.user.id);

  db.prepare('INSERT INTO payments (id, user_id, plan, amount, status) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), req.user.id, plan, amount, 'completed');

  // Add charity contribution
  const user = db.prepare('SELECT charity_id, charity_pct FROM users WHERE id = ?').get(req.user.id);
  if (user.charity_id) {
    const contrib = amount * (user.charity_pct / 100);
    db.prepare('UPDATE charities SET total_raised = total_raised + ? WHERE id = ?').run(contrib, user.charity_id);
  }

  res.json({ message: 'Subscription activated', plan, subEnd });
});

// POST /api/user/cancel
router.post('/cancel', authenticate, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET sub_status = 'cancelled' WHERE id = ?").run(req.user.id);
  res.json({ message: 'Subscription cancelled' });
});

// POST /api/user/winnings/:id/proof
router.post('/winnings/:id/proof', authenticate, [
  body('proofImage')
    .isString()
    .withMessage('Proof image is required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { proofImage } = req.body;
  if (!proofImage.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Proof must be an image upload.' });
  }
  if (proofImage.length > 2_500_000) {
    return res.status(400).json({ error: 'Proof image is too large. Please upload a smaller screenshot.' });
  }

  const db = getDb();
  const win = db.prepare(`
    SELECT id, prize_tier, pay_status
    FROM draw_entries
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!win || !win.prize_tier) return res.status(404).json({ error: 'Winning entry not found.' });
  if (win.pay_status === 'paid') return res.status(400).json({ error: 'Payment has already been completed for this win.' });

  db.prepare(`
    UPDATE draw_entries
    SET proof_url = ?,
        proof_status = 'submitted',
        proof_submitted_at = datetime('now'),
        proof_note = NULL
    WHERE id = ?
  `).run(proofImage, req.params.id);

  const updatedWin = db.prepare(`
    SELECT de.*, d.title, d.month, d.year
    FROM draw_entries de
    JOIN draws d ON d.id = de.draw_id
    WHERE de.id = ?
  `).get(req.params.id);

  res.json({ message: 'Proof uploaded successfully.', win: updatedWin });
});

module.exports = router;
