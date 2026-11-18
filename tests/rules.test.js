import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeVerdict, validateMatch, weightedTotal } from '../server/rules.js';
import { mockJudge } from '../server/mockJudge.js';
import { buildFight } from '../client/src/game/script.js';

const c = (n) => ({ logic: n, persuasiveness: n, evidence: n, relevance: n, rebuttal: n });
const f = { moves: ['A', 'B', 'C'], finisher: 'F' };

test('weighted total uses 25/25/25/15/10', () => {
  assert.equal(weightedTotal({ logic: 100, persuasiveness: 0, evidence: 0, relevance: 0, rebuttal: 0 }), 25);
  assert.equal(weightedTotal({ logic: 0, persuasiveness: 0, evidence: 0, relevance: 100, rebuttal: 0 }), 15);
  assert.equal(weightedTotal(c(80)), 80);
});

test('winner always agrees with the totals', () => {
  const v = finalizeVerdict({ player1_criteria: c(60), player2_criteria: c(80), winner: 'player1' });
  assert.equal(v.winner, 'player2');
  assert.equal(v.adjusted, true);
});

test('a 1-point lead wins; equal totals go to the tie-break, draw only if it finds nothing', () => {
  assert.equal(finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(71) }).winner, 'player2');
  const t = finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(70), tiebreak: 'player1' });
  assert.equal(t.winner, 'player1');
  assert.ok(t.player1_score > t.player2_score, 'scoreboard agrees with the tie-break');
  assert.equal(finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(70) }).winner, 'draw');
  assert.equal(finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(90), winner: 'draw' }).winner, 'player2');
});

test('scores are clamped to 0..100', () => {
  const v = finalizeVerdict({ player1_criteria: c(500), player2_criteria: c(-3) });
  assert.equal(v.player1_score, 100);
  assert.equal(v.player2_score, 0);
});

const good = {
  topic: 'Удалённая работа эффективнее работы в офисе',
  player1: { name: 'A', argument: 'Я считаю, что удалённая работа эффективнее, потому что экономит время на дорогу, позволяет самостоятельно планировать график и повышает концентрацию.' },
  player2: { name: 'B', argument: 'Я считаю, что работа в офисе эффективнее, потому что позволяет быстрее взаимодействовать с коллегами, лучше контролировать процессы и обмениваться идеями.' },
};

test('validation rejects empty and short input', () => {
  assert.equal(validateMatch(good), null);
  assert.match(validateMatch({ ...good, topic: '' }), /Тема/);
  assert.match(validateMatch({ ...good, player1: { name: '', argument: good.player1.argument } }), /имя/);
  assert.match(validateMatch({ ...good, player2: { name: 'B', argument: 'коротко' } }), /короткий/);
  assert.match(validateMatch({ ...good, player2: { name: 'B', argument: 'x '.repeat(1200) } }), /длиннее/);
});

test('test-mode judge is deterministic and does not reward length alone', () => {
  assert.deepEqual(mockJudge(good), mockJudge(good));
  const padded = { ...good, player2: { name: 'B', argument: good.player2.argument + ' ' + 'и ещё раз это важно'.repeat(40).slice(0, 1500) } };
  const v = mockJudge(padded);
  assert.ok(v.player2_score - mockJudge(good).player2_score < 8, 'padding should add little');
});

test('test-mode judge does not see "но" inside words', () => {
  const v = mockJudge(good);
  assert.ok(!v.player1_strengths.some((s) => /противоположная/.test(s)));
});

test('fight script matches the verdict', () => {
  for (const [s1, s2, w] of [[80, 60, 'player1'], [55, 90, 'player2'], [70, 70, 'draw'], [71, 70, 'player1']]) {
    const fight = buildFight({ player1_score: s1, player2_score: s2, winner: w }, f, f);
    const hp = { p1: 100, p2: 100 };
    for (const ev of fight.events) {
      if (ev.clash) { hp.p1 -= ev.dmg.p1; hp.p2 -= ev.dmg.p2; }
      else hp[ev.attacker === 'p1' ? 'p2' : 'p1'] -= ev.dmg;
    }
    assert.deepEqual(hp, fight.final, `hp for ${s1}:${s2}`);
    if (w === 'draw') {
      assert.ok(hp.p1 > 0 && hp.p2 > 0);
    } else {
      const W = w === 'player1' ? 'p1' : 'p2', L = W === 'p1' ? 'p2' : 'p1';
      assert.equal(hp[L], 0);
      assert.ok(hp[W] > 0);
      const last = fight.events.at(-1);
      assert.equal(last.attacker, W);
      assert.ok(last.finisher);
    }
  }
});

