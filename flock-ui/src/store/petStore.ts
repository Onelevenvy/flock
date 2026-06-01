import { create } from 'zustand';

export interface PetPosition {
  x: number;
  y: number;
}

interface PetStore {
  enabled: boolean;
  minimized: boolean;
  bubbleEnabled: boolean;
  bubbleDuration: number; // ms
  position: PetPosition;
  mode: 'desktop' | 'in-app';

  setEnabled: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setBubbleEnabled: (v: boolean) => void;
  setBubbleDuration: (ms: number) => void;
  setPosition: (pos: PetPosition) => void;
  resetPosition: () => void;
  setMode: (mode: 'desktop' | 'in-app') => void;
}

const DEFAULT_POSITION: PetPosition = { x: -6, y: -130 };

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

export const usePetStore = create<PetStore>((set) => ({
  enabled: loadStored('xiaof-pet-enabled', true),
  minimized: false,
  bubbleEnabled: loadStored('xiaof-bubble-enabled', true),
  bubbleDuration: loadStored('xiaof-bubble-duration', 3000),
  position: (() => {
    const pos = loadStored<PetPosition>('xiaof-pet-position', DEFAULT_POSITION);
    if (pos && (pos.x === -24 || pos.x === -8) && (pos.y === -24 || pos.y === -120)) {
      localStorage.setItem('xiaof-pet-position', JSON.stringify(DEFAULT_POSITION));
      return DEFAULT_POSITION;
    }
    return pos;
  })(),
  mode: loadStored<'desktop' | 'in-app'>('xiaof-pet-mode', 'desktop'),

  setEnabled: (v) => {
    localStorage.setItem('xiaof-pet-enabled', JSON.stringify(v));
    set({ enabled: v });
  },
  setMinimized: (v) => set({ minimized: v }),
  setBubbleEnabled: (v) => {
    localStorage.setItem('xiaof-bubble-enabled', JSON.stringify(v));
    set({ bubbleEnabled: v });
  },
  setBubbleDuration: (ms) => {
    localStorage.setItem('xiaof-bubble-duration', JSON.stringify(ms));
    set({ bubbleDuration: ms });
  },
  setPosition: (pos) => {
    localStorage.setItem('xiaof-pet-position', JSON.stringify(pos));
    set({ position: pos });
  },
  resetPosition: () => {
    localStorage.setItem('xiaof-pet-position', JSON.stringify(DEFAULT_POSITION));
    set({ position: DEFAULT_POSITION });
  },
  setMode: (mode) => {
    localStorage.setItem('xiaof-pet-mode', JSON.stringify(mode));
    set({ mode });
  },
}));
