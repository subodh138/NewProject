const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { getDb } = require('../db/database');
const { asyncHandler } = require('../lib/asyncHandler');
const { createWinningNumbers, settleDrawEntries } = require('../lib/drawEngine');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

async function getCarryForwardAmount(db) {
  const latestPublishedDraw = await db.prepare(`
    SELECT jackpot_carried
    FROM draws
    WHERE status = 'published'
    ORDER BY year DESC, month DESC, created_at DESC
    LIMIT 1
  `).get();

  return Number(latestPublishedDraw?.jackpot_carried || 0);
}

router.get('/analytics', asyncHandler(async (req, res) => {
  const db = getDb();
  const totalUsers = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get();
  const activeSubsCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE sub_status = 'active'").get();
  const totalRevenue = await db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE status = 'completed'").get();
  const charityTotal = await db.prepare("SELECT COALESCE(SUM(total_raised),0) as t FROM charities").get();
  const drawCount = await db.prepare("SELECT COUNT(*) as c FROM draws").get();
  const pendingWinners = await db.prepare("SELECT COUNT(*) as c FROM draw_entries WHERE prize_tier IS NOT NULL AND pay_status = 'pending'").get();
  const recentUsers = await db.prepare("SELECT id,name,email,plan,sub_status,created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC LIMIT 8").all();
  const recentDraws = await db.prepare("SELECT * FROM draws ORDER BY created_at DESC LIMIT 5").all();

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
}));

router.get('/users', asyncHandler(async (req, res) => {
  const db = getDb();
  const { search, status } = req.query;
  let query = "SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,created_at FROM users WHERE role != 'admin'";
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    query += ' AND sub_status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const users = await db.prepare(query).all(...params);
  res.json(users);
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const user = await db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct,handicap,created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const scores = await db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY played_date DESC').all(req.params.id);
  const wins = await db.prepare('SELECT * FROM draw_entries WHERE user_id = ? AND prize_tier IS NOT NULL').all(req.params.id);
  res.json({ ...user, scores, wins });
}));

router.patch('/users/:id', [
  body('name').optional().trim().notEmpty(),
  body('sub_status').optional().isIn(['active', 'inactive', 'cancelled', 'lapsed']),
  body('plan').optional().isIn(['monthly', 'yearly', '']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const allowed = ['name', 'plan', 'sub_status', 'sub_end', 'charity_id', 'charity_pct', 'handicap'];
  const updates = Object.keys(req.body).filter((key) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });

  const sets = updates.map((key) => `${key} = ?`).join(', ');
  const values = updates.map((key) => req.body[key]);
  await db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...values, req.params.id);

  const updated = await db.prepare('SELECT id,name,email,role,plan,sub_status,sub_end,charity_id,charity_pct FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ message: 'User deleted' });
}));

router.patch('/users/:uid/scores/:sid', [
  body('score').isInt({ min: 1, max: 45 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  await db.prepare('UPDATE scores SET score = ? WHERE id = ? AND user_id = ?').run(req.body.score, req.params.sid, req.params.uid);
  res.json({ message: 'Score updated' });
}));

router.get('/draws', asyncHandler(async (req, res) => {
  const db = getDb();
  const draws = await db.prepare('SELECT * FROM draws ORDER BY year DESC, month DESC').all();
  res.json(draws);
}));

router.post('/draws', [
  body('title').notEmpty(),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2024 }),
  body('drawType').isIn(['random', 'algorithmic']),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, month, year, drawType } = req.body;
  const db = getDb();

  const activeSubs = await db.prepare("SELECT COUNT(*) as c FROM users WHERE sub_status = 'active'").get();
  const avgSubPrice = 9.99;
  const basePool = activeSubs.c * avgSubPrice * 0.60;
  const carryForward = await getCarryForwardAmount(db);
  const totalPool = Number((basePool + carryForward).toFixed(2));

  const id = uuidv4();
  await db.prepare('INSERT INTO draws (id,title,month,year,draw_type,status,jackpot_carried,total_pool) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title, month, year, drawType, 'pending', carryForward, totalPool);

  const draw = await db.prepare('SELECT * FROM draws WHERE id = ?').get(id);
  res.status(201).json(draw);
}));

router.post('/draws/:id/simulate', asyncHandler(async (req, res) => {
  const db = getDb();
  const draw = await db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found.' });

  const subscribers = await db.prepare("SELECT id FROM users WHERE sub_status = 'active'").all();
  const nums = createWinningNumbers(draw, subscribers.length);
  const results = [];

  for (const subscriber of subscribers) {
    const scores = await db.prepare('SELECT score FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5').all(subscriber.id);
    const userNums = scores.map((row) => row.score);
    const matched = userNums.filter((value) => nums.includes(value)).length;
    results.push({ userId: subscriber.id, matched });
  }

  const summary = { 5: 0, 4: 0, 3: 0, none: 0 };
  results.forEach((result) => {
    if (result.matched === 5) summary[5] += 1;
    else if (result.matched === 4) summary[4] += 1;
    else if (result.matched === 3) summary[3] += 1;
    else summary.none += 1;
  });

  res.json({ simulatedNumbers: nums, results: summary, totalParticipants: subscribers.length });
}));

