const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { closeDb, getDb, initializeDatabase } = require('./database');
const { DEFAULT_ADMIN, DEFAULT_DEMO_USER, seedDatabase } = require('./seedData');

async function run() {
  await initializeDatabase();
  const db = getDb();

  console.log('Seeding database...');

  const summary = await seedDatabase({
    db,
    createAdmin: true,
    admin: {
      email: process.env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN.email,
      password: process.env.SEED_ADMIN_PASSWORD || DEFAULT_ADMIN.password,
      name: process.env.SEED_ADMIN_NAME || DEFAULT_ADMIN.name,
    },
    createDemoUser: true,
    demoUser: {
      email: process.env.SEED_DEMO_EMAIL || DEFAULT_DEMO_USER.email,
      password: process.env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_USER.password,
      name: process.env.SEED_DEMO_NAME || DEFAULT_DEMO_USER.name,
    },
    includeSampleData: true,
    log: (message) => console.log(`- ${message}`),
  });

  console.log('\nDatabase ready.');
  console.log(`Admin created: ${summary.adminCreated ? 'yes' : 'no (already existed)'}`);
  console.log(`Demo user created: ${summary.demoUserCreated ? 'yes' : 'no (already existed)'}`);
  console.log(`Charities inserted: ${summary.charitiesCreated}`);
  console.log(`Draws inserted: ${summary.drawsCreated}`);
  console.log('\nRun: npm run dev\n');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
