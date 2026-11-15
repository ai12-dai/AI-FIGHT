import { validateMatch } from '@rules';

export class JudgeFailure extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/** Ask the game server's test judge for a verdict. */
export async function requestVerdict(match, signal) {
  const invalid = validateMatch(match);
  if (invalid) throw new JudgeFailure(invalid, 'invalid_input');
  let r;
  try {
    r = await fetch('/api/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(match),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new JudgeFailure('Нет связи с сервером игры. Проверьте интернет и попробуйте ещё раз.', 'network');
  }
  let data = null;
  try { data = await r.json(); } catch { /* non-JSON */ }
  if (!r.ok) throw new JudgeFailure(data?.message || `Ошибка сервера (${r.status}).`, data?.error || 'http');
  if (!data || !['player1', 'player2', 'draw'].includes(data.winner) || typeof data.player1_score !== 'number')
    throw new JudgeFailure('Сервер вернул некорректный результат.', 'bad_response');
  return data;
}
