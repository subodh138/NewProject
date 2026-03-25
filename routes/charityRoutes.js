const express = require('express');
const { body, validationResult } = require('express-validator');

const { getDb } = require('../db/database');
const { asyncHandler } = require('../lib/asyncHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const { search, category } = req.query;
  let query = 'SELECT * FROM charities WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY featured DESC, total_raised DESC';
  const charities = await db.prepare(query).all(...params);
  res.json(charities);
}));

router.get('/featured', asyncHandler(async (req, res) => {
  const db = getDb();
  const charity = await db.prepare('SELECT * FROM charities WHERE featured = 1 LIMIT 1').get();
  res.json(charity || null);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const charity = await db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found.' });
  res.json(charity);
}));

router.patch('/select', authenticate, [
  body('charityId').notEmpty(),
  body('charityPct').isInt({ min: 10, max: 100 }).withMessage('Percentage must be 10–100'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { charityId, charityPct } = req.body;
  const db = getDb();
  const charity = await db.prepare('SELECT id FROM charities WHERE id = ?').get(charityId);
  if (!charity) return res.status(404).json({ error: 'Charity not found.' });

  await db.prepare('UPDATE users SET charity_id = ?, charity_pct = ? WHERE id = ?')
    .run(charityId, charityPct, req.user.id);

  res.json({ message: 'Charity updated', charityId, charityPct });
}));

module.exports = router;
