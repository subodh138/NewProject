const TIER_SPLITS = {
  '5-match': 0.4,
  '4-match': 0.35,
  '3-match': 0.25,
};

function getPrizeTier(matched) {
  if (matched === 5) return '5-match';
  if (matched === 4) return '4-match';
  if (matched === 3) return '3-match';
  return null;
}

function parseScores(rawValue) {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

async function getLatestScoresForUser(db, userId) {
  const scores = await db
    .prepare('SELECT score FROM scores WHERE user_id = ? ORDER BY played_date DESC LIMIT 5')
    .all(userId);

  return scores.map((row) => row.score);
}

async function hydrateEntryScores(db, entry) {
  const storedScores = parseScores(entry.submitted_scores);
  if (storedScores.length === 5) return storedScores;
  return getLatestScoresForUser(db, entry.user_id);
}

function createWinningNumbers(draw, participantCount = 0) {
  if (draw.draw_type !== 'algorithmic') {
    const nums = [];
    while (nums.length < 5) {
      const next = Math.floor(Math.random() * 45) + 1;
      if (!nums.includes(next)) nums.push(next);
    }
    return nums.sort((a, b) => a - b);
  }

  const seed = `${draw.year}-${draw.month}-${participantCount}-${draw.title}`;
  const nums = [];
  let state = 0;

  for (const char of seed) {
    state = (state * 31 + char.charCodeAt(0)) % 2147483647;
  }

  while (nums.length < 5) {
    state = (state * 48271) % 2147483647;
    const next = (state % 45) + 1;
    if (!nums.includes(next)) nums.push(next);
  }

  return nums.sort((a, b) => a - b);
}

async function settleDrawEntries(db, draw) {
  const winningNums = parseScores(draw.winning_numbers);
  const entries = await db.prepare('SELECT * FROM draw_entries WHERE draw_id = ?').all(draw.id);

  const scoredEntries = [];
  for (const entry of entries) {
    const userNums = await hydrateEntryScores(db, entry);
    const matched = userNums.filter((score) => winningNums.includes(score)).length;
    const prizeTier = getPrizeTier(matched);

    scoredEntries.push({
      ...entry,
      userNums,
      matched,
      prizeTier,
    });
  }

  const tierCounts = scoredEntries.reduce((acc, entry) => {
    if (entry.prizeTier) {
      acc[entry.prizeTier] = (acc[entry.prizeTier] || 0) + 1;
    }
    return acc;
  }, {});

  const updateEntry = db.prepare(`
    UPDATE draw_entries
    SET matched = ?,
        prize_tier = ?,
        amount = ?,
        pay_status = ?,
        verified = ?,
        proof_status = ?,
        proof_note = ?,
        proof_submitted_at = CASE WHEN ? THEN proof_submitted_at ELSE NULL END
    WHERE id = ?
  `);

  for (const entry of scoredEntries) {
    const winnersInTier = entry.prizeTier ? tierCounts[entry.prizeTier] || 0 : 0;
    const amount = entry.prizeTier && winnersInTier
      ? Number(((draw.total_pool * TIER_SPLITS[entry.prizeTier]) / winnersInTier).toFixed(2))
      : 0;
    const hasProof = Boolean(entry.proof_url);

    await updateEntry.run(
      entry.matched,
      entry.prizeTier,
      amount,
      entry.prizeTier ? 'pending' : 'n/a',
      0,
      entry.prizeTier ? (hasProof ? 'submitted' : 'required') : 'not_required',
      entry.prizeTier ? entry.proof_note : null,
      hasProof,
      entry.id
    );
  }

  return {
    winningNums,
    tierCounts,
    totalParticipants: entries.length,
    scoredEntries,
  };
}

async function recalculatePublishedDraw(db, drawId) {
  const draw = await db.prepare('SELECT * FROM draws WHERE id = ?').get(drawId);
  if (!draw || !draw.winning_numbers) return null;
  return settleDrawEntries(db, draw);
}

module.exports = {
  TIER_SPLITS,
  createWinningNumbers,
  getLatestScoresForUser,
  getPrizeTier,
  parseScores,
  recalculatePublishedDraw,
  settleDrawEntries,
};
