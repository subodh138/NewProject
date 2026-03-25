const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'greengive.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'subscriber',
      plan        TEXT DEFAULT NULL,
      sub_status  TEXT DEFAULT 'inactive',
      sub_end     TEXT DEFAULT NULL,
      charity_id  TEXT DEFAULT NULL,
      charity_pct INTEGER DEFAULT 10,
      handicap    INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Charities
    CREATE TABLE IF NOT EXISTS charities (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT,
      icon        TEXT DEFAULT '🌿',
      featured    INTEGER DEFAULT 0,
      total_raised REAL DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Scores (rolling 5 per user)
    CREATE TABLE IF NOT EXISTS scores (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      score       INTEGER NOT NULL CHECK(score BETWEEN 1 AND 45),
      played_date TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Draws
    CREATE TABLE IF NOT EXISTS draws (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      month           INTEGER NOT NULL,
      year            INTEGER NOT NULL,
      draw_type       TEXT DEFAULT 'random',
      status          TEXT DEFAULT 'pending',
      winning_numbers TEXT DEFAULT NULL,
      jackpot_carried REAL DEFAULT 0,
      total_pool      REAL DEFAULT 0,
      published_at    TEXT DEFAULT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Draw entries / results
    CREATE TABLE IF NOT EXISTS draw_entries (
      id          TEXT PRIMARY KEY,
      draw_id     TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      matched     INTEGER DEFAULT 0,
      prize_tier  TEXT DEFAULT NULL,
      amount      REAL DEFAULT 0,
      pay_status  TEXT DEFAULT 'pending',
      verified    INTEGER DEFAULT 0,
      proof_url   TEXT DEFAULT NULL,
      FOREIGN KEY(draw_id) REFERENCES draws(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Payments / subscriptions log
    CREATE TABLE IF NOT EXISTS payments (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      plan        TEXT NOT NULL,
      amount      REAL NOT NULL,
      status      TEXT DEFAULT 'completed',
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

module.exports = { getDb };
