const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

const db = getDb();

console.log('🌱 Seeding database...');

// ── Admin User ──
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@greengive.com');
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@12345', 10);
  db.prepare(`INSERT INTO users (id,name,email,password,role,sub_status) VALUES (?,?,?,?,?,?)`)
    .run(uuidv4(), 'GreenGive Admin', 'admin@greengive.com', hash, 'admin', 'active');
  console.log('✅ Admin created  →  admin@greengive.com  /  Admin@12345');
}

// ── Demo Subscriber ──
const demoExists = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@greengive.com');
if (!demoExists) {
  const hash = bcrypt.hashSync('Demo@12345', 10);
  const userId = uuidv4();
  const subEnd = new Date(); subEnd.setMonth(subEnd.getMonth() + 1);
  db.prepare(`INSERT INTO users (id,name,email,password,role,plan,sub_status,sub_end) VALUES (?,?,?,?,?,?,?,?)`)
    .run(userId, 'Jamie Fairway', 'demo@greengive.com', hash, 'subscriber', 'monthly', 'active', subEnd.toISOString());
  // seed scores
  const scores = [32, 28, 35, 30, 27];
  const scoreStmt = db.prepare('INSERT INTO scores (id,user_id,score,played_date) VALUES (?,?,?,?)');
  scores.forEach((s, i) => {
    const d = new Date(); d.setDate(d.getDate() - i * 7);
    scoreStmt.run(uuidv4(), userId, s, d.toISOString().split('T')[0]);
  });
  console.log('✅ Demo subscriber  →  demo@greengive.com  /  Demo@12345');
}

// ── Charities ──
const charities = [
  { name: 'Children First Foundation', description: 'Providing education and safe environments for underprivileged children worldwide.', category: 'Children', icon: '👧', featured: 1 },
  { name: 'Green Earth Alliance', description: 'Reforestation and climate action initiatives across three continents.', category: 'Environment', icon: '🌍', featured: 0 },
  { name: 'Veterans Support Network', description: 'Mental health and career rehabilitation for military veterans and their families.', category: 'Veterans', icon: '🎖️', featured: 0 },
  { name: 'Food Bank International', description: 'Fighting hunger with community food programs and supply chain logistics.', category: 'Hunger', icon: '🍽️', featured: 0 },
  { name: 'Sight For All', description: 'Free eye care and corrective surgery for communities without medical access.', category: 'Health', icon: '👁️', featured: 0 },
  { name: 'Ocean Clean Collective', description: 'Removing plastic from oceans and educating coastal communities.', category: 'Environment', icon: '🌊', featured: 0 },
];

const charityStmt = db.prepare(`INSERT OR IGNORE INTO charities (id,name,description,category,icon,featured,total_raised) VALUES (?,?,?,?,?,?,?)`);
charities.forEach(c => {
  charityStmt.run(uuidv4(), c.name, c.description, c.category, c.icon, c.featured, Math.floor(Math.random() * 8000) + 500);
});
console.log('✅ Charities seeded');

// ── Sample Draw ──
const drawExists = db.prepare('SELECT id FROM draws WHERE status = ?').get('published');
if (!drawExists) {
  const now = new Date();
  db.prepare(`INSERT INTO draws (id,title,month,year,draw_type,status,winning_numbers,total_pool,published_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(uuidv4(), `${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()} Draw`, now.getMonth()+1, now.getFullYear(), 'random', 'published', JSON.stringify([12,28,35,19,7]), 2400, now.toISOString());
  console.log('✅ Sample draw seeded');
}

const pendingDrawExists = db.prepare('SELECT id FROM draws WHERE status = ?').get('pending');
if (!pendingDrawExists) {
  const nextDrawDate = new Date();
  nextDrawDate.setMonth(nextDrawDate.getMonth() + 1);
  db.prepare(`INSERT INTO draws (id,title,month,year,draw_type,status,jackpot_carried,total_pool) VALUES (?,?,?,?,?,?,?,?)`)
    .run(
      uuidv4(),
      `${nextDrawDate.toLocaleString('default', { month: 'long' })} ${nextDrawDate.getFullYear()} Draw`,
      nextDrawDate.getMonth() + 1,
      nextDrawDate.getFullYear(),
      'random',
      'pending',
      0,
      2600
    );
  console.log('✅ Upcoming pending draw seeded');
}

console.log('\n🏌️ Database ready. Run: npm run dev\n');
