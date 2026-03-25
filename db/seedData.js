const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_ADMIN = {
  name: 'GreenGive Admin',
  email: 'admin@greengive.com',
  password: 'Admin@12345',
};

const DEFAULT_DEMO_USER = {
  name: 'Jamie Fairway',
  email: 'demo@greengive.com',
  password: 'Demo@12345',
  plan: 'monthly',
  scores: [32, 28, 35, 30, 27],
};

const DEFAULT_CHARITIES = [
  {
    name: 'Children First Foundation',
    description: 'Providing education and safe environments for underprivileged children worldwide.',
    category: 'Children',
    icon: '👧',
    featured: 1,
  },
  {
    name: 'Green Earth Alliance',
    description: 'Reforestation and climate action initiatives across three continents.',
    category: 'Environment',
    icon: '🌍',
    featured: 0,
  },
  {
    name: 'Veterans Support Network',
    description: 'Mental health and career rehabilitation for military veterans and their families.',
    category: 'Veterans',
    icon: '🎖️',
    featured: 0,
  },
  {
    name: 'Food Bank International',
    description: 'Fighting hunger with community food programs and supply chain logistics.',
    category: 'Hunger',
    icon: '🍽️',
    featured: 0,
  },
  {
    name: 'Sight For All',
    description: 'Free eye care and corrective surgery for communities without medical access.',
    category: 'Health',
    icon: '👁️',
    featured: 0,
  },
  {
    name: 'Ocean Clean Collective',
    description: 'Removing plastic from oceans and educating coastal communities.',
    category: 'Environment',
    icon: '🌊',
    featured: 0,
  },
];

async function seedAdmin(db, admin, log) {
  const adminConfig = {
    ...DEFAULT_ADMIN,
    ...admin,
  };

  if (!adminConfig.email || !adminConfig.password) {
    return false;
  }

  const adminExists = await db.prepare('SELECT id FROM users WHERE email = ?').get(adminConfig.email);
  if (adminExists) {
    return false;
  }

  const hash = bcrypt.hashSync(adminConfig.password, 10);
  await db.prepare(`
    INSERT INTO users (id, name, email, password, role, sub_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), adminConfig.name, adminConfig.email, hash, 'admin', 'active');

  log(`Admin created  ->  ${adminConfig.email}`);
  return true;
}

async function seedDemoUser(db, demoUser, log) {
  const demoConfig = {
    ...DEFAULT_DEMO_USER,
    ...demoUser,
  };

  if (!demoConfig.email || !demoConfig.password) {
    return false;
  }

  const demoExists = await db.prepare('SELECT id FROM users WHERE email = ?').get(demoConfig.email);
  if (demoExists) {
    return false;
  }

  const hash = bcrypt.hashSync(demoConfig.password, 10);
  const userId = uuidv4();
  const subEnd = new Date();
  subEnd.setMonth(subEnd.getMonth() + 1);

  await db.prepare(`
    INSERT INTO users (id, name, email, password, role, plan, sub_status, sub_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    demoConfig.name,
    demoConfig.email,
    hash,
    'subscriber',
    demoConfig.plan || 'monthly',
    'active',
    subEnd.toISOString()
  );

  const scoreStmt = db.prepare('INSERT INTO scores (id, user_id, score, played_date) VALUES (?, ?, ?, ?)');
  for (const [index, score] of demoConfig.scores.entries()) {
    const playedDate = new Date();
    playedDate.setDate(playedDate.getDate() - index * 7);
    await scoreStmt.run(uuidv4(), userId, score, playedDate.toISOString().split('T')[0]);
  }

  log(`Demo subscriber created  ->  ${demoConfig.email}`);
  return true;
}

async function seedCharities(db, log) {
  let created = 0;

  const existingNames = new Set(
    (await db.prepare('SELECT name FROM charities').all()).map((charity) => charity.name)
  );
  const charityStmt = db.prepare(`
    INSERT INTO charities (id, name, description, category, icon, featured, total_raised)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const charity of DEFAULT_CHARITIES) {
    if (existingNames.has(charity.name)) {
      continue;
    }

    await charityStmt.run(
      uuidv4(),
      charity.name,
      charity.description,
      charity.category,
      charity.icon,
      charity.featured,
      Math.floor(Math.random() * 8000) + 500
    );
    created += 1;
  }

  if (created > 0) {
    log(`Charities seeded  ->  ${created} inserted`);
  }

  return created;
}

async function seedDraws(db, log) {
  let created = 0;

  const publishedDrawExists = await db.prepare('SELECT id FROM draws WHERE status = ?').get('published');
  if (!publishedDrawExists) {
    const now = new Date();
    await db.prepare(`
      INSERT INTO draws (id, title, month, year, draw_type, status, winning_numbers, total_pool, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()} Draw`,
      now.getMonth() + 1,
      now.getFullYear(),
      'random',
      'published',
      JSON.stringify([12, 28, 35, 19, 7]),
      2400,
      now.toISOString()
    );
    created += 1;
  }

  const pendingDrawExists = await db.prepare('SELECT id FROM draws WHERE status = ?').get('pending');
  if (!pendingDrawExists) {
    const nextDrawDate = new Date();
    nextDrawDate.setMonth(nextDrawDate.getMonth() + 1);

    await db.prepare(`
      INSERT INTO draws (id, title, month, year, draw_type, status, jackpot_carried, total_pool)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      `${nextDrawDate.toLocaleString('default', { month: 'long' })} ${nextDrawDate.getFullYear()} Draw`,
      nextDrawDate.getMonth() + 1,
      nextDrawDate.getFullYear(),
      'random',
      'pending',
      0,
      2600
    );
    created += 1;
  }

  if (created > 0) {
    log(`Sample draws seeded  ->  ${created} inserted`);
  }

  return created;
}

async function seedDatabase(options = {}) {
  const {
    db,
    createAdmin = false,
    admin = DEFAULT_ADMIN,
    createDemoUser = false,
    demoUser = DEFAULT_DEMO_USER,
    includeSampleData = true,
    log = () => {},
  } = options;

  if (!db) {
    throw new Error('A database connection is required to seed data.');
  }

  return {
    adminCreated: createAdmin ? await seedAdmin(db, admin, log) : false,
    demoUserCreated: createDemoUser ? await seedDemoUser(db, demoUser, log) : false,
    charitiesCreated: includeSampleData ? await seedCharities(db, log) : 0,
    drawsCreated: includeSampleData ? await seedDraws(db, log) : 0,
  };
}

module.exports = {
  DEFAULT_ADMIN,
  DEFAULT_DEMO_USER,
  seedDatabase,
};
