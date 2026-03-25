const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const { closeDb, getDb, initializeDatabase } = require('./database');

const SQLITE_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(__dirname, 'greengive.db');

const TABLES = [
  'charities',
  'users',
  'draws',
  'scores',
  'payments',
  'draw_entries',
];

function loadTableRows(sqlite, tableName) {
  return sqlite.prepare(`SELECT * FROM ${tableName}`).all();
}

function buildUpsert(tableName, columns) {
  const placeholders = columns.map(() => '?').join(', ');
  const assignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ');

  return `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${assignments}
  `;
}

async function ensureTargetIsEmpty(db) {
  const counts = {};

  for (const tableName of TABLES) {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
    counts[tableName] = row.count;
  }

  const hasExistingData = Object.values(counts).some((count) => count > 0);
  if (hasExistingData && process.env.IMPORT_TRUNCATE !== 'true') {
    throw new Error(
      `Target database is not empty: ${JSON.stringify(counts)}. Use a fresh Supabase database or rerun with IMPORT_TRUNCATE=true.`
    );
  }

  if (hasExistingData) {
    for (const tableName of [...TABLES].reverse()) {
      await db.prepare(`TRUNCATE TABLE ${tableName} CASCADE`).run();
    }
  }
}

async function importTable(db, sqlite, tableName) {
  const rows = loadTableRows(sqlite, tableName);
  if (!rows.length) {
    console.log(`- ${tableName}: 0 rows`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const statement = db.prepare(buildUpsert(tableName, columns));

  for (const row of rows) {
    await statement.run(...columns.map((column) => row[column]));
  }

  console.log(`- ${tableName}: ${rows.length} rows`);
}

async function run() {
  console.log(`Importing SQLite data from ${SQLITE_PATH}`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  try {
    await initializeDatabase();
    const db = getDb();

    await ensureTargetIsEmpty(db);
    await db.transaction(async (tx) => {
      for (const tableName of TABLES) {
        await importTable(tx, sqlite, tableName);
      }
    });

    console.log('\nSQLite data import complete.');
  } finally {
    sqlite.close();
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
