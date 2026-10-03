// Names of REI's icons (drawn in app/src/components/icons.tsx). Shared so the logic that
// builds rows and plans can say which picture goes with them.
import type { SessionKey } from './data';

export type IconKey =
  | 'today' | 'fuel' | 'protein' | 'carbs' | 'fat' | 'kcal' | 'train' | 'strength' | 'steps' | 'sleep'
  | 'vow' | 'rei' | 'voice' | 'settings' | 'rank' | 'badge' | 'board' | 'streak' | 'log' | 'progress'
  | 'weight' | 'look' | 'bell' | 'memory' | 'profile' | 'run' | 'ride' | 'sport' | 'gym' | 'timer'
  | 'camera' | 'barcode' | 'plus' | 'check' | 'close' | 'chevron' | 'back' | 'lock' | 'door'
  | 'kunai' | 'strawhat' | 'fist' | 'eye' | 'wave';

/** The picture for each kind of training day. */
export const SESSION_ICON: Record<SessionKey, IconKey> = { PUSH: 'gym', PULL: 'strength', LEGS: 'train', RUN: 'run', CALI: 'fist', REST: 'sleep' };
