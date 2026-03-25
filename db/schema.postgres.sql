CREATE TABLE IF NOT EXISTS charities (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  icon         TEXT DEFAULT '🌿',
  featured     INTEGER DEFAULT 0,
  total_raised NUMERIC(12, 2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'subscriber',
  plan        TEXT DEFAULT NULL,
  sub_status  TEXT DEFAULT 'inactive',
  sub_end     TIMESTAMPTZ DEFAULT NULL,
  charity_id  TEXT DEFAULT NULL,
  charity_pct INTEGER DEFAULT 10,
  handicap    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_charity_id_fkey
    FOREIGN KEY (charity_id) REFERENCES charities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 45),
  played_date DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS draws (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  draw_type       TEXT DEFAULT 'random',
  status          TEXT DEFAULT 'pending',
  winning_numbers TEXT DEFAULT NULL,
  jackpot_carried NUMERIC(12, 2) DEFAULT 0,
  total_pool      NUMERIC(12, 2) DEFAULT 0,
  published_at    TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS draw_entries (
  id                 TEXT PRIMARY KEY,
  draw_id            TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched            INTEGER DEFAULT 0,
  prize_tier         TEXT DEFAULT NULL,
  amount             NUMERIC(12, 2) DEFAULT 0,
  pay_status         TEXT DEFAULT 'pending',
  verified           INTEGER DEFAULT 0,
  proof_url          TEXT DEFAULT NULL,
  submitted_scores   TEXT DEFAULT NULL,
  entered_at         TIMESTAMPTZ DEFAULT NULL,
  proof_status       TEXT DEFAULT 'not_required',
  proof_submitted_at TIMESTAMPTZ DEFAULT NULL,
  proof_note         TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_draw_entries_unique_user_draw
  ON draw_entries(draw_id, user_id);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL,
  status     TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scores_user_played_date
  ON scores(user_id, played_date DESC);

CREATE INDEX IF NOT EXISTS idx_draws_status_year_month
  ON draws(status, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS idx_draw_entries_user_id
  ON draw_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON payments(user_id);
