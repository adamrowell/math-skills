/**
 * clock-calendar — clocks, days and months (docs/GEO-LOGIC.md §E.6).
 * Validator: reads the clock(s) back from the picture and the time step from the prompt, does the
 * clock arithmetic itself (12-hour face), and checks exactly one option shows that time; days and
 * months are re-counted from the prompt / picture the same way.
 */
import type { ChoiceOption, ClockNode, Difficulty, Puzzle, PuzzleFamily, Rng, VisualNode, VisualSpec } from '../engine/types';
import { OPTION_COUNT } from '../engine/types';
import { chance, pick, puzzleId, randInt, shuffled } from '../engine/rng';
import { checkTextChoice, factorial, finalizeChoice, grid, spec, text, textOptions, walk } from './kit';

const VARIANTS = ['later', 'ago', 'clock-seq', 'days', 'months'] as const;
type Variant = (typeof VARIANTS)[number];

const BY_D: Record<Difficulty, Variant[]> = {
  1: ['later', 'days'],
  2: ['later', 'ago', 'clock-seq', 'days', 'months'],
  3: ['later', 'ago', 'clock-seq', 'days', 'months'],
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const mod = (a: number, m: number) => ((a % m) + m) % m;
const H12 = 720;
const hourOf = (t: number) => {
  const h = Math.floor(mod(t, H12) / 60);
  return h === 0 ? 12 : h;
};
const minOf = (t: number) => mod(t, 60);
export const fmtTime = (t: number) => `${hourOf(t)}:${String(minOf(t)).padStart(2, '0')}`;
const sayTime = (t: number) => {
  const m = minOf(t);
  const h = hourOf(t);
  if (m === 0) return `${h} o'clock`;
  if (m === 30) return `half past ${h}`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 45) return `quarter to ${hourOf(t + 15)}`;
  return fmtTime(t);
};
const fmtDelta = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h ? `${h} hour${h > 1 ? 's' : ''}` : '';
  const ms = m ? `${m} minutes` : '';
  return hs && ms ? `${hs} and ${ms}` : hs || ms;
};

function clock(id: string, x: number, y: number, r: number, t: number): ClockNode {
  return { t: 'clock', id, x, y, r, hour: hourOf(t), minute: minOf(t) };
}

const clockOption = (t: number): VisualSpec => spec(100, 100, [clock('opt', 50, 50, 44, t)], `Clock showing ${fmtTime(t)}`);

/** Clock options: answer `ans`; hour alternatives × minute alternatives (factorial). */
function clockOptions(rng: Rng, d: Difficulty, ans: number, hourAlts: number[], minuteAlt: number, explainWrong: (t: number) => string) {
  const n = OPTION_COUNT[d];
  const seen = new Set<number>([mod(ans, H12)]);
  const hs = hourAlts.map((x) => mod(x, H12)).filter((x) => x !== mod(ans, H12));
  const cells = factorial(rng, 0, hs.map((h) => h - mod(ans, H12)), 0, [minuteAlt], n);
  const wrong: ChoiceOption[] = [];
  for (const c of cells) {
    if (c.isAnswer) continue;
    const t = mod(ans + c.a + c.b, H12);
    if (seen.has(t)) return null;
    seen.add(t);
    wrong.push({ visual: clockOption(t), why: explainWrong(t) });
  }
  if (wrong.length !== n - 1) return null;
  return finalizeChoice(rng, { visual: clockOption(ans) }, wrong);
}

