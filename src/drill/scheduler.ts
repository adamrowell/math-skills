/** Weighted adaptive fact selection (docs/DESIGN.md §1.1). Pure functions. */
import type { PickNextFact, SchedulerInput, WeightForFact } from './types';
import { masteryScore } from './mastery';

export const WRONG_BOOST = 4;

/** prior × (1 + 3·(1 − mastery)) × wrongBoost × recency */
export const weightForFact: WeightForFact = (fact, mastery, speed, wrongCount, recoveredCount, recencyIndex) => {
  const m = masteryScore(mastery, speed);
  const wrongBoost = wrongCount > 0 && recoveredCount < 2 ? WRONG_BOOST : 1;
  // recencyIndex: 0 = asked last. Last 3 → 0, next 3 → 0.3.
  const recency = recencyIndex === null ? 1 : recencyIndex < 3 ? 0 : recencyIndex < 6 ? 0.3 : 1;
  // Warm start: until a fact has been seen twice, compress the hard end of the prior (√ above 1)
  // so a brand-new learner gets a balanced mix instead of a wall of 7×8s and 12s, while 0s and
  // 1s stay rare. The Leitner boxes then push hard facts up as the easy ones go gold.
  const prior = (!mastery || mastery.attempts < 2) && fact.prior > 1 ? Math.sqrt(fact.prior) : fact.prior;
  return prior * (1 + 3 * (1 - m)) * wrongBoost * recency;
};

export const pickNextFact: PickNextFact = (input: SchedulerInput) => {
  const { facts, mastery, speed, recent, sessionWrong, sessionRecovered, comeback, questionIndex } = input;
  const rng = input.rng ?? Math.random;
  if (facts.length === 0) throw new Error('pickNextFact: empty fact set');

  // Comeback queue preempts sampling when due (never the fact just asked).
  const last = recent[recent.length - 1];
  const due = comeback
    .filter((c) => c.dueAt <= questionIndex && c.factId !== last)
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  if (due) {
    const fact = facts.find((f) => f.id === due.factId);
    if (fact) return { fact, weight: Infinity, viaComeback: true };
  }

  const recencyOf = (id: string): number | null => {
    const i = recent.lastIndexOf(id);
    return i < 0 ? null : recent.length - 1 - i;
  };

  const weigh = (useRecency: boolean) =>
    facts.map((f) =>
      weightForFact(
        f,
        mastery.facts[f.id],
        f.speed ?? speed,
        sessionWrong[f.id] ?? 0,
        sessionRecovered[f.id] ?? 0,
        useRecency ? recencyOf(f.id) : null,
      ),
    );

  let weights = weigh(true);
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Tiny set: everything was asked recently. Avoid only the immediate repeat.
    weights = weigh(false).map((w, i) => (facts[i].id === last && facts.length > 1 ? 0 : w));
    total = weights.reduce((a, b) => a + b, 0);
  }
  let r = rng() * total;
  for (let i = 0; i < facts.length; i++) {
    r -= weights[i];
    if (r < 0) return { fact: facts[i], weight: weights[i], viaComeback: false };
  }
  const i = weights.findIndex((w) => w > 0);
  return { fact: facts[i >= 0 ? i : 0], weight: weights[i >= 0 ? i : 0], viaComeback: false };
};
