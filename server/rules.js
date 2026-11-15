// Rules shared by the browser and the server: input limits, the judging
// criteria with their weights, and how a verdict is normalised.

export const LIMITS = {
  nameMax: 20,
  topicMin: 5,
  topicMax: 200,
  argMin: 40,        // characters
  argMinWords: 6,
  argMax: 2000,
};

export const CRITERIA = [
  { key: 'logic', weight: 25, label: 'Логика', en: 'Logic' },
  { key: 'persuasiveness', weight: 25, label: 'Убедительность', en: 'Persuasiveness' },
  { key: 'evidence', weight: 25, label: 'Обоснованность', en: 'Evidence & accuracy' },
  { key: 'relevance', weight: 15, label: 'По теме', en: 'Relevance' },
  { key: 'rebuttal', weight: 10, label: 'Контраргументы', en: 'Rebuttal' },
];

// Draw band: totals this close are a draw no matter what.
export const DRAW_EPSILON = 1;
// The judge may call a draw when totals are within this many points.
export const DRAW_ALLOWED = 5;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function weightedTotal(c) {
  let sum = 0;
  for (const { key, weight } of CRITERIA) sum += clamp(Math.round(Number(c[key]) || 0), 0, 100) * weight;
  return Math.round(sum / 100);
}

/** Returns an error message (string) or null when the match input is valid. */
export function validateMatch(m) {
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  if (!m || typeof m !== 'object') return 'Нет данных матча.';
  const topic = String(m.topic ?? '').trim();
  if (topic.length < LIMITS.topicMin) return `Тема слишком короткая (минимум ${LIMITS.topicMin} символов).`;
  if (topic.length > LIMITS.topicMax) return `Тема слишком длинная (максимум ${LIMITS.topicMax}).`;
  for (const k of ['player1', 'player2']) {
    const p = m[k] || {};
    const label = k === 'player1' ? 'PLAYER 1' : 'PLAYER 2';
    const name = String(p.name ?? '').trim();
    const arg = String(p.argument ?? '').trim();
    if (!name) return `${label}: введите имя.`;
    if (name.length > LIMITS.nameMax) return `${label}: имя длиннее ${LIMITS.nameMax} символов.`;
    if (arg.length < LIMITS.argMin || words(arg) < LIMITS.argMinWords)
      return `${label}: аргумент слишком короткий (минимум ${LIMITS.argMin} символов и ${LIMITS.argMinWords} слов).`;
    if (arg.length > LIMITS.argMax) return `${label}: аргумент длиннее ${LIMITS.argMax} символов.`;
  }
  return null;
}

/**
 * Turn raw per-criterion scores + the judge's call into the final verdict.
 * Totals are always recomputed from the criteria with the official weights,
 * and the winner always agrees with the totals, so the result is consistent.
 */
export function finalizeVerdict(raw, meta = {}) {
  const c1 = {}, c2 = {};
  for (const { key } of CRITERIA) {
    c1[key] = clamp(Math.round(Number(raw.player1_criteria?.[key]) || 0), 0, 100);
    c2[key] = clamp(Math.round(Number(raw.player2_criteria?.[key]) || 0), 0, 100);
  }
  const s1 = weightedTotal(c1);
  const s2 = weightedTotal(c2);
  const diff = s1 - s2;
  let winner;
  if (Math.abs(diff) <= DRAW_EPSILON) winner = 'draw';
  else if (raw.winner === 'draw' && Math.abs(diff) <= DRAW_ALLOWED) winner = 'draw';
  else winner = diff > 0 ? 'player1' : 'player2';
  const list = (a) => (Array.isArray(a) ? a.map(String).filter(Boolean).slice(0, 6) : []);
  return {
    winner,
    player1_score: s1,
    player2_score: s2,
    player1_criteria: c1,
    player2_criteria: c2,
    player1_strengths: list(raw.player1_strengths),
    player1_weaknesses: list(raw.player1_weaknesses),
    player2_strengths: list(raw.player2_strengths),
    player2_weaknesses: list(raw.player2_weaknesses),
    reasoning: String(raw.reasoning || ''),
    final_verdict: String(raw.final_verdict || ''),
    confidence: raw.confidence || 'medium',
    adjusted: raw.winner !== undefined && raw.winner !== winner,
    ...meta,
  };
}