function timePuzzle(variant: 'later' | 'ago', d: Difficulty, rng: Rng): Puzzle | null {
  const start =
    d === 1 ? randInt(rng, 0, 11) * 60 + pick(rng, [0, 0, 30]) : d === 2 ? randInt(rng, 0, 11) * 60 + pick(rng, [0, 15, 30, 45]) : randInt(rng, 0, 143) * 5;
  const delta =
    d === 1
      ? pick(rng, [60, 120, 180, 240, 30, 90])
      : d === 2
        ? pick(rng, [30, 45, 90, 120, 75, 150, 60, 105])
        : pick(rng, [25, 35, 40, 50, 55, 80, 95, 100, 135, 165]);
  if (d === 1 && variant === 'ago') return null;
  const sign = variant === 'later' ? 1 : -1;
  const ans = mod(start + sign * delta, H12);
  // The classic slip: only the hour hand moved (minutes left as they were); else a quarter/half off.
  const q = d === 1 ? 30 : 15;
  const mAlt = minOf(start) !== minOf(ans) ? minOf(start) - minOf(ans) : minOf(ans) >= 30 ? -q : q;
  const hourAlts = [ans + 60, ans - 60, ans + 120];
  const answer = clockOptions(rng, d, ans, sign > 0 ? hourAlts : [hourAlts[1], hourAlts[0], hourAlts[2]], mAlt, (t) =>
    t === mod(start - sign * delta, H12) ? 'That goes the wrong way round the clock' : `That shows ${fmtTime(t)}`,
  );
  if (!answer) return null;
  const label = `${sign > 0 ? '+' : '−'}${delta % 60 === 0 ? `${delta / 60} h` : delta > 60 ? `${Math.floor(delta / 60)} h ${delta % 60}` : `${delta} min`}`;
  const visual = spec(
    230,
    150,
    [clock('q-clock', 80, 75, 68, start), text(192, 75, label, { id: 'delta', size: 18, fill: sign > 0 ? 'green' : 'red' })],
    `A clock showing ${fmtTime(start)}`,
  );
  const prompt = variant === 'later' ? `What time will it be in ${fmtDelta(delta)}?` : `What time was it ${fmtDelta(delta)} ago?`;
  return {
    id: puzzleId('clock-calendar', d, `${variant}|${start}|${delta}`),
    family: 'clock-calendar',
    difficulty: d,
    prompt,
    visual,
    answer,
    explanation: [
      { text: `The clock says ${sayTime(start)}.`, visual },
      ...(delta >= 60 && delta % 60 !== 0
        ? [{ text: `First ${sign > 0 ? 'add' : 'go back'} ${Math.floor(delta / 60)} hour${delta >= 120 ? 's' : ''}: ${fmtTime(start + sign * Math.floor(delta / 60) * 60)}. Then ${delta % 60} minutes.` }]
        : [{ text: `${sign > 0 ? 'Count on' : 'Count back'} ${fmtDelta(delta)}${delta < 60 ? ' — the minute hand goes round' : ''}.` }]),
      { text: `It ${sign > 0 ? 'will be' : 'was'} ${sayTime(ans)} (${fmtTime(ans)}).`, visual: clockOption(ans) },
    ],
    rule: `${fmtTime(start)} ${sign > 0 ? '+' : '−'} ${fmtDelta(delta)} = ${fmtTime(ans)}`,
    variant,
  };
}

function clockSeq(d: Difficulty, rng: Rng): Puzzle | null {
  const step = d === 2 ? pick(rng, [15, 30, 60, 90, 120, 45]) : pick(rng, [20, 25, 40, 45, 75, 105, 150]);
  const back = d === 3 && chance(rng, 0.3);
  const s = (back ? -1 : 1) * step;
  const t0 = d === 2 ? randInt(rng, 0, 47) * 15 : randInt(rng, 0, 143) * 5;
  const ts = [0, 1, 2].map((i) => mod(t0 + i * s, H12));
  const ans = mod(t0 + 3 * s, H12);
  const hourAlts = [ans + 60, ans - 60, ans + 120];
  const mAlt = minOf(ans) === minOf(ts[2]) ? (minOf(ans) >= 30 ? -15 : 15) : minOf(ts[2]) - minOf(ans);
  const answer = clockOptions(rng, d, ans, hourAlts, mAlt, (t) => (t === ts[2] ? 'That is the last clock again' : `That shows ${fmtTime(t)}`));
  if (!answer) return null;
  const nodes: VisualNode[] = ts.map((t, i) => clock(`c${i}`, 50 + i * 100, 50, 42, t));
  nodes.push(grid(314, 14, 1, 1, 72, { id: 'next', unknown: [{ r: 0, c: 0 }] }));
  const visual = spec(400, 100, nodes, `Clocks: ${ts.map(fmtTime).join(', ')}, then a question mark.`);
  return {
    id: puzzleId('clock-calendar', d, `clock-seq|${t0}|${s}`),
    family: 'clock-calendar',
    difficulty: d,
    prompt: 'Which clock comes next?',
    visual,
    answer,
    explanation: [
      { text: `Read the clocks: ${ts.map(fmtTime).join(', ')}.`, visual },
      { text: `Each clock is ${fmtDelta(step)} ${back ? 'earlier' : 'later'} than the one before.` },
      { text: `${fmtTime(ts[2])} ${back ? '−' : '+'} ${fmtDelta(step)} = ${fmtTime(ans)}.`, visual: clockOption(ans) },
    ],
    rule: `${back ? '−' : '+'}${fmtDelta(step)} each clock`,
    variant: 'clock-seq',
  };
}

function daysPuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const today = randInt(rng, 0, 6);
  let n: number;
  let back: boolean;
  let ask: string;
  if (d === 1) {
    const form = pick(rng, ['tomorrow', 'yesterday', 'after', 'before', 'in2', 'in3']);
    ({ n, back, ask } =
      form === 'tomorrow'
        ? { n: 1, back: false, ask: 'What day is it tomorrow?' }
        : form === 'yesterday'
          ? { n: 1, back: true, ask: 'What day was it yesterday?' }
          : form === 'after'
            ? { n: 2, back: false, ask: 'What day is the day after tomorrow?' }
            : form === 'before'
              ? { n: 2, back: true, ask: 'What was the day before yesterday?' }
              : { n: form === 'in2' ? 2 : 3, back: false, ask: `What day will it be in ${form === 'in2' ? 2 : 3} days?` });
  } else {
    n = d === 2 ? randInt(rng, 3, 6) : randInt(rng, 8, 20);
    if (n % 7 === 0) n++;
    back = chance(rng, d === 2 ? 0.35 : 0.4);
    ask = back ? `What day was it ${n} days ago?` : `What day will it be in ${n} days?`;
  }
  const ans = mod(today + (back ? -n : n), 7);
  const prompt = `Today is ${DAYS[today]}. ${ask}`;
  if (prompt.length > 60) return null;
  const pool = shuffled(rng, [
    { text: DAYS[mod(ans + 1, 7)], why: 'One day too far' },
    { text: DAYS[mod(ans - 1, 7)], why: 'One day short — count again' },
    { text: DAYS[mod(today + (back ? n : -n), 7)], why: back ? 'Go back in time, not forward' : 'Go forward in time, not back' },
    { text: DAYS[today], why: 'That is today' },
    { text: DAYS[mod(ans + 2, 7)], why: 'Count the days again' },
    { text: DAYS[mod(ans - 2, 7)], why: 'Count the days again' },
  ]);
  const answer = textOptions(rng, DAYS[ans], pool, OPTION_COUNT[d]);
  if (answer.options.length !== OPTION_COUNT[d]) return null;
  const strip = d < 3;
  const nodes: VisualNode[] = strip
    ? [
        grid(4, 34, 1, 7, 52, {
          id: 'week',
          cells: DAYS.map((dn, c) => ({ r: 0, c, label: dn.slice(0, 3), fill: c === today ? 'yellow' : undefined })),
        }),
        text(4 + today * 52 + 26, 16, 'Today', { size: 14, fill: 'purple', id: 'today' }),
      ]
    : [text(110, 30, '📅 Today is', { size: 18 }), text(110, 66, DAYS[today], { size: 30, fill: 'purple', id: 'today' })];
  const visual = spec(strip ? 372 : 220, strip ? 92 : 96, nodes, `Today is ${DAYS[today]}.`);
  const weeks = Math.floor(n / 7);
  return {
    id: puzzleId('clock-calendar', d, `days|${today}|${n}|${back}|${ask}`),
    family: 'clock-calendar',
    difficulty: d,
    prompt,
    visual,
    answer,
    explanation: [
      { text: `Start on ${DAYS[today]}.`, visual, highlight: ['today'] },
      ...(weeks > 0 ? [{ text: `7 days later it is ${DAYS[today]} again! ${n} days = ${weeks} week${weeks > 1 ? 's' : ''} + ${n % 7} days.` }] : []),
      { text: `Count ${back ? 'back' : 'on'} ${weeks > 0 ? n % 7 : n} day${(weeks > 0 ? n % 7 : n) > 1 ? 's' : ''}: it's ${DAYS[ans]}.` },
    ],
    rule: `${DAYS[today]} ${back ? '−' : '+'} ${n} days = ${DAYS[ans]}`,
    variant: 'days',
  };
}

