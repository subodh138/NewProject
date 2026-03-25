const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { closeDb, getDb, initializeDatabase } = require('./database');

async function run() {
  await initializeDatabase();
  const db = getDb();
  const result = await db.query('SELECT current_database() AS database_name, current_user AS database_user, NOW() AS connected_at');

  console.log('Supabase connection successful.');
  console.log(JSON.stringify(result.rows[0], null, 2));
}

run()
  .catch((error) => {
    console.error('Supabase connection failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
