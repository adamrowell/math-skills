import { useEffect } from 'react';
import { back, sfx } from '../../core';
import type { AppProps } from '../../core';
import { DrillScreen, PRACTICE, formatById, masteryStore } from '../../drill';
import type { RoundFormat } from '../../drill';
import { FactsHome } from '../division/FactsHome';
import { SKILLS, additionGenerator, setChip } from './facts';

const VALID_SET = (id: string) => additionGenerator.sets().some((s) => s.id === id);

/** Stars per skill (Leitner box 0–5): the long-term motivator for Big Adding. */
function SkillLadder({ onPractice }: { onPractice: (setId: string) => void }) {
  const mastery = masteryStore('addition').useStore();
  const gold = SKILLS.filter((s) => (mastery.facts[s.id]?.box ?? 0) >= 5).length;
  return (
    <section className="ff-skills" data-testid="skills">
      <div className="ff-skills__title">
        <span className="k-emoji">🌟</span> My adding skills · <span className="k-num">{gold}</span>/{SKILLS.length} gold
      </div>
      {SKILLS.map((s) => {
        const box = mastery.facts[s.id]?.box ?? 0;
        return (
          <button
            key={s.id}
            type="button"
            className={`ff-skill${box >= 5 ? ' is-gold' : ''}`}
            onClick={() => {
              sfx.play('click');
              onPractice(s.group);
            }}
            data-testid={`skill-${s.id}`}
            aria-label={`${s.name}, ${box} of 5 stars. Practise.`}
          >
            <span className="ff-skill__name">{s.name}</span>
            <span className="ff-skill__eg k-num">{s.example}</span>
            <span className="ff-skill__stars" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`k-emoji${i < box ? '' : ' is-dim'}`}>
                  ⭐
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/** Routes: '' → home · 'play/<format>/<set>' → round. */
export default function AdditionApp({ segments, navigate }: AppProps) {
  const [view, a, b] = segments;
  const play = (f: RoundFormat, setId: string) => navigate(`/addition/play/${f.id}/${setId}`);
  const format = view === 'play' ? formatById(a ?? '') : undefined;
  const setId = b && VALID_SET(b) ? b : 'all';
  const unknown = (view === 'play' && !format) || (view !== undefined && view !== 'play');

  useEffect(() => {
    if (unknown) navigate('/addition', { replace: true });
  }, [unknown, navigate]);

  if (view === 'play' && format) {
    return (
      <DrillScreen
        key={`${format.id}/${setId}`}
        generator={additionGenerator}
        format={format}
        setId={setId}
        title={`${format.title} · ${setChip(setId)}`}
        onExit={() => back('/addition')}
      />
    );
  }
  return (
    <FactsHome
      generator={additionGenerator}
      title="Big Adding"
      emoji="➕"
      chip={setChip}
      onBack={() => back('/')}
      onPlay={play}
    >
      <SkillLadder onPractice={(s) => play(PRACTICE, s)} />
    </FactsHome>
  );
}