function monthsPuzzle(d: Difficulty, rng: Rng): Puzzle | null {
  const seq = chance(rng, 0.5);
  if (seq) {
    const step = d === 2 ? pick(rng, [1, 2, 2, 3]) : pick(rng, [2, 3, 4, -1, -2]);
    const m0 = randInt(rng, 0, 11);
    const ms = [0, 1, 2].map((i) => mod(m0 + i * step, 12));
    const ans = mod(m0 + 3 * step, 12);
    const pool = shuffled(rng, [
      { text: MONTHS[mod(ms[2] + 1, 12)], why: step === 1 ? 'Count on one month' : `It skips — jump ${Math.abs(step)} months` },
      { text: MONTHS[mod(ans + 1, 12)], why: 'One month too far' },
      { text: MONTHS[mod(ans - 1, 12)], why: 'One month short' },
      { text: MONTHS[mod(ms[2] - step, 12)], why: 'That goes the wrong way' },
      { text: MONTHS[mod(ans + step, 12)], why: 'That skips one' },
      { text: MONTHS[mod(ans + 6, 12)], why: 'Count the months again' },
    ]);
    const answer = textOptions(rng, MONTHS[ans], pool, OPTION_COUNT[d]);
    if (answer.options.length !== OPTION_COUNT[d]) return null;
    const visual = spec(
      296,
      82,
      [
        grid(4, 4, 1, 4, 72, {
          id: 'months',
          cells: ms.map((m, c) => ({ r: 0, c, label: MONTHS[m].slice(0, 3) })),
          unknown: [{ r: 0, c: 3 }],
        }),
      ],
      `Months: ${ms.map((m) => MONTHS[m]).join(', ')}, then a question mark.`,
    );
    return {
      id: puzzleId('clock-calendar', d, `months|seq|${m0}|${step}`),
      family: 'clock-calendar',
      difficulty: d,
      prompt: 'Which month comes next?',
      visual,
      answer,
      explanation: [
        { text: 'Say the months in order: January, February, March…', visual },
        { text: step > 0 ? `Each one jumps ${step} month${step > 1 ? 's' : ''} forward.` : `Each one goes ${-step} month${step < -1 ? 's' : ''} back.` },
        { text: `After ${MONTHS[ms[2]]} comes ${MONTHS[ans]}.` },
      ],
      rule: `${step > 0 ? '+' : '−'}${Math.abs(step)} month${Math.abs(step) > 1 ? 's' : ''} each time`,
      variant: 'months',
    };
  }
  const m0 = randInt(rng, 0, 11);
  const n = d === 2 ? randInt(rng, 2, 4) : randInt(rng, 3, 9);
  const back = d === 3 && chance(rng, 0.35);
  const ans = mod(m0 + (back ? -n : n), 12);
  const prompt = `Which month is ${n} months ${back ? 'before' : 'after'} ${MONTHS[m0]}?`;
  const pool = shuffled(rng, [
    { text: MONTHS[mod(ans + 1, 12)], why: 'One month too far' },
    { text: MONTHS[mod(ans - 1, 12)], why: 'One month short' },
    { text: MONTHS[mod(m0 + (back ? n : -n), 12)], why: back ? 'Count back, not on' : 'Count on, not back' },
    { text: MONTHS[m0], why: 'That is where we started' },
    { text: MONTHS[mod(ans + 2, 12)], why: 'Count the months again' },
  ]);
  const answer = textOptions(rng, MONTHS[ans], pool, OPTION_COUNT[d]);
  if (answer.options.length !== OPTION_COUNT[d]) return null;
  const visual = spec(220, 96, [text(110, 30, '🗓️ Start at', { size: 18 }), text(110, 66, MONTHS[m0], { size: 30, fill: 'purple', id: 'm0' })], `Start at ${MONTHS[m0]}.`);
  return {
    id: puzzleId('clock-calendar', d, `months|after|${m0}|${n}|${back}`),
    family: 'clock-calendar',
    difficulty: d,
    prompt,
    visual,
    answer,
    explanation: [
      { text: `Start at ${MONTHS[m0]}.`, visual },
      { text: `Count ${back ? 'back' : 'on'} ${n}: ${Array.from({ length: n }, (_, i) => MONTHS[mod(m0 + (back ? -(i + 1) : i + 1), 12)].slice(0, 3)).join(', ')}.` },
      { text: `It's ${MONTHS[ans]}.` },
    ],
    rule: `${MONTHS[m0]} ${back ? '−' : '+'} ${n} months = ${MONTHS[ans]}`,
    variant: 'months',
  };
}

function generate(d: Difficulty, rng: Rng): Puzzle {
  for (let tries = 0; tries < 200; tries++) {
    const variant = pick(rng, BY_D[d]);
    const p =
      variant === 'later' || variant === 'ago'
        ? timePuzzle(variant, d, rng)
        : variant === 'clock-seq'
          ? clockSeq(d, rng)
          : variant === 'days'
            ? daysPuzzle(d, rng)
            : monthsPuzzle(d, rng);
    if (p && validate(p).length === 0) return p;
  }
  throw new Error('clock-calendar: generator stuck');
}

// ---------------------------------------------------------------------------------------------
// Independent validator
// ---------------------------------------------------------------------------------------------

