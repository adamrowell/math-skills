/**
 * Shell: hash router → Hub | Grown-ups | registry app (lazy).
 * Legacy modes (src/LegacyApp.tsx and friends) stay on disk but are not routed.
 */
import { Component, Suspense, lazy, useEffect } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { BigButton, ToastHost, clearCelebration, flushAllStores, sfx, useHashRoute, useSettings } from './core';
import type { AppId, AppProps } from './core';
import { getApp } from './apps/registry';
import { Hub } from './hub/Hub';
import { ParentArea } from './hub/ParentArea';

const lazyApps = new Map<AppId, LazyExoticComponent<ComponentType<AppProps>>>();
function lazyApp(id: AppId): LazyExoticComponent<ComponentType<AppProps>> | null {
  const def = getApp(id);
  if (!def?.load) return null;
  let C = lazyApps.get(id);
  if (!C) {
    C = lazy(def.load);
    lazyApps.set(id, C);
  }
  return C;
}

class AppErrorBoundary extends Component<{ children: ReactNode; onHome: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="k-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div className="k-emoji" style={{ fontSize: 64 }}>
          🙈
        </div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Oops! Something went wrong.</div>
        <BigButton variant="primary" onClick={() => window.location.reload()}>
          Try again
        </BigButton>
        <BigButton
          variant="ghost"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onHome();
          }}
        >
          Home
        </BigButton>
      </div>
    );
  }
}

/** Remove every saved key of this app (last resort when stored data keeps crashing it). */
function resetAppData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ms2:')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

/** Whole-app safety net: never a white screen. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="k-screen" data-testid="root-error" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div className="k-emoji" style={{ fontSize: 64 }}>
          🙈
        </div>
        <div style={{ fontSize: 26, fontWeight: 900 }}>Oops! Something went wrong.</div>
        <BigButton
          variant="primary"
          onClick={() => {
            window.location.hash = '#/';
            window.location.reload();
          }}
        >
          Try again
        </BigButton>
        <BigButton
          variant="ghost"
          data-testid="reset-data"
          onClick={() => {
            if (!window.confirm('Grown-ups: erase all points and progress saved on this device and start fresh?')) return;
            resetAppData();
            window.location.hash = '#/';
            window.location.reload();
          }}
        >
          Reset app data (grown-ups)
        </BigButton>
      </div>
    );
  }
}

function Loading() {
  return (
    <div className="k-loading" aria-label="Loading">
      <span className="k-emoji">⭐</span>
    </div>
  );
}

const TITLES: Record<string, string> = { '/': 'Math Skills', '/grownups': 'Grown-ups · Math Skills', '/grownups/mic': 'Mic test · Math Skills' };

export default function App() {
  const route = useHashRoute();
  const settings = useSettings();
  const [first] = route.segments;

  // Unlock audio on the first gesture (iOS); persist stores when the page is hidden.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    const flush = () => flushAllStores();
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else sfx.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const def = first ? getApp(first) : undefined;
  const routable = Boolean(def?.load && (def.enabled || settings.showHiddenApps));
  const isHub = !first;
  const isParent = first === 'grownups';
  const redirect = !isHub && !isParent && !routable;

  useEffect(() => {
    if (redirect) route.navigate('/', { replace: true });
  }, [redirect, route]);

  useEffect(() => {
    window.scrollTo(0, 0);
    clearCelebration();
    document.title = TITLES[route.path] ?? (def ? `${def.title} · Math Skills` : 'Math Skills');
  }, [route.path, def]);

  let content: ReactNode = null;
  if (isHub || redirect) {
    content = <Hub navigate={(to) => route.navigate(to)} />;
  } else if (isParent) {
    content = <ParentArea onExit={() => route.back()} sub={route.segments[1]} navigate={(to) => route.navigate(to)} />;
  } else if (def) {
    const C = lazyApp(def.id);
    if (C)
      content = (
        <AppErrorBoundary onHome={() => route.navigate('/', { replace: true })}>
          <Suspense fallback={<Loading />}>
            <C segments={route.segments.slice(1)} navigate={route.navigate} goHome={() => route.navigate('/')} />
          </Suspense>
        </AppErrorBoundary>
      );
  }

  return (
    <>
      {content}
      <ToastHost />
    </>
  );
}
