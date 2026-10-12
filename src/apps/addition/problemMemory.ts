import type { AppId } from '../../core';
import type { Fact, MasteryState } from '../../drill';
import { masteryStore } from '../../drill';

/**
 * For generators whose facts are templates (a skill bucket → fresh numbers each time).
 * The drill summary lists "Remember: <prompt> = <answer>" by looking facts up by id; this keeps,
 * per id, the concrete problem he last missed this round (else the last one shown), so the
 * summary shows "38 + 47 = 85" instead of the bucket's example.
 */
export class ProblemMemory {
  private shownById = new Map<string, Fact>();
  private missedById = new Map<string, Fact>();
  private prev: MasteryState | null = null;
  private unsub: (() => void) | null = null;

  constructor(private readonly appId: AppId) {}

  /** Round start. */
  reset() {
    this.shownById.clear();
    this.missedById.clear();
    this.listen();
  }

  shown(f: Fact): Fact {
    this.shownById.set(f.id, f);
    return f;
  }

  /** Templates with the remembered concrete problems swapped in. */
  overlay(templates: Fact[]): Fact[] {
    if (!this.shownById.size) return templates;
    return templates.map((t) => this.missedById.get(t.id) ?? this.shownById.get(t.id) ?? t);
  }

  private listen() {
    if (this.unsub) return;
    try {
      const store = masteryStore(this.appId);
      this.prev = store.get();
      this.unsub = store.subscribe(() => {
        const next = store.get();
        const prev = this.prev;
        this.prev = next;
        if (!prev || next === prev) return;
        for (const [id, m] of Object.entries(next.facts)) {
          if (m.lastWrong && m.lastWrong !== prev.facts[id]?.lastWrong) {
            const f = this.shownById.get(id);
            if (f) this.missedById.set(id, f);
          }
        }
      });
    } catch {
      /* summary falls back to the examples */
    }
  }
}
