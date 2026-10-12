import type { ToastApi } from '../types';

export interface ToastItem {
  id: number;
  message: string;
  emoji?: string;
  kind: 'info' | 'success' | 'trophy';
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const toast: ToastApi = {
  show(message, opts) {
    const item: ToastItem = { id: ++seq, message, emoji: opts?.emoji, kind: opts?.kind ?? 'info' };
    items = [...items.slice(-2), item];
    emit();
    setTimeout(() => {
      items = items.filter((t) => t.id !== item.id);
      emit();
    }, opts?.durationMs ?? 1800);
  },
};

export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const toastSnapshot = () => items;

