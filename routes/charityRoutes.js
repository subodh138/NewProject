const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/charities
router.get('/', (req, res) => {
  const db = getDb();
  const { search, category } = req.query;
  let query = 'SELECT * FROM charities WHERE 1=1';
  const params = [];
  if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY featured DESC, total_raised DESC';
  res.json(db.prepare(query).all(...params));
});

// GET /api/charities/featured
router.get('/featured', (req, res) => {
  const db = getDb();
  const charity = db.prepare('SELECT * FROM charities WHERE featured = 1 LIMIT 1').get();
  res.json(charity || null);
});

// GET /api/charities/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const charity = db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found.' });
  res.json(charity);
});

// PATCH /api/charities/select — user selects a charity
router.patch('/select', authenticate, [
  body('charityId').notEmpty(),
  body('charityPct').isInt({ min: 10, max: 100 }).withMessage('Percentage must be 10–100'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { charityId, charityPct } = req.body;
  const db = getDb();
  const charity = db.prepare('SELECT id FROM charities WHERE id = ?').get(charityId);
  if (!charity) return res.status(404).json({ error: 'Charity not found.' });

  db.prepare('UPDATE users SET charity_id = ?, charity_pct = ? WHERE id = ?')
    .run(charityId, charityPct, req.user.id);

  res.json({ message: 'Charity updated', charityId, charityPct });
});

module.exports = router;
