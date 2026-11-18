// AI FIGHT judge. Runs on the game server, with no external services.
//
// It works like an arbiter, not like a text counter:
//   1. splits each position into clauses and classifies them: confirmed facts,
//      unconfirmed claims, rule references, assumptions, emotional appeals and
//      attempts to influence the judge (gifts, promises, pressure);
//   2. if the dispute is about "циклы", applies the cycle rules from
//      judgeKnowledge.js: works out what the facts in the dispute actually
//      establish and which outcome the rules require, then checks each side
//      against that;
//   3. turns the analysis into the five criterion scores, so the totals, the
//      winner, the explanation and the fight animation always agree;
//   4. declares a draw only when the positions are genuinely equivalent.
// Same input -> same result.
import { finalizeVerdict } from './rules.js';
import { CYCLE_RULES } from './judgeKnowledge.js';

// \b does not work for Cyrillic, so word edges are written as letter look-arounds.
const W = (body) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, 'giu');
const L = '\\p{L}*'; // "any word ending"

const RX = {
  // ---- general reasoning ----
  reason: W('потому что|так как|поскольку|следовательно|поэтому|значит|в результате|благодаря|because|since|therefore|thus|hence|as a result|due to'),
  structure: W('во-первых|во-вторых|в-третьих|наконец|кроме того|также|итак|first(?:ly)?|second(?:ly)?|finally|moreover|in addition|furthermore'),
  evidenceGeneric: /(\d+[.,]?\d*\s*%|\d{2,}|исследовани|статистик|данные|данных|опрос|например|к примеру|согласно|study|studies|research|survey|data|statistic|for example|for instance|according to)/giu,
  rebuttal: W(`однако|хотя|но|тем не менее|оппонент${L}|противник${L}|критик${L}|возраз${L}|с другой стороны|даже если|ты говоришь|ты утверждаешь|however|although|but|opponents?|critics?|on the other hand|counter${L}|admittedly|even if`),
  noise: /(!!+|\?\?+|[A-ZА-ЯЁ]{6,})/g,

  // ---- attempts to influence the judge ----
  bribe: W(`шоколад${L}|подар${L}|занесу|занес[её]м|принесу|принес[её]м|угощ${L}|угощу|отблагодар${L}|магарыч${L}|с меня \\p{L}+|деньг${L}|денег|заплачу|конфет${L}|торт${L}|пицц${L}|кофе|в долгу не останусь|bribe|gift|chocolate`),
  plea: W(`пожалуйста|прошу|умоляю|будь (?:человеком|другом)|по-дружески|по дружбе|войди в положение|ну дай|пожалей|жалко|что тебе стоит|сделай исключение|в последний раз|please|i beg`),
  pressure: W(`пожалуюсь|уволю|уволят|накажу|иначе|пожалеешь|начальству|руководству|я старше|я начальник|у меня связи|по блату`),
  insult: W(`дурак${L}|идиот${L}|глуп${L}|тупой|тупая|тупица|лох${L}|бездар${L}|stupid|idiot|dumb`),
  personal: W(`не нравишься|не нравится|я так (?:хочу|решил${L})|просто так|не хочу|из принципа|ты мне должен|потому что я (?:так )?сказал${L}`),
  assumption: W(`наверное|наверно|возможно|думаю|скорее всего|кажется|вероятно|может быть|по-моему|maybe|probably|i think`),

  // ---- domain: cycles ----
  cycles: /цикл/iu,
  removeVerb: W('(?:убер|убир|убра|сним|сня|снима|спиш|списа|списыва|откат|откач|обнул|аннулир)\\p{L}*'),
  keepPhrase: W(`останется|оста[её]тся|сохраня${L}|сохрани${L}|сохранится|оставлю|оставляю|оставить`),
  ruleRef: W(`правил${L}|норм${L}|норматив${L}|показател${L}|эффективн${L}|план${L}|график${L}|динамик${L}|отклон${L}|kpi|регламент${L}`),
  citesRule: W(`следующ${L} (?:рабоч${L} )?(?:день|дня|дне)|по правил${L}|правил${L} (?:гласят|говорят)|регламент${L}|только (?:при|за сч[её]т|если)`),
  autoRemoval: W(`сам${L} (?:по себе )?(?:спиш${L}|списа${L}|пройд${L}|сним${L}|исчезн${L}|сгор${L}|обнул${L})|автоматическ${L}|прошл${L} (?:уже )?(?:неделя|месяц|время|\\d+ дн${L})|срок давности|по истечении|давно было|со временем`),
  posDyn: [
    W(`положительн${L} динамик${L}`),
    W(`хорош${L} динамик${L}`),
    W(`динамик${L} (?:была |есть )?положительн${L}`),
    W(`выполнил${L} (?:план${L}|норм${L}|график${L})`),
    W(`закрыл${L} (?:\\p{L}+ )?график${L}`),
    W(`(?:эффективност${L}|показател${L}) (?:\\p{L}+ )?(?:вырос${L}|выросл${L}|повысил${L}|улучшил${L}|подрос${L}|выше)`),
    W(`улучшил${L}|исправил${L}`),
  ],
  negDyn: [
    W(`отклонил${L}|отклонени${L}`),
    W(`динамик${L} (?:не было|нет|не наблюда${L}|отрицательн${L})`),
    W(`отрицательн${L} динамик${L}`),
    W(`ниже (?:норм${L}|план${L})`),
    W(`отстава${L}|отстал${L}|просел${L}|упал${L}|снизил${L}|ухудшил${L}`),
  ],
  report: W(`по отч[её]т${L}|в отч[её]т${L}|отч[её]т${L}|в системе|по системе|по данным|данны${L}|табел${L}|скрин${L}|выгрузк${L}|журнал${L}|подтвержд${L}|подтверди${L}|акт${L}|crm|срм`),
  counts: /\d+\s*(?:из\s*\d+|заяв|объект|подключ|точ|адрес|наряд)/giu,
  percent: /(\d{1,3}(?:[.,]\d+)?)\s?%/gu,
};

