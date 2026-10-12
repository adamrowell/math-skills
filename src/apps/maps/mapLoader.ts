import { useEffect, useState } from 'react';
import { regionMeta } from './stages';
import type { LoadedMap, MapData, MapKind, Region } from './types';

const loaders: Record<MapKind, () => Promise<MapData>> = {
  us: () => import('./data/us.gen').then((m) => m.US_MAP),
  continents: () => import('./data/continents.gen').then((m) => m.CONTINENTS_MAP),
  countries: () => import('./data/countries.gen').then((m) => m.COUNTRIES_MAP),
};

const cache = new Map<MapKind, Promise<LoadedMap>>();

function build(kind: MapKind, data: MapData): LoadedMap {
  const toRegion = (isOcean: boolean) => (r: MapData['regions'][number]): Region => {
    const meta = regionMeta(kind, r.id, r.name);
    return { ...r, label: meta.label, prior: meta.prior, group: meta.group, isOcean };
  };
  const land = data.regions.map(toRegion(false));
  const oceans = (data.oceans ?? []).map(toRegion(true));
  const byId = new Map<string, Region>();
  for (const r of [...oceans, ...land]) byId.set(r.id, r);
  return { kind, data, byId, land, oceans };
}

export function loadMap(kind: MapKind): Promise<LoadedMap> {
  let p = cache.get(kind);
  if (!p) {
    p = loaders[kind]().then((d) => build(kind, d));
    p.catch(() => cache.delete(kind));
    cache.set(kind, p);
  }
  return p;
}

/** Synchronous peek for already-loaded maps (avoids a loading flash on Again). */
const ready = new Map<MapKind, LoadedMap>();

export function useMap(kind: MapKind): { map: LoadedMap | null; error: boolean; retry: () => void } {
  const [state, setState] = useState<{ kind: MapKind; map: LoadedMap | null; error: boolean }>(() => ({
    kind,
    map: ready.get(kind) ?? null,
    error: false,
  }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadMap(kind).then(
      (m) => {
        ready.set(kind, m);
        if (alive) setState({ kind, map: m, error: false });
      },
      () => alive && setState({ kind, map: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [kind, attempt]);
  const map = state.kind === kind ? state.map : (ready.get(kind) ?? null);
  return { map, error: state.kind === kind && state.error, retry: () => setAttempt((a) => a + 1) };
}
