import { useEffect, useState } from 'react';
import { back, markAutostart } from '../../core';
import type { AppProps } from '../../core';
import { CoordHome } from './CoordHome';
import { Gallery } from './Gallery';
import { PlayScreen } from './PlayScreen';
import type { Level } from './levels';
import { LEVELS, levelById, picturesFor } from './levels';
import { pickPicture } from './pick';
import type { Picture } from './pictures';
import { pictureById } from './pictures';
import { galleryStore, totalDrawings } from './store';
import './coordinates.css';

/** Routes: '' → home · 'play/<level>/<picture>' → drawing · 'gallery' → my pictures. */
export default function CoordinatesApp({ segments, navigate }: AppProps) {
  const [view, a, b] = segments;
  const level = view === 'play' ? levelById(a ?? '') : undefined;
  // '/coordinates/play/<level>/mystery' (hub Continue) → a fresh mystery picture at that level.
  const mystery = view === 'play' && b === 'mystery' && !!level && totalDrawings(galleryStore.get()) >= level.unlockAt;
  const pic = view === 'play' ? pictureById(b ?? '') : undefined;
  // A deep link / stale history entry must not skip a lock or put a picture on a grid it doesn't fit.
  const playable =
    !!level && !!pic && totalDrawings(galleryStore.get()) >= level.unlockAt && picturesFor(level).some((p) => p.id === pic.id);
  const unknown = !mystery && (view === 'play' && !playable) || (view !== undefined && view !== 'play' && view !== 'gallery');
  // Remount the drawing when "Again" replaces the route with the same picture id.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (unknown) navigate('/coordinates', { replace: true });
  }, [unknown, navigate]);

  const playUrl = (l: Level, p: Picture) => `/coordinates/play/${l.id}/${p.id}`;

  const drawMystery = (l: Level, opts?: { replace?: boolean }) => {
    const g = galleryStore.get();
    const p = pickPicture(l, g, g.lastPic);
    galleryStore.update((s) => ({ ...s, lastPic: p.id }));
    setNonce((n) => n + 1);
    navigate(playUrl(l, p), opts);
  };

  /** A chosen picture: at the current level when it fits, else the easiest level that has it. */
  const drawPicture = (p: Picture) => {
    const g = galleryStore.get();
    const done = totalDrawings(g);
    const cur = levelById(g.level) ?? LEVELS[1];
    const fits = (l: Level) => done >= l.unlockAt && picturesFor(l).some((x) => x.id === p.id);
    const l = fits(cur) ? cur : (LEVELS.find(fits) ?? LEVELS[2]);
    galleryStore.update((s) => ({ ...s, lastPic: p.id }));
    navigate(playUrl(l, p));
  };

  useEffect(() => {
    if (mystery && level) {
      markAutostart();
      drawMystery(level, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mystery]);

  if (view === 'play' && playable && level && pic) {
    return (
      <PlayScreen
        key={`${level.id}/${pic.id}/${nonce}`}
        level={level}
        pic={pic}
        onExit={() => back('/coordinates')}
        onAgain={() => drawMystery(level, { replace: true })}
        onGallery={() => navigate('/coordinates/gallery', { replace: true })}
      />
    );
  }
  if (view === 'gallery') return <Gallery onBack={() => back('/coordinates')} onDraw={drawPicture} />;
  if (mystery) return null;
  return <CoordHome onBack={() => back('/')} onDraw={(l) => drawMystery(l)} onGallery={() => navigate('/coordinates/gallery')} />;
}
