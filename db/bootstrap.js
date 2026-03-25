const { getDb } = require('./database');
const { DEFAULT_DEMO_USER, seedDatabase } = require('./seedData');

let bootstrapped = false;

function readBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function bootstrapRuntimeData() {
  if (bootstrapped) {
    return;
  }

  const db = getDb();
  const shouldSeedPublicData = readBooleanEnv('BOOTSTRAP_PUBLIC_DATA', false);
  const shouldSeedDemoUser = readBooleanEnv('SEED_DEMO_USER', false);
  const shouldSeedAdmin = Boolean(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD);

  if (shouldSeedPublicData || shouldSeedAdmin || shouldSeedDemoUser) {
    const summary = await seedDatabase({
      db,
      includeSampleData: shouldSeedPublicData,
      createAdmin: shouldSeedAdmin,
      admin: {
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
        name: process.env.SEED_ADMIN_NAME || 'GreenGive Admin',
      },
      createDemoUser: shouldSeedDemoUser,
      demoUser: {
        ...DEFAULT_DEMO_USER,
        email: process.env.SEED_DEMO_EMAIL || DEFAULT_DEMO_USER.email,
        password: process.env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_USER.password,
        name: process.env.SEED_DEMO_NAME || DEFAULT_DEMO_USER.name,
      },
      log: (message) => console.log(`[bootstrap] ${message}`),
    });

    console.log(
      `[bootstrap] Seed complete (publicData=${shouldSeedPublicData}, admin=${summary.adminCreated}, demo=${summary.demoUserCreated})`
    );
  }

  bootstrapped = true;
}

module.exports = { bootstrapRuntimeData, readBooleanEnv };