function clocksIn(s: VisualSpec): ClockNode[] {
  const out: ClockNode[] = [];
  walk(s.nodes, (n) => {
    if (n.t === 'clock') out.push(n);
  });
  return out;
}
const tOf = (c: ClockNode) => mod((c.hour % 12) * 60 + (c.minute ?? 0), H12);

function parseDelta(s: string): number | null {
  const h = /(\d+) hours?/.exec(s);
  const m = /(\d+) minutes/.exec(s);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function checkClockChoice(p: Puzzle, expected: number): string[] {
  if (p.answer.kind !== 'choice') return ['clock answers are choices'];
  const times = p.answer.options.map((o) => (o.visual ? clocksIn(o.visual).map(tOf)[0] : NaN));
  if (times.some((t) => !Number.isFinite(t))) return ['option without a clock'];
  if (new Set(times).size !== times.length) return ['two options show the same time'];
  const hits = times.filter((t) => t === expected).length;
  if (hits !== 1) return [`${hits} options show ${fmtTime(expected)}`];
  if (times[p.answer.answerIndex] !== expected) return ['answerIndex is not the derived time'];
  return [];
}

function validate(p: Puzzle): string[] {
  const v = p.variant as Variant;
  if (v === 'later' || v === 'ago') {
    const c = clocksIn(p.visual).find((x) => x.id === 'q-clock');
    const delta = parseDelta(p.prompt);
    if (!c || delta === null) return ['cannot read clock or delta'];
    const back = / ago\?$/.test(p.prompt);
    return checkClockChoice(p, mod(tOf(c) + (back ? -delta : delta), H12));
  }
  if (v === 'clock-seq') {
    const cs = clocksIn(p.visual)
      .filter((c) => /^c\d$/.test(c.id ?? ''))
      .sort((a, b) => (a.x < b.x ? -1 : 1))
      .map(tOf);
    if (cs.length < 3) return ['need three clocks'];
    // A constant step in either direction; prefer the smaller of the forward/backward readings.
    const steps = cs.slice(1).map((t, i) => mod(t - cs[i], H12));
    if (!steps.every((s) => s === steps[0])) return ['clocks do not step evenly'];
    return checkClockChoice(p, mod(cs[2] + steps[0], H12));
  }
  if (v === 'days') {
    const m = /^Today is (\w+)\. (.*)$/.exec(p.prompt);
    if (!m) return ['cannot read today'];
    const today = DAYS.indexOf(m[1]);
    const q = m[2];
    let delta: number | null = null;
    if (/tomorrow\?$/.test(q) && /day after tomorrow/.test(q)) delta = 2;
    else if (/day before yesterday/.test(q)) delta = -2;
    else if (/tomorrow\?$/.test(q)) delta = 1;
    else if (/yesterday\?$/.test(q)) delta = -1;
    else {
      const n = /(\d+) days/.exec(q);
      if (n) delta = / ago\?$/.test(q) ? -Number(n[1]) : Number(n[1]);
    }
    if (today < 0 || delta === null) return ['cannot read the day question'];
    return p.answer.kind === 'choice' ? checkTextChoice(p.answer, DAYS[mod(today + delta, 7)]) : ['days are choices'];
  }
  if (v === 'months') {
    if (p.answer.kind !== 'choice') return ['months are choices'];
    const after = /^Which month is (\d+) months (before|after) (\w+)\?$/.exec(p.prompt);
    if (after) {
      const m0 = MONTHS.indexOf(after[3]);
      const n = Number(after[1]) * (after[2] === 'before' ? -1 : 1);
      return checkTextChoice(p.answer, MONTHS[mod(m0 + n, 12)]);
    }
    const g = p.visual.nodes.find((n) => n.t === 'grid' && n.id === 'months');
    if (!g || g.t !== 'grid') return ['no months'];
    const ms = (g.cells ?? [])
      .slice()
      .sort((a, b) => a.c - b.c)
      .map((c) => MONTHS.findIndex((x) => x.slice(0, 3) === c.label));
    const st = ms.slice(1).map((m, i) => mod(m - ms[i], 12));
    if (!st.every((s) => s === st[0])) return ['months do not step evenly'];
    return checkTextChoice(p.answer, MONTHS[mod(ms[2] + st[0], 12)]);
  }
  return ['unknown variant'];
}

export const clockCalendar: PuzzleFamily = {
  id: 'clock-calendar',
  title: 'Clocks & Calendars',
  emoji: '⏰',
  group: 'number',
  variants: VARIANTS,
  generate,
  validate,
};
