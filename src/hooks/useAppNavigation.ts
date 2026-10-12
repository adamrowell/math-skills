import { useEffect, useCallback, useRef } from 'react';

type NavigationState = string | null;

interface UseAppNavigationProps {
  state: NavigationState;
  onBack: () => void;
  // Optional: different back behavior for different states
  stateHandlers?: Record<string, () => void>;
}

/**
 * Hook to manage browser history for app navigation
 * Allows browser back button to work within the app
 */
export function useAppNavigation({ state, onBack, stateHandlers }: UseAppNavigationProps) {
  const lastStateRef = useRef<NavigationState>(null);
  const isInitializedRef = useRef(false);

  // Push state to history when navigation state changes
  useEffect(() => {
    if (!isInitializedRef.current) {
      // On mount, replace current state with initial state
      window.history.replaceState({ state }, '');
      isInitializedRef.current = true;
      lastStateRef.current = state;
      return;
    }

    // Only push if state actually changed (not on initial render)
    if (state !== lastStateRef.current) {
      // If going deeper (from null to something, or something to deeper something)
      if (state !== null && (lastStateRef.current === null || state !== lastStateRef.current)) {
        window.history.pushState({ state }, '');
      }
      lastStateRef.current = state;
    }
  }, [state]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      // If we have a specific handler for the current state, use it
      if (state && stateHandlers && stateHandlers[state]) {
        stateHandlers[state]();
      } else {
        // Otherwise use the generic back handler
        onBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state, onBack, stateHandlers]);

  // Function to programmatically go back
  const goBack = useCallback(() => {
    if (window.history.state?.state) {
      window.history.back();
    } else {
      onBack();
    }
  }, [onBack]);

  return { goBack };
}

export default useAppNavigation;
