const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { closeDb, initializeDatabase } = require('./database');

async function run() {
  await initializeDatabase();
  console.log('Postgres schema is ready.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
