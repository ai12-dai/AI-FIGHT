// TEST MODE judge: a deterministic heuristic that runs on the game server with
// no external services. Same input -> same result; text length alone gives very
// little, structure, reasons, evidence markers and rebuttals give more.
import { finalizeVerdict } from './rules.js';

// \b does not work for Cyrillic, so word edges are written as letter look-arounds.
const W = (body) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, 'giu');
const RX = {
  reason: W('потому что|так как|поскольку|следовательно|поэтому|значит|в результате|благодаря|because|since|therefore|thus|hence|as a result|due to'),
  structure: W('во-первых|во-вторых|в-третьих|наконец|кроме того|также|итак|first(ly)?|second(ly)?|finally|moreover|in addition|furthermore'),
  evidence: /(\d+[.,]?\d*\s*%|\d{2,}|исследовани|статистик|данные|данных|опрос|например|к примеру|согласно|study|studies|research|survey|data|statistic|for example|for instance|according to)/giu,
  rebuttal: W('однако|хотя|но|тем не менее|оппонент\\p{L}*|противник\\p{L}*|критик\\p{L}*|возраз\\p{L}*|с другой стороны|however|although|but|opponents?|critics?|on the other hand|counter\\p{L}*|admittedly|even if'),
  noise: /(!!+|\?\?+|[A-ZА-ЯЁ]{6,}|дурак|идиот|глуп|stupid|idiot|dumb|lol)/g,
};

const count = (s, rx) => (s.match(rx) || []).length;
const stems = (s) => new Set((s.toLowerCase().match(/[\p{L}]{4,}/gu) || []).map((w) => w.slice(0, 5)));
const sat = (n, k) => 1 - Math.exp(-n / k); // saturating 0..1

function analyse(text, topic) {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const sentences = Math.max(1, (t.match(/[.!?…]+/g) || []).length);
  const topicStems = stems(topic);
  const own = stems(t);
  let overlap = 0;
  for (const s of topicStems) if (own.has(s)) overlap++;
  const f = {
    words: words.length,
    reasons: count(t, RX.reason),
    structure: count(t, RX.structure),
    evidence: count(t, RX.evidence),
    rebuttal: count(t, RX.rebuttal),
    noise: count(t, RX.noise),
    sentences,
    relevance: topicStems.size ? overlap / topicStems.size : 0.5,
    variety: words.length ? new Set(words.map((w) => w.toLowerCase())).size / words.length : 0,
  };
  const len = sat(f.words, 60); // diminishing returns: 120 words ~ 86%, 400 words ~ 100%
  const pen = Math.min(25, f.noise * 6);
  const crit = {
    logic: 35 + 30 * sat(f.reasons, 2) + 15 * sat(f.structure, 2) + 10 * Math.min(1, f.sentences / 4) + 5 * len - pen,
    persuasiveness: 35 + 20 * sat(f.reasons + f.evidence, 3) + 15 * f.variety + 10 * len + 8 * sat(f.rebuttal, 1) - pen,
    evidence: 30 + 40 * sat(f.evidence, 2) + 10 * sat(f.reasons, 3) + 5 * len - pen / 2,
    relevance: 40 + 50 * Math.min(1, f.relevance * 1.6) + 5 * len,
    rebuttal: 25 + 55 * sat(f.rebuttal, 1.5) + 5 * len,
  };
  for (const k in crit) crit[k] = Math.round(Math.max(5, Math.min(95, crit[k])));
  return { f, crit };
}

function notes(a, ru) {
  const s = [], w = [];
  const T = (r, e) => (ru ? r : e);
  if (a.f.reasons >= 2) s.push(T('Тезисы подкреплены причинно-следственными связями.', 'Claims are backed by cause-and-effect reasoning.'));
  else w.push(T('Мало объяснений «почему» — тезисы звучат как утверждения.', 'Few explanations of "why" — claims read as assertions.'));
  if (a.f.evidence >= 2) s.push(T('Есть примеры или конкретика (цифры, данные).', 'Uses examples or specifics (numbers, data).'));
  else w.push(T('Не хватает примеров, данных или конкретики.', 'Lacks examples, data or specifics.'));
  if (a.f.rebuttal >= 1) s.push(T('Учтена противоположная позиция.', 'Engages with the opposing view.'));
  else w.push(T('Позиция оппонента не рассматривается.', 'Does not address the opposing side.'));
  if (a.f.structure >= 2) s.push(T('Аргументация хорошо структурирована.', 'Well-structured argument.'));
  if (a.f.relevance < 0.3) w.push(T('Связь с темой спора выражена слабо.', 'Weak connection to the debate topic.'));
  else s.push(T('Аргументы держатся темы спора.', 'Stays on topic.'));
  if (a.f.noise > 0) w.push(T('Эмоциональные выпады вместо аргументов снижают оценку.', 'Emotional jabs instead of arguments lower the score.'));
  return { s: s.slice(0, 4), w: w.slice(0, 4) };
}

export function mockJudge({ topic, player1, player2 }) {
  const ru = /[а-яё]/i.test(topic + player1.argument + player2.argument);
  const a1 = analyse(player1.argument, topic);
  const a2 = analyse(player2.argument, topic);
  const n1 = notes(a1, ru), n2 = notes(a2, ru);
  const v = finalizeVerdict({
    player1_criteria: a1.crit,
    player2_criteria: a2.crit,
    player1_strengths: n1.s, player1_weaknesses: n1.w,
    player2_strengths: n2.s, player2_weaknesses: n2.w,
  }, { mode: 'test', model: 'test-judge' });
  const P1 = player1.name, P2 = player2.name;
  if (ru) {
    v.reasoning = v.winner === 'draw'
      ? `Тестовый судья оценил позиции почти одинаково (${v.player1_score} : ${v.player2_score}), поэтому ничья.`
      : `Тестовый судья нашёл у ${v.winner === 'player1' ? P1 : P2} больше обоснований, конкретики и работы с контраргументами (${v.player1_score} : ${v.player2_score}).`;
    v.final_verdict = v.winner === 'draw' ? 'Ничья. Обе стороны аргументировали на равных.' : `Победа: ${v.winner === 'player1' ? P1 : P2}.`;
  } else {
    v.reasoning = v.winner === 'draw'
      ? `The test judge scored both sides almost equally (${v.player1_score} : ${v.player2_score}), so it is a draw.`
      : `The test judge found more reasoning, specifics and rebuttals from ${v.winner === 'player1' ? P1 : P2} (${v.player1_score} : ${v.player2_score}).`;
    v.final_verdict = v.winner === 'draw' ? 'Draw. Both sides argued equally well.' : `Winner: ${v.winner === 'player1' ? P1 : P2}.`;
  }
  v.adjusted = false;
  return v;
}