// ---- cycles: the judge applies the work rules, not text length ----
const T = 'Снять ли «циклы» монтажнику Айылчы?';
const judge = (a1, a2) => mockJudge({ topic: T, player1: { name: 'Айжамал', argument: a1 }, player2: { name: 'Айылчы', argument: a2 } });
const winnerName = (v) => ({ player1: 'Айжамал', player2: 'Айылчы', draw: 'draw' })[v.winner];
const consistent = (v) => {
  if (v.winner === 'draw') return assert.match(v.reasoning, /^Ничья/);
  assert.ok(v.reasoning.startsWith(`Победитель — ${winnerName(v)}!`), 'explanation names the same winner');
  assert.ok(v.final_verdict.includes(winnerName(v)));
  assert.ok(v.winner === 'player1' ? v.player1_score > v.player2_score : v.player2_score > v.player1_score);
};

test('cycles 1: work rules beat a personal request and a chocolate', () => {
  const v = judge('Я не буду убирать у тебя "циклы", так как ты отклонился за вчера по показателям от нормы и сегодня не показал хорошую динамику.',
    'Убери у меня "циклы", пожалуйста, я завтра шоколадку занесу.');
  assert.equal(winnerName(v), 'Айжамал');
  consistent(v);
  assert.match(v.reasoning, /шоколадку/);
  assert.match(v.reasoning, /не подтверждено/); // her claim is a claim, not a proven fact
  assert.ok(v.analysis.facts.some((f) => f.side === 'player2' && f.type === 'influence'));
});

test('cycles 2: confirmed next-day improvement wins for the side asking to remove the cycle', () => {
  const v = judge('Не сниму цикл, потому что не хочу, правила есть правила и всё тут.',
    'Сними цикл: вчера было отклонение, но сегодня эффективность 108% по отчёту, дневной график закрыт полностью.');
  assert.equal(winnerName(v), 'Айылчы');
  assert.equal(v.analysis.fact_status, 'improvement_confirmed');
  consistent(v);
});

test('cycles 3: conflicting unproven claims — judge says so, cycle stays, low confidence', () => {
  const v = judge('Не сниму цикл, динамики не было, сегодня ты снова работал так же слабо.',
    'Сними цикл, сегодня я показал положительную динамику и работал лучше вчерашнего.');
  assert.equal(v.analysis.fact_status, 'disputed');
  assert.equal(v.confidence, 'low');
  assert.match(v.reasoning, /не подтверждено/);
  assert.equal(winnerName(v), 'Айжамал');
  consistent(v);
});

test('cycles 4: both cite the rules, data beats an unproven claim', () => {
  const v = judge('Цикл не сниму: по отчёту вчера эффективность 82%, сегодня 80% — динамика отрицательная, план не выполнен.',
    'Сними цикл, по правилам при положительной динамике его снимают, а сегодня эффективность выросла.');
  assert.equal(winnerName(v), 'Айжамал');
  consistent(v);
  const r = judge('Не сниму цикл, по правилам без положительной динамики он сохраняется, а ты сегодня ничего не улучшил.',
    'Сними цикл: по отчёту вчера эффективность 85%, сегодня 103%, это положительная динамика на следующий рабочий день.');
  assert.equal(winnerName(r), 'Айылчы');
  consistent(r);
});

test('cycles 5: both wrong — errors of both sides are explained', () => {
  const v = judge('Не сниму цикл, потому что ты мне не нравишься и вообще из принципа.',
    'Сними цикл, прошла уже неделя, он должен сам списаться со временем.');
  assert.match(v.reasoning, /личным отношением/);
  assert.match(v.reasoning, /не списываются автоматически/);
  consistent(v);
});

test('identical positions are a draw, explained as equal', () => {
  const a = 'Сними цикл, сегодня я показал положительную динамику по эффективности.';
  const v = judge(a, a);
  assert.equal(v.winner, 'draw');
  consistent(v);
});
