const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const SCHEMA_PATH = path.join(__dirname, 'schema.postgres.sql');

let pool;
let db;
let initPromise;

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Set it to your Supabase Postgres connection string.');
  }

  return process.env.DATABASE_URL;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 10000,
      allowExitOnIdle: process.env.NODE_ENV !== 'production',
    });
  }

  return pool;
}

function normalizeSql(sqlText) {
  const withTimestamps = sqlText.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
  let normalized = '';
  let placeholderIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < withTimestamps.length; index += 1) {
    const char = withTimestamps[index];
    const nextChar = withTimestamps[index + 1];

    if (char === "'" && !inDoubleQuote) {
      normalized += char;

      if (inSingleQuote && nextChar === "'") {
        normalized += nextChar;
        index += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }

      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      normalized += char;
      continue;
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      normalized += `$${placeholderIndex}`;
      placeholderIndex += 1;
      continue;
    }

    normalized += char;
  }

  return normalized;
}

function createStatement(executor, sqlText) {
  const normalized = normalizeSql(sqlText);

  return {
    async get(...params) {
      const result = await executor.query(normalized, params);
      return result.rows[0];
    },

    async all(...params) {
      const result = await executor.query(normalized, params);
      return result.rows;
    },

    async run(...params) {
      const result = await executor.query(normalized, params);
      return {
        changes: result.rowCount,
        rowCount: result.rowCount,
      };
    },
  };
}

function createDb(executor) {
  return {
    prepare(sqlText) {
      return createStatement(executor, sqlText);
    },

    async exec(sqlText) {
      await executor.query(sqlText);
    },

    async query(sqlText, params = []) {
      return executor.query(normalizeSql(sqlText), params);
    },

    async transaction(callback) {
      if (!executor.connect) {
        return callback(this);
      }

      const client = await executor.connect();
      const transactionDb = createDb(client);

      try {
        await client.query('BEGIN');
        const result = await callback(transactionDb);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function getDb() {
  if (!db) {
    db = createDb(getPool());
  }

  return db;
}

async function initializeDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
      await getDb().exec(schemaSql);
    })();
  }

  return initPromise;
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    initPromise = null;
  }
}

module.exports = {
  closeDb,
  getDatabaseUrl,
  getDb,
  initializeDatabase,
};
