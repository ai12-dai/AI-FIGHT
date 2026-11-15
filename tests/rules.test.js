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

test('near-equal totals are a draw; judge may call a draw only within 5 points', () => {
  assert.equal(finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(71), winner: 'player2' }).winner, 'draw');
  assert.equal(finalizeVerdict({ player1_criteria: c(70), player2_criteria: c(74), winner: 'draw' }).winner, 'draw');
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
