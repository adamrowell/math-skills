import { useMemo, useState } from 'react';
import { TopBar, sfx, useTodayPoints } from '../../core';
import { masteryStore } from '../../drill';
import { MapView } from './MapView';
import type { MapLabel, RegionMark } from './MapView';
import { useMap } from './mapLoader';
import { speak } from './speech';
import { masteryId, packOf, stagesOf } from './stages';
import type { StageDef } from './types';

interface Props {
  stage: StageDef;
  onBack: () => void;
  onStage: (stageId: string) => void;
}

const BOX_FILL = ['#E4E9F2', '#CFE0FF', '#A9C8FF', '#7FAEFF', '#FFD66B', '#FFC22E'];

/** Learn mode: tap anything to hear and see its name. No points, no pressure. */
export function ExploreScreen({ stage, onBack, onStage }: Props) {
  const { map } = useMap(stage.map);
  const today = useTodayPoints();
  const mastery = masteryStore('maps').useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [starsView, setStarsView] = useState(false);
  const pack = packOf(stage.pack);
  const stages = stagesOf(stage.pack);

  const targets = useMemo(() => new Set(stages.flatMap((s) => s.targets)), [stages]);
  const marks = useMemo<Record<string, RegionMark>>(() => (selected ? { [selected]: 'selected' } : {}), [selected]);
  const region = selected && map ? map.byId.get(selected) : undefined;
  const labels: MapLabel[] = region ? [{ id: region.id, text: region.label, tone: 'info' }] : [];

  const mastered = stage.targets.filter((id) => (mastery.facts[masteryId(stage.map, id)]?.box ?? 0) >= 4).length;

  const fillFor = useMemo(() => {
    if (!starsView) return undefined;
    return (id: string) => {
      if (!targets.has(id)) return BOX_FILL[0];
      return BOX_FILL[mastery.facts[masteryId(stage.map, id)]?.box ?? 0];
    };
  }, [starsView, targets, mastery, stage.map]);

  const onTap = (id: string) => {
    const r = map?.byId.get(id);
    if (!r) return;
    sfx.unlock();
    sfx.play('pop', 0.6);
    setSelected(id);
    speak(r.label);
  };

  return (
    <div className="k-screen mp-screen mp-explore" style={{ ['--k-app' as string]: 'var(--k-app-maps)' }} data-testid="maps-explore">
      <TopBar
        onBack={onBack}
        title={
          <>
            <span className="k-emoji">👀</span> Explore {pack.title}
          </>
        }
        points={today}
      />
      <div className="mp-prompt mp-prompt--explore">
        <div className="mp-prompt__text">
          {region ? (
            <span className="mp-prompt__name" data-testid="explore-name">
              {region.label}
            </span>
          ) : (
            <span className="mp-prompt__verb">Tap a place to hear its name</span>
          )}
        </div>
        {region && (
          <button type="button" className="mp-say" aria-label="Say it again" onClick={() => speak(region.label)}>
            <span className="k-emoji">🔊</span>
          </button>
        )}
        <button
          type="button"
          className={`mp-toggle${starsView ? ' is-on' : ''}`}
          aria-pressed={starsView}
          onClick={() => {
            sfx.play('click');
            setStarsView((v) => !v);
          }}
          data-testid="stars-toggle"
        >
          <span className="k-emoji">⭐</span> {mastered}/{stage.targets.length}
        </button>
      </div>
      <div className="mp-chiprow" role="tablist" aria-label="Zoom">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === stage.id}
            className={`mp-zoomchip${s.id === stage.id ? ' is-on' : ''}`}
            onClick={() => {
              sfx.play('click');
              onStage(s.id);
            }}
          >
            <span className="k-emoji">{s.emoji}</span> {s.title}
          </button>
        ))}
      </div>
      <main className="mp-stage">
        {map ? (
          <MapView
            map={map}
            view={stage.view ?? [0, 0, map.data.width, map.data.height]}
            inset={stage.inset}
            portrait={stage.portrait}
            marks={marks}
            labels={labels}
            fillFor={fillFor}
            onTap={onTap}
          />
        ) : (
          <div className="mp-loading">
            <span className="k-emoji mp-spin">🌍</span>
          </div>
        )}
      </main>
      {starsView && (
        <div className="mp-legend" data-testid="stars-legend">
          <span>
            <i style={{ background: BOX_FILL[0] }} /> New
          </span>
          <span>
            <i style={{ background: BOX_FILL[2] }} /> Learning
          </span>
          <span>
            <i style={{ background: BOX_FILL[5] }} /> Got it!
          </span>
        </div>
      )}
    </div>
  );
}
