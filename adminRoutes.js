const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// ── ANALYTICS ──
router.get('/analytics', (req, res) => {
  const db = getDb();
  const totalUsers      = db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get();
  const activeSubsCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE sub_status = 'active'").get();
  const totalRevenue    = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE status = 'completed'").get();
  const charityTotal    = db.prepare("SELECT COALESCE(SUM(total_raised),0) as t FROM charities").get();
  const drawCount       = db.prepare("SELECT COUNT(*) as c FROM draws").get();
  const pendingWinners  = db.prepare("SELECT COUNT(*) as c FROM draw_entries WHERE prize_tier IS NOT NULL AND pay_status = 'pending'").get();
  const recentUsers     = db.prepare("SELECT id,name,email,plan,sub_status,created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC LIMIT 8").all();
  const recentDraws     = db.prepare("SELECT * FROM draws ORDER BY created_at DESC LIMIT 5").all();

  res.json({
    totalUsers: totalUsers.c,
    activeSubscribers: activeSubsCount.c,
    totalRevenue: totalRevenue.t,
    charityTotal: charityTotal.t,
    drawCount: drawCount.c,
    pendingWinners: pendingWinners.c,
    recentUsers,
    recentDraws,
  });
});

// ── USERS ──
router.get('/users', (req, res) => {
  const db = getDb();
  const { search, status } = req.query;
  let q = "SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,created_at FROM users WHERE role != 'admin'";
  const p = [];
  if (search) { q += ' AND (name LIKE ? OR email LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  if (status) { q += ' AND sub_status = ?'; p.push(status); }
  q += ' ORDER BY created_at DESC';
  res.json(db.prepare(q).all(...p));
});

router.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct,handicap,created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC').all(req.params.id);
  const wins = db.prepare('SELECT * FROM draw_entries WHERE user_id = ? AND prize_tier IS NOT NULL').all(req.params.id);
  res.json({ ...user, scores, wins });
});

router.patch('/users/:id', [
  body('name').optional().trim().notEmpty(),
  body('sub_status').optional().isIn(['active','inactive','cancelled','lapsed']),
  body('plan').optional().isIn(['monthly','yearly','']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const allowed = ['name','plan','sub_status','sub_end','charity_id','charity_pct','handicap'];
  const updates = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });

  const sets = updates.map(k => `${k} = ?`).join(', ');
  const vals = updates.map(k => req.body[k]);
  db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...vals, req.params.id);

  const updated = db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/users/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ message: 'User deleted' });
});

// Admin edit score for user
router.patch('/users/:uid/scores/:sid', [body('score').isInt({ min:1, max:45 })], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const db = getDb();
  db.prepare('UPDATE scores SET score = ? WHERE id = ? AND user_id = ?').run(req.body.score, req.params.sid, req.params.uid);
  res.json({ message: 'Score updated' });
});

// ── DRAWS ──
router.get('/draws', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM draws ORDER BY year DESC, month DESC').all());
});

router.post('/draws', [
  body('title').notEmpty(),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2024 }),
  body('drawType').isIn(['random', 'algorithmic']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, month, year, drawType } = req.body;
  const db = getDb();

  // Estimate prize pool from active subs
  const activeSubs = db.prepare("SELECT COUNT(*) as c FROM users WHERE sub_status = 'active'").get();
  const avgSubPrice = 9.99;
  const totalPool = parseFloat((activeSubs.c * avgSubPrice * 0.60).toFixed(2)); // 60% goes to prize

  const id = uuidv4();
  db.prepare('INSERT INTO draws (id,title,month,year,draw_type,status,total_pool) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, month, year, drawType, 'pending', totalPool);
  res.status(201).json(db.prepare('SELECT * FROM draws WHERE id = ?').get(id));
});

router.post('/draws/:id/simulate', (req, res) => {
  const db = getDb();
  const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found.' });

  // Random draw: pick 5 unique numbers from 1-45
  const nums = [];
  while (nums.length < 5) {
    const n = Math.floor(Math.random() * 45) + 1;
    if (!nums.includes(n)) nums.push(n);
  }

  // Simulate matches against all active subscribers
  const subs = db.prepare("SELECT id FROM users WHERE sub_status = 'active'").all();
  const results = subs.map(u => {
    const scores = db.prepare('SELECT score FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5').all(u.id);
    const userNums = scores.map(s => s.score);
    const matched = userNums.filter(n => nums.includes(n)).length;
    return { userId: u.id, matched };
  });

  const summary = { 5: 0, 4: 0, 3: 0, none: 0 };
  results.forEach(r => {
    if (r.matched === 5) summary[5]++;
    else if (r.matched === 4) summary[4]++;
    else if (r.matched === 3) summary[3]++;
    else summary.none++;
  });

  res.json({ simulatedNumbers: nums, results: summary, totalParticipants: subs.length });
});

router.post('/draws/:id/publish', (req, res) => {
  const db = getDb();
  const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found.' });

  const nums = [];
  while (nums.length < 5) {
    const n = Math.floor(Math.random() * 45) + 1;
    if (!nums.includes(n)) nums.push(n);
  }

  db.prepare(`UPDATE draws SET status = 'published', winning_numbers = ?, published_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(nums), req.params.id);

  res.json({ message: 'Draw published', winningNumbers: nums });
});

// ── CHARITIES (admin) ──
router.post('/charities', [
  body('name').notEmpty(),
  body('description').notEmpty(),
  body('category').notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, category, icon, featured } = req.body;
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO charities (id,name,description,category,icon,featured) VALUES (?,?,?,?,?,?)').run(id, name, description, category, icon || '🌿', featured ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM charities WHERE id = ?').get(id));
});

router.patch('/charities/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT id FROM charities WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Charity not found.' });

  const allowed = ['name','description','category','icon','featured'];
  const updates = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });

  const sets = updates.map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE charities SET ${sets} WHERE id = ?`).run(...updates.map(k => req.body[k]), req.params.id);
  res.json(db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id));
});

router.delete('/charities/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM charities WHERE id = ?').run(req.params.id);
  res.json({ message: 'Charity deleted' });
});

// ── WINNERS ──
router.get('/winners', (req, res) => {
  const db = getDb();
  const winners = db.prepare(`
    SELECT de.*, u.name, u.email, d.title, d.month, d.year
    FROM draw_entries de
    JOIN users u ON u.id = de.user_id
    JOIN draws d ON d.id = de.draw_id
    WHERE de.prize_tier IS NOT NULL
    ORDER BY d.year DESC, d.month DESC
  `).all();
  res.json(winners);
});

router.patch('/winners/:id/verify', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE draw_entries SET verified = 1, pay_status = 'verified' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Winner verified' });
});

router.patch('/winners/:id/pay', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE draw_entries SET pay_status = 'paid' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Marked as paid' });
});

module.exports = router;
