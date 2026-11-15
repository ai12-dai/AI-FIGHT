// Turns the AI verdict into a choreographed fight. The outcome is fixed by the
// verdict: the winner lands the finishing blow, the loser ends at 0 HP. Only the
// cosmetic details (move order, damage split) vary, and those are seeded from
// the verdict itself, so the same verdict always plays the same fight.

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function split(total, parts, rnd, minEach = 5) {
  const w = Array.from({ length: parts }, () => 0.6 + rnd());
  const s = w.reduce((a, b) => a + b, 0);
  const out = w.map((x) => Math.max(minEach, Math.round((x / s) * total)));
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

export function buildFight(verdict, f1, f2) {
  const rnd = mulberry32(verdict.player1_score * 7919 + verdict.player2_score * 104729 + verdict.winner.length);
  const fighters = { p1: f1, p2: f2 };
  const kinds = ['melee', 'melee', 'combo', 'projectile'];
  const mk = (who, dmg, extra = {}) => {
    const f = fighters[who];
    return { attacker: who, dmg, move: f.moves[Math.floor(rnd() * f.moves.length)], kind: kinds[Math.floor(rnd() * kinds.length)], ...extra };
  };

  if (verdict.winner === 'draw') {
    // Both trade evenly and both stay standing.
    const end = Math.max(20, Math.min(60, Math.round((verdict.player1_score + verdict.player2_score) / 4)));
    const d1 = split(100 - end, 3, rnd), d2 = split(100 - end, 3, rnd);
    const first = rnd() < 0.5 ? 'p1' : 'p2', second = first === 'p1' ? 'p2' : 'p1';
    const ev = [];
    // d1 = damage taken by p1, d2 = damage taken by p2
    for (let i = 0; i < 2; i++) {
      ev.push(mk(first, (first === 'p1' ? d2 : d1)[i]));
      ev.push(mk(second, (second === 'p1' ? d2 : d1)[i]));
    }
    ev.push({ clash: true, dmg: { p1: d1[2], p2: d2[2] } }); // finale: simultaneous strike
    return { events: ev, final: { p1: end, p2: end }, winner: 'draw' };
  }

  const W = verdict.winner === 'player1' ? 'p1' : 'p2';
  const L = W === 'p1' ? 'p2' : 'p1';
  const diff = Math.abs(verdict.player1_score - verdict.player2_score);
  const winnerHp = Math.max(12, Math.min(85, Math.round(15 + diff * 2.2)));
  const loserHits = diff > 25 ? 1 : diff > 10 ? 2 : 3;
  const winnerHits = 4;
  const toL = split(100, winnerHits + 1, rnd, 8);
  // make the finisher the biggest hit
  toL.sort((a, b) => a - b);
  const toW = split(100 - winnerHp, loserHits, rnd);

  const wEv = toL.slice(0, winnerHits).map((d) => mk(W, d));
  const lEv = toW.map((d) => mk(L, d));
  // Close fights: the eventual loser takes the early lead.
  const ev = [];
  let wi = 0, li = 0;
  const loserFirst = diff <= 10 || rnd() < 0.4;
  let turn = loserFirst ? L : W;
  while (wi < wEv.length || li < lEv.length) {
    if (turn === L && li < lEv.length) ev.push(lEv[li++]);
    else if (wi < wEv.length) ev.push(wEv[wi++]);
    else ev.push(lEv[li++]);
    turn = turn === W ? L : W;
  }
  ev.push({ attacker: W, dmg: toL[winnerHits], move: fighters[W].finisher, kind: 'finisher', finisher: true });
  return { events: ev, final: { [W]: winnerHp, [L]: 0 }, winner: W };
}