const sat = (n, k) => 1 - Math.exp(-n / k); // saturating 0..1
const clampScore = (x) => Math.round(Math.max(5, Math.min(95, x)));
const all = (s, rx) => [...s.matchAll(rx)];
const count = (s, rx) => all(s, rx).length;
const stems = (s) => new Set((s.toLowerCase().match(/[\p{L}]{4,}/gu) || []).map((w) => w.slice(0, 5)));

/** Text of the current clause before position `i` (stops at punctuation). */
const clauseBefore = (t, i) => t.slice(Math.max(0, i - 60), i).split(/[.!?;,:—–\n]/).pop();
const NEGATION = /(?:^|[^\p{L}])(?:не|нельзя|нет|без|отказываюсь|никак|ни)(?:\s+\p{L}+){0,2}\s*$/iu;
const RULE_CONTEXT = /(?:^|[^\p{L}])(?:чтобы|можно|нужно|необходимо|только|нельзя)(?:\s+\p{L}+){0,2}\s*$/iu;
const negated = (t, i) => NEGATION.test(clauseBefore(t, i));

/** The clause around a match, for quoting. */
function clauseAt(t, i) {
  const start = Math.max(t.lastIndexOf('.', i), t.lastIndexOf('!', i), t.lastIndexOf('?', i), t.lastIndexOf(',', i), t.lastIndexOf(';', i)) + 1;
  const ends = ['.', '!', '?', ',', ';'].map((c) => t.indexOf(c, i)).filter((x) => x >= 0);
  const end = ends.length ? Math.min(...ends) : t.length;
  return balance(t.slice(start, end).replace(/^[\s«»„“]+|[\s«»„“]+$/g, '').trim());
}
/** Close a quote that a clause boundary cut open. */
function balance(c) {
  if ((c.match(/"/g) || []).length % 2) c = c.startsWith('"') ? c.slice(1) : c + '"';
  if ((c.match(/«/g) || []).length > (c.match(/»/g) || []).length) c += '»';
  return c;
}
/** The sentence (between . ! ? : ; —) spanning positions i..j, for quoting data. */
function sentenceSpan(t, i, j) {
  const B = /[.!?:;—]/;
  let a = i; while (a > 0 && !B.test(t[a - 1])) a--;
  let b = j; while (b < t.length && !B.test(t[b])) b++;
  const out = t.slice(a, b).trim();
  return out.length > 140 ? out.slice(0, 137) + '…' : out;
}
const firstQuote = (t, rx) => { const m = all(t, rx)[0]; return m ? clauseAt(t, m.index) : ''; };

// ---------------------------------------------------------------- analysis
function analyse(text, topic) {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  const topicStems = stems(topic);
  const own = stems(t);
  let overlap = 0;
  for (const s of topicStems) if (own.has(s)) overlap++;

  const autoMatches = all(t, RX.autoRemoval);
  const f = {
    text: t,
    words: words.length,
    reasons: count(t, RX.reason),
    structure: count(t, RX.structure),
    evidenceGeneric: count(t, RX.evidenceGeneric),
    rebuttal: count(t, RX.rebuttal),
    noise: count(t, RX.noise),
    sentences: Math.max(1, (t.match(/[.!?…]+/g) || []).length),
    relevance: topicStems.size ? overlap / topicStems.size : 0.5,
    variety: words.length ? new Set(words.map((w) => w.toLowerCase())).size / words.length : 0,
    bribe: count(t, RX.bribe),
    plea: count(t, RX.plea),
    pressure: count(t, RX.pressure),
    insult: count(t, RX.insult),
    personal: count(t, RX.personal),
    assumption: count(t, RX.assumption),
    ruleRefs: count(t, RX.ruleRef),
    citesRule: count(t, RX.citesRule) + autoMatches.filter((m) => negated(t, m.index)).length,
    autoRemoval: autoMatches.filter((m) => !negated(t, m.index)).length,
  };
  f.manip = f.bribe + f.plea + f.pressure + f.insult;

  // stance in a cycles dispute: wants the cycle removed, or kept
  let remove = 0, keep = 0;
  for (const m of all(t, RX.removeVerb)) {
    const before = clauseBefore(t, m.index);
    if (RULE_CONTEXT.test(before)) { f.citesRule++; continue; } // explaining the rule, not a demand
    if (NEGATION.test(before)) keep++; else remove++;
  }
  keep += count(t, RX.keepPhrase);
  f.stance = remove > keep ? 'remove' : keep > remove ? 'keep' : keep ? 'keep' : null;

  // claims about the next-day dynamics, in text order; the last one is the conclusion
  const dyn = [];
  RX.posDyn.forEach((rx) => all(t, rx).forEach((m) => dyn.push({ i: m.index, dir: negated(t, m.index) ? 'neg' : 'pos', q: clauseAt(t, m.index) })));
  RX.negDyn.forEach((rx) => all(t, rx).forEach((m) => dyn.push({ i: m.index, dir: negated(t, m.index) ? 'pos' : 'neg', q: clauseAt(t, m.index) })));
  dyn.sort((a, b) => a.i - b.i);
  f.dyn = dyn.length ? dyn[dyn.length - 1].dir : null;
  f.dynQuote = dyn.length ? dyn[dyn.length - 1].q : '';

  // data: percentages override words — numbers are facts, words are claims
  const pct = all(t, RX.percent).map((m) => parseFloat(m[1].replace(',', '.')));
  if (pct.length >= 2) f.dyn = pct[pct.length - 1] > pct[0] ? 'pos' : 'neg';
  else if (pct.length === 1) f.dyn = pct[0] >= 100 ? 'pos' : 'neg';
  if (pct.length) {
    const pm = all(t, RX.percent);
    f.dynQuote = sentenceSpan(t, pm[0].index, pm.at(-1).index + pm.at(-1)[0].length);
  }
  f.evidenceCount = pct.length + count(t, RX.report) + count(t, RX.counts);
  f.evidenced = f.evidenceCount > 0;
  f.evidenceQuote = pct.length ? f.dynQuote : firstQuote(t, RX.report) || firstQuote(t, RX.counts);

  f.quotes = {
    bribe: firstQuote(t, RX.bribe),
    pressure: firstQuote(t, RX.pressure),
    auto: autoMatches.filter((m) => !negated(t, m.index)).map((m) => clauseAt(t, m.index))[0] || '',
    personal: firstQuote(t, RX.personal),
  };
  return f;
}

// Classify each clause, so the result screen can show facts vs. claims vs. pressure.
const LABELS = {
  fact: 'Подтверждённый факт',
  claim: 'Утверждение (не подтверждено)',
  rule: 'Ссылка на правило',
  position: 'Позиция',
  assumption: 'Предположение',
  emotion: 'Эмоциональный довод',
  influence: 'Попытка повлиять',
  other: 'Прочее',
};
function classify(text) {
  const out = [];
  for (const raw of text.split(/(?<=[.!?…;])\s+|,\s+|\n+/)) {
    const c = balance(raw.replace(/^[\s«»„“—–-]+|[\s«»„“.!?…;]+$/g, '').trim());
    if (!/\p{L}/u.test(c)) continue;
    const has = (rx) => count(c, rx) > 0;
    const hasDyn = RX.posDyn.some(has) || RX.negDyn.some(has) || /\d\s?%/.test(c);
    const evid = /\d\s?%/.test(c) || has(RX.report) || has(RX.counts);
    let type = 'other';
    if (has(RX.bribe) || has(RX.pressure)) type = 'influence';
    else if (has(RX.plea) || has(RX.insult) || has(RX.personal) || /!!/.test(c)) type = 'emotion';
    else if (evid) type = 'fact';
    else if (has(RX.citesRule) || (has(RX.autoRemoval) && /(?:^|[^\p{L}])не\s/iu.test(c))) type = 'rule';
    else if (has(RX.assumption)) type = 'assumption';
    else if (hasDyn || has(RX.ruleRef)) type = 'claim';
    else if (has(RX.removeVerb) || has(RX.keepPhrase) || RX.cycles.test(c)) type = 'position';
    else if (has(RX.reason)) type = 'claim';
    out.push({ type, label: LABELS[type], text: c.length > 160 ? c.slice(0, 157) + '…' : c });
  }
  return out;
}

// ---------------------------------------------------------------- cycles domain
/** What the facts in the dispute establish about the next-day dynamics. */
function resolveFacts(a1, a2) {
  const strength = (f, dir) => (f.dyn === dir ? (f.evidenced ? 2 : 1) : 0);
  const pos = Math.max(strength(a1, 'pos'), strength(a2, 'pos'));
  const neg = Math.max(strength(a1, 'neg'), strength(a2, 'neg'));
  let status;
  if (pos === 2 && neg < 2) status = 'improvement_confirmed';
  else if (pos === 2 && neg === 2) status = 'conflicting_data';
  else if (neg === 2) status = 'no_improvement_confirmed';
  else if (pos === 1 && neg === 1) status = 'disputed';
  else if (pos === 1) status = 'improvement_claimed';
  else if (neg === 1) status = 'no_improvement_claimed';
  else status = 'unknown';
  // Rule 4: no removal without improvement. The burden of proof is on the side
  // asking for removal, so only an uncontested or confirmed improvement counts.
  let required;
  if (status === 'improvement_confirmed' || status === 'improvement_claimed') required = 'remove';
  else if (status === 'conflicting_data') {
    const more = (f) => (f.dyn === 'pos' ? f.evidenceCount : -f.evidenceCount);
    required = more(a1) + more(a2) > 0 ? 'remove' : 'keep';
  } else required = 'keep';
  return { status, required, pos, neg };
}

function cycleScores(f, opp, facts) {
  const invalid = (f.personal > 0 ? 1 : 0) + (f.autoRemoval > 0 ? 1 : 0);
  // Is the side's own reasoning grounded in performance, not in feelings or gifts?
  const grounded = f.dyn !== null || f.citesRule > 0;
  let align = 0.3; // no clear stance
  if (f.stance === facts.required) align = grounded && !invalid ? 1 : 0.5;
  else if (f.stance) align = 0;
  // a factual claim contradicted by the opponent's data
  const contradicted = f.dyn && opp.dyn && f.dyn !== opp.dyn && opp.evidenced && !f.evidenced;
  const engages = f.dyn !== null && opp.stance && opp.stance !== f.stance;
  const fallacies = f.bribe + f.plea + f.pressure + f.insult;
  const crit = {
    logic: 25 + 40 * align + 12 * Math.min(1, f.ruleRefs / 2) + 8 * sat(f.reasons, 1.5) + 8 * Math.min(1, f.citesRule)
      - 18 * invalid - 10 * Math.min(2, fallacies) - (contradicted ? 10 : 0),
    persuasiveness: 25 + 30 * align + 15 * (f.evidenced ? 1 : 0) + 8 * sat(f.reasons, 1.5) + 6 * Math.min(1, f.citesRule)
      - 15 * Math.min(2, fallacies) - 10 * invalid,
    evidence: 12 + (f.dyn ? 18 : 0) + (f.evidenced ? 40 : 0) + 10 * Math.min(1, f.ruleRefs / 2)
      - 8 * Math.min(1, f.bribe) - (contradicted ? 15 : 0),
    relevance: 25 + 45 * Math.min(1, f.ruleRefs / 2) + (f.stance ? 12 : 0) + (f.dyn ? 8 : 0)
      - (f.bribe ? 20 : 0) - (f.plea && !f.ruleRefs ? 10 : 0),
    rebuttal: 20 + 40 * sat(f.rebuttal, 1) + (engages ? 15 : 0),
  };
  for (const k in crit) crit[k] = clampScore(crit[k]);
  return { crit, align, invalid, contradicted };
}

function cycleNotes(f, s) {
  const st = [], wk = [];
  if (s.align === 1) st.push('Позиция соответствует правилам снятия циклов.');
  else if (s.align === 0.5) st.push('Вывод совпадает с правилами, но обоснован не показателями.');
  if (f.ruleRefs > 0) st.push('Опирается на рабочие показатели (норма, план, динамика).');
  if (f.evidenced) st.push(`Подкрепляет позицию данными: «${f.evidenceQuote}».`);
  if (f.citesRule > 0) st.push('Ссылается на установленное правило.');
  if (f.dyn && !f.evidenced) wk.push('Утверждение о динамике не подтверждено отдельными данными.');
  if (s.contradicted) wk.push('Утверждение опровергается данными оппонента.');
  if (f.stance === 'remove' && f.dyn !== 'pos') wk.push('Нет данных о положительной динамике — главного условия снятия цикла.');
  if (f.bribe) wk.push(`Попытка подкупа: «${f.quotes.bribe}».`);
  if (f.plea) wk.push('Эмоциональная просьба вместо аргументов.');
  if (f.pressure) wk.push(`Давление вместо аргументов: «${f.quotes.pressure}».`);
  if (f.autoRemoval) wk.push('Считает, что цикл должен списаться сам, — это противоречит правилам.');
  if (f.personal) wk.push('Решение обосновано личным отношением, а не показателями.');
  if (f.insult) wk.push('Оскорбления не являются аргументом.');
  if (!f.stance) wk.push('Не ясно, что именно предлагает сторона: снять цикл или оставить.');
  return { s: st.slice(0, 4), w: wk.slice(0, 5) };
}

function cycleExplanation(v, A, facts, names) {
  const sides = { player1: A.p1, player2: A.p2 };
  const N = { player1: names.p1, player2: names.p2 };
  const out = [];
  if (v.winner === 'draw') out.push('Ничья.');
  else out.push(`Победитель — ${N[v.winner]}!`);
  out.push(`По правилам цикл можно снять только при положительной динамике по эффективности на следующий рабочий день; без улучшения он сохраняется и автоматически не списывается.`);

  const who = (dir) => (A.p1.f.dyn === dir ? N.player1 : N.player2);
  const bothSay = A.p1.f.dyn && A.p1.f.dyn === A.p2.f.dyn;
  const whoEv = (dir) => (A.p1.f.dyn === dir && A.p1.f.evidenced ? A.p1.f : A.p2.f);
  switch (facts.status) {
    case 'improvement_confirmed':
      out.push(`${who('pos')} подтверждает положительную динамику данными: «${whoEv('pos').evidenceQuote}». Значит, условие снятия цикла выполнено.`); break;
    case 'no_improvement_confirmed':
      out.push(`${who('neg')} подкрепляет отсутствие положительной динамики данными: «${whoEv('neg').evidenceQuote}». Условие снятия цикла не выполнено.`); break;
    case 'conflicting_data':
      out.push('Обе стороны приводят данные, и они противоречат друг другу; судья опирается на более подробные данные.'); break;
    case 'disputed':
      out.push(`Стороны противоречат друг другу: ${who('pos')} утверждает, что положительная динамика была, ${who('neg')} — что её не было. Ни одно утверждение не подтверждено отдельными данными. Пока улучшение не подтверждено, по правилам цикл сохраняется: доказать динамику должен тот, кто просит снять цикл.`); break;
    case 'improvement_claimed':
      out.push(bothSay ? 'Обе стороны утверждают, что динамика была положительной; данных нет, но и спора о фактах нет.'
        : `${who('pos')} утверждает, что динамика была положительной. Данных нет, но оппонент это не оспаривает.`); break;
    case 'no_improvement_claimed':
      if (bothSay) { out.push('Обе стороны признают, что положительной динамики не было; это не подтверждено данными, но и не оспаривается.'); break; }
      out.push(`${who('neg')} указывает на отклонение и отсутствие положительной динамики. Это утверждение пока не подтверждено отдельными данными, но и опровержения нет — улучшение показателей никто не показал.`); break;
    default:
      out.push('Никто не привёл данных о динамике по эффективности — значит, улучшение не показано.');
  }

  for (const k of ['player1', 'player2']) {
    const { f, s } = sides[k];
    const n = N[k];
    if (s.align === 1) out.push(`Позиция ${n} соответствует правилам работы с циклами.`);
    else if (s.align === 0.5) out.push(`Вывод ${n} совпадает с правилами, но обоснован ${f.personal ? 'личным отношением' : f.autoRemoval ? 'ссылкой на прошедшее время' : 'не показателями'}, а не рабочими данными — это слабое обоснование.`);
    else if (f.stance === 'remove') out.push(`${n} просит снять цикл, но не приводит подтверждённых данных об улучшении показателей.`);
    else if (f.stance === 'keep') out.push(facts.status === 'improvement_confirmed'
      ? `${n} отказывается снимать цикл, хотя улучшение показателей подтверждено данными — это противоречит правилу.`
      : `${n} отказывается снимать цикл, но не опровергает заявленное улучшение показателей.`);
    if (f.bribe) out.push(`Обещание «${f.quotes.bribe}» не имеет отношения к нормативам и не может быть основанием для снятия цикла.`);
    if (f.plea && !f.bribe) out.push(`Личная просьба ${n} не заменяет рабочие показатели.`);
    if (f.pressure) out.push(`Давление («${f.quotes.pressure}») не является аргументом.`);
    if (f.autoRemoval) out.push(`${n} считает, что цикл должен списаться сам («${f.quotes.auto}»), но циклы не списываются автоматически и со временем.`);
  }
  if (v.winner === 'draw') out.push('Обе позиции обоснованы одинаково, объективно выделить более сильную нельзя.');
  else out.push(`Поэтому аргументы ${N[v.winner]} обоснованнее.`);
  if (facts.status === 'disputed') out.push('Если появятся данные о показателях, решение может измениться.');
  return out.join(' ');
}

// ---------------------------------------------------------------- generic topics
function genericScores(f) {
  const len = sat(f.words, 60); // diminishing returns: length alone gives little
  const pen = Math.min(30, f.noise * 6 + f.bribe * 15 + f.plea * 6 + f.pressure * 12 + f.insult * 10 + f.personal * 8);
  const crit = {
    logic: 35 + 30 * sat(f.reasons, 2) + 15 * sat(f.structure, 2) + 10 * Math.min(1, f.sentences / 4) + 5 * len - pen,
    persuasiveness: 35 + 20 * sat(f.reasons + f.evidenceGeneric, 3) + 15 * f.variety + 10 * len + 8 * sat(f.rebuttal, 1) - pen,
    evidence: 30 + 40 * sat(f.evidenceGeneric, 2) + 10 * sat(f.reasons, 3) + 5 * len - pen / 2 - f.assumption * 4,
    relevance: 40 + 50 * Math.min(1, f.relevance * 1.6) + 5 * len - (f.bribe ? 15 : 0),
    rebuttal: 25 + 55 * sat(f.rebuttal, 1.5) + 5 * len,
  };
  for (const k in crit) crit[k] = clampScore(crit[k]);
  return { crit };
}

function genericNotes(f, ru) {
  const s = [], w = [];
  const T = (r, e) => (ru ? r : e);
  if (f.reasons >= 2) s.push(T('Тезисы подкреплены причинно-следственными связями.', 'Claims are backed by cause-and-effect reasoning.'));
  else w.push(T('Мало объяснений «почему» — тезисы звучат как утверждения.', 'Few explanations of "why" — claims read as assertions.'));
  if (f.evidenceGeneric >= 2) s.push(T('Есть примеры или конкретика (цифры, данные).', 'Uses examples or specifics (numbers, data).'));
  else w.push(T('Не хватает примеров, данных или конкретики.', 'Lacks examples, data or specifics.'));
  if (f.rebuttal >= 1) s.push(T('Учтена противоположная позиция.', 'Engages with the opposing view.'));
  else w.push(T('Позиция оппонента не рассматривается.', 'Does not address the opposing side.'));
  if (f.structure >= 2) s.push(T('Аргументация хорошо структурирована.', 'Well-structured argument.'));
  if (f.relevance < 0.3) w.push(T('Связь с темой спора выражена слабо.', 'Weak connection to the debate topic.'));
  else s.push(T('Аргументы держатся темы спора.', 'Stays on topic.'));
  if (f.bribe) w.push(T(`Попытка подкупа: «${f.quotes.bribe}».`, 'Tries to bribe the judge.'));
  if (f.plea) w.push(T('Эмоциональная просьба вместо аргументов.', 'Emotional plea instead of arguments.'));
  if (f.pressure) w.push(T('Давление вместо аргументов.', 'Pressure instead of arguments.'));
  if (f.noise || f.insult) w.push(T('Эмоциональные выпады снижают оценку.', 'Emotional jabs lower the score.'));
  if (f.assumption) w.push(T('Есть предположения без опоры на факты.', 'Contains assumptions without facts.'));
  return { s: s.slice(0, 4), w: w.slice(0, 5) };
}

function genericExplanation(v, a1, a2, names, ru) {
  if (!ru) {
    if (v.winner === 'draw') return `Both positions are equally well argued (${v.player1_score} : ${v.player2_score}): the same level of reasoning, specifics and rebuttal, so neither can be objectively preferred.`;
    const [w, l] = v.winner === 'player1' ? [a1, a2] : [a2, a1];
    const why = [];
    if (w.reasons > l.reasons) why.push('more reasoning');
    if (w.evidenceGeneric > l.evidenceGeneric) why.push('more specifics and data');
    if (w.rebuttal > l.rebuttal) why.push('engages the opposing view');
    if (l.manip > w.manip) why.push('the opponent relied on pleas or pressure instead of arguments');
    return `Winner — ${v.winner === 'player1' ? names.p1 : names.p2}! The position is better supported${why.length ? ': ' + why.join(', ') : ''} (${v.player1_score} : ${v.player2_score}).`;
  }
  if (v.winner === 'draw') return `Ничья. Позиции обоснованы одинаково (${v.player1_score} : ${v.player2_score}): у обеих сторон равный уровень логики, конкретики и работы с контраргументами, поэтому объективно выделить более сильную нельзя.`;
  const [w, l] = v.winner === 'player1' ? [a1, a2] : [a2, a1];
  const W_ = v.winner === 'player1' ? names.p1 : names.p2;
  const L_ = v.winner === 'player1' ? names.p2 : names.p1;
  const why = [];
  if (w.reasons > l.reasons) why.push('больше объясняет причины своих тезисов');
  if (w.evidenceGeneric > l.evidenceGeneric) why.push('приводит больше конкретики и данных');
  if (w.rebuttal > l.rebuttal) why.push('отвечает на позицию оппонента');
  if (w.structure > l.structure) why.push('строит аргументацию последовательнее');
  const lw = [];
  if (l.bribe) lw.push(`предлагает «${l.quotes.bribe}» вместо аргументов`);
  if (l.plea) lw.push('давит на жалость');
  if (l.pressure) lw.push('оказывает давление');
  if (l.insult || l.noise) lw.push('переходит на эмоции');
  if (l.assumption > w.assumption) lw.push('опирается на предположения');
  let s = `Победитель — ${W_}! `;
  s += why.length ? `${W_} ${why.join(', ')}.` : `Позиция ${W_} обоснована немного лучше.`;
  if (lw.length) s += ` ${L_} ${lw.join(', ')} — это не аргументы по существу.`;
  return s + ` Итог: ${v.player1_score} : ${v.player2_score}.`;
}

// ---------------------------------------------------------------- tie-break
/** When totals are equal, decide by substance; null if truly equivalent. */
function tiebreak(keys) {
  for (const [x, y] of keys) {
    if (x > y) return 'player1';
    if (y > x) return 'player2';
  }
  return null;
}

// ---------------------------------------------------------------- entry point
export function mockJudge({ topic, player1, player2 }) {
  const all3 = topic + ' ' + player1.argument + ' ' + player2.argument;
  const ru = /[а-яё]/i.test(all3);
  const isCycles = RX.cycles.test(all3);
  const f1 = analyse(player1.argument, topic);
  const f2 = analyse(player2.argument, topic);
  const names = { p1: player1.name, p2: player2.name };
  const analysis = {
    context: isCycles ? 'cycles' : 'general',
    rules: isCycles ? [CYCLE_RULES.definition, ...CYCLE_RULES.rules] : [],
    facts: [
      ...classify(player1.argument).map((x) => ({ side: 'player1', ...x })),
      ...classify(player2.argument).map((x) => ({ side: 'player2', ...x })),
    ],
  };

  let v;
  if (isCycles) {
    const facts = resolveFacts(f1, f2);
    const s1 = cycleScores(f1, f2, facts), s2 = cycleScores(f2, f1, facts);
    const n1 = cycleNotes(f1, s1), n2 = cycleNotes(f2, s2);
    v = finalizeVerdict({
      player1_criteria: s1.crit, player2_criteria: s2.crit,
      player1_strengths: n1.s, player1_weaknesses: n1.w,
      player2_strengths: n2.s, player2_weaknesses: n2.w,
      tiebreak: tiebreak([[s1.align, s2.align], [+f1.evidenced, +f2.evidenced], [-s1.invalid, -s2.invalid], [-f1.manip, -f2.manip], [f1.ruleRefs, f2.ruleRefs], [f1.reasons, f2.reasons]]),
      confidence: ['disputed', 'conflicting_data', 'unknown'].includes(facts.status) ? 'low'
        : ['improvement_confirmed', 'no_improvement_confirmed'].includes(facts.status) ? 'high' : 'medium',
    }, { mode: 'test', model: 'test-judge' });
    analysis.fact_status = facts.status;
    analysis.rule_outcome = facts.required;
    v.reasoning = cycleExplanation(v, { p1: { f: f1, s: s1 }, p2: { f: f2, s: s2 } }, facts, names);
    const W_ = v.winner === 'player1' ? names.p1 : names.p2;
    const ws = v.winner === 'player1' ? s1 : s2;
    v.final_verdict = v.winner === 'draw'
      ? 'Ничья. Позиции обоснованы одинаково.'
      : `Победитель — ${W_}! ${ws.align === 1 ? 'Позиция соответствует правилам работы с циклами.' : 'Эта позиция обоснована лучше.'}`;
  } else {
    const g1 = genericScores(f1), g2 = genericScores(f2);
    const n1 = genericNotes(f1, ru), n2 = genericNotes(f2, ru);
    v = finalizeVerdict({
      player1_criteria: g1.crit, player2_criteria: g2.crit,
      player1_strengths: n1.s, player1_weaknesses: n1.w,
      player2_strengths: n2.s, player2_weaknesses: n2.w,
      tiebreak: tiebreak([[-f1.manip, -f2.manip], [f1.evidenceGeneric, f2.evidenceGeneric], [f1.reasons, f2.reasons], [f1.rebuttal, f2.rebuttal], [f1.structure, f2.structure], [-f1.assumption, -f2.assumption]]),
    }, { mode: 'test', model: 'test-judge' });
    v.reasoning = genericExplanation(v, f1, f2, names, ru);
    const W_ = v.winner === 'player1' ? names.p1 : names.p2;
    v.final_verdict = ru
      ? (v.winner === 'draw' ? 'Ничья. Позиции обоснованы одинаково.' : `Победитель — ${W_}!`)
      : (v.winner === 'draw' ? 'Draw. Both positions are equally strong.' : `Winner — ${W_}!`);
  }
  v.analysis = analysis;
  v.adjusted = false;
  return v;
}