router.post('/draws/:id/publish', asyncHandler(async (req, res) => {
  const db = getDb();
  const draw = await db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found.' });
  if (draw.status === 'published') return res.status(400).json({ error: 'Draw already published.' });

  const participantCountRow = await db.prepare('SELECT COUNT(*) as c FROM draw_entries WHERE draw_id = ?').get(req.params.id);
  const nums = createWinningNumbers(draw, participantCountRow.c);

  await db.prepare(`
    UPDATE draws
    SET status = 'published',
        winning_numbers = ?,
        published_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(nums), req.params.id);

  const publishedDraw = await db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  const settled = await settleDrawEntries(db, publishedDraw);
  const jackpotRollover = settled.tierCounts['5-match']
    ? 0
    : Number((publishedDraw.total_pool * 0.40).toFixed(2));

  await db.prepare('UPDATE draws SET jackpot_carried = ? WHERE id = ?').run(jackpotRollover, req.params.id);

  if (jackpotRollover > 0) {
    const nextPendingDraw = await db.prepare(`
      SELECT * FROM draws
      WHERE status = 'pending' AND id != ?
      ORDER BY year ASC, month ASC, created_at ASC
      LIMIT 1
    `).get(req.params.id);

    if (nextPendingDraw) {
      await db.prepare(`
        UPDATE draws
        SET jackpot_carried = COALESCE(jackpot_carried, 0) + ?,
            total_pool = total_pool + ?
        WHERE id = ?
      `).run(jackpotRollover, jackpotRollover, nextPendingDraw.id);
    }
  }

  res.json({
    message: 'Draw published',
    winningNumbers: nums,
    totalParticipants: settled.totalParticipants,
    winners: {
      fiveMatch: settled.tierCounts['5-match'] || 0,
      fourMatch: settled.tierCounts['4-match'] || 0,
      threeMatch: settled.tierCounts['3-match'] || 0,
    },
    jackpotRollover,
  });
}));

router.post('/charities', [
  body('name').notEmpty(),
  body('description').notEmpty(),
  body('category').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, category, icon, featured } = req.body;
  const db = getDb();
  const id = uuidv4();
  await db.prepare('INSERT INTO charities (id,name,description,category,icon,featured) VALUES (?,?,?,?,?,?)').run(
    id,
    name,
    description,
    category,
    icon || '🌿',
    featured ? 1 : 0
  );
  const charity = await db.prepare('SELECT * FROM charities WHERE id = ?').get(id);
  res.status(201).json(charity);
}));

router.patch('/charities/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const charity = await db.prepare('SELECT id FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found.' });

  const allowed = ['name', 'description', 'category', 'icon', 'featured'];
  const updates = Object.keys(req.body).filter((key) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });

  const sets = updates.map((key) => `${key} = ?`).join(', ');
  await db.prepare(`UPDATE charities SET ${sets} WHERE id = ?`).run(...updates.map((key) => req.body[key]), req.params.id);
  const updated = await db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  res.json(updated);
}));

router.delete('/charities/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM charities WHERE id = ?').run(req.params.id);
  res.json({ message: 'Charity deleted' });
}));

router.get('/winners', asyncHandler(async (req, res) => {
  const db = getDb();
  const winners = await db.prepare(`
    SELECT de.*, u.name, u.email, d.title, d.month, d.year
    FROM draw_entries de
    JOIN users u ON u.id = de.user_id
    JOIN draws d ON d.id = de.draw_id
    WHERE de.prize_tier IS NOT NULL
    ORDER BY d.year DESC, d.month DESC
  `).all();
  res.json(winners);
}));

router.patch('/winners/:id/verify', asyncHandler(async (req, res) => {
  const db = getDb();
  const winner = await db.prepare('SELECT id, proof_url, prize_tier FROM draw_entries WHERE id = ?').get(req.params.id);
  if (!winner || !winner.prize_tier) return res.status(404).json({ error: 'Winner entry not found.' });
  if (!winner.proof_url) return res.status(400).json({ error: 'Winner proof is still required before approval.' });

  await db.prepare(`
    UPDATE draw_entries
    SET verified = 1,
        proof_status = 'approved',
        proof_note = NULL,
        pay_status = 'verified'
    WHERE id = ?
  `).run(req.params.id);

  res.json({ message: 'Winner verified' });
}));

router.patch('/winners/:id/reject', [
  body('note').trim().notEmpty().withMessage('A rejection reason is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const winner = await db.prepare('SELECT id, prize_tier FROM draw_entries WHERE id = ?').get(req.params.id);
  if (!winner || !winner.prize_tier) return res.status(404).json({ error: 'Winner entry not found.' });

  await db.prepare(`
    UPDATE draw_entries
    SET verified = 0,
        proof_status = 'rejected',
        proof_note = ?,
        pay_status = 'pending'
    WHERE id = ?
  `).run(req.body.note.trim(), req.params.id);

  res.json({ message: 'Winner proof rejected' });
}));

router.patch('/winners/:id/pay', asyncHandler(async (req, res) => {
  const db = getDb();
  const winner = await db.prepare('SELECT id, verified, prize_tier FROM draw_entries WHERE id = ?').get(req.params.id);
  if (!winner || !winner.prize_tier) return res.status(404).json({ error: 'Winner entry not found.' });
  if (!winner.verified) return res.status(400).json({ error: 'Winner must be verified before marking as paid.' });

  await db.prepare("UPDATE draw_entries SET pay_status = 'paid' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Marked as paid' });
}));

module.exports = router;
