// REI's icon set: small hand-drawn props from anime worlds instead of kanji labels.
// Ramen for fuel, meat on the bone for protein, onigiri for carbs, a karate gi for training,
// a torii for home. Line art on a 24-unit grid with a soft tint fill, so they read at 14–40 px.
import type { IconKey } from '@rei/shared';
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

export type { IconKey };

interface Draw {
  /** Stroke colour. */
  c: string;
  /** Tint for filled areas. */
  f: string;
}

const P = ({ d, fill }: { d: string; fill?: string }) => <Path d={d} fill={fill ?? 'none'} />;

const ICONS: Record<IconKey, (k: Draw) => ReactNode> = {
  // Home: a torii gate.
  today: ({ f }) => (
    <>
      <P d="M2.5 5.2c3.6 1.3 15.4 1.3 19 0l-.6 2.3c-3.8.9-14 .9-17.8 0z" fill={f} />
      <P d="M5 10.5h14" />
      <P d="M6.8 7.6V21M17.2 7.6V21M12 7.9v2.6" />
    </>
  ),
  // Fuel: a bowl of ramen with an egg, a naruto slice and chopsticks.
  fuel: ({ f }) => (
    <>
      <P d="M2.8 11.5h18.4c0 4.6-3.7 8.2-8.2 8.2h-2c-4.5 0-8.2-3.6-8.2-8.2z" fill={f} />
      <P d="M9 20.4h6" />
      <P d="M5.6 11.5a2.3 2.3 0 0 1 4.6 0" />
      <Circle cx={13.2} cy={10.6} r={1.3} fill="none" />
      <P d="M14.5 9.2 21.5 3M16.8 10.6l5-4.4" />
      <P d="M7 7.6c-.7-.8.7-1.6 0-2.4M10 7.8c-.7-.8.7-1.6 0-2.4" />
    </>
  ),
  // Protein: anime meat on the bone.
  protein: ({ f }) => (
    <>
      <P d="M9.3 6.2c3.3-3.3 9-2.7 10.3 1 1.2 3.4-1.5 7.6-5.6 8.6-2.4.6-4.6.2-5.9-1.1-1.6-1.7-1.6-5.6 1.2-8.5z" fill={f} />
      <P d="M12.4 8.3c1.3-.9 3-.9 4 0" />
      <P d="M8.4 14.6 4.9 18.1" />
      <Circle cx={3.9} cy={17.6} r={1.4} fill="none" />
      <Circle cx={5.4} cy={19.6} r={1.4} fill="none" />
    </>
  ),
  // Carbs: an onigiri with its nori wrap.
  carbs: ({ f, c }) => (
    <>
      <P d="M12 3.4c1.1 0 1.9.6 2.5 1.6l5.8 10c1.3 2.2-.3 4.8-2.8 4.8H6.5c-2.5 0-4.1-2.6-2.8-4.8l5.8-10C10.1 4 10.9 3.4 12 3.4z" fill={f} />
      <Path d="M8.6 14.2h6.8v5.6H8.6z" fill={c} stroke="none" fillOpacity={1} />
    </>
  ),
  // Fat: a drop of oil with a highlight.
  fat: ({ f }) => (
    <>
      <P d="M12 3.2c3.2 4.1 6.2 7.4 6.2 10.8a6.2 6.2 0 0 1-12.4 0c0-3.4 3-6.7 6.2-10.8z" fill={f} />
      <P d="M9.3 14.3a2.8 2.8 0 0 0 2.4 2.8" />
    </>
  ),
  // Calories: a flame with an inner flame.
  kcal: ({ f }) => (
    <>
      <P d="M12 2.8c1 3.6 5.7 5.6 5.7 10.6a5.7 5.7 0 0 1-11.4 0c0-3.5 2.6-4.6 2.6-7.6 1.7 1 2.5 2.3 2.7 3.7 1.4-1.3 1-4.1.4-6.7z" fill={f} />
      <P d="M12 18.6a2.2 2.2 0 0 1-2.2-2.2c0-1.5 1.2-2 1.6-3.4.9.7 2.8 1.8 2.8 3.4a2.2 2.2 0 0 1-2.2 2.2z" />
    </>
  ),
  // Training: a karate gi with its belt knot.
  train: ({ f }) => (
    <>
      <P d="M7.2 3.6 12 9l4.8-5.4 3.4 2.3-1.7 14.5h-13L3.8 5.9z" fill={f} />
      <P d="M7.2 3.6 12 12.2l4.8-8.6" />
      <P d="M5.2 14.2h13.6" />
      <P d="M12 14.2 9.9 18.4M12 14.2l2.1 4.2" />
    </>
  ),
  // Strength: a katana.
  strength: ({ f }) => (
    <>
      <P d="M21.2 2.8c-.4 3-2.4 6.2-6 9.8l-4.3 4.3-1.9-1.9 4.3-4.3c3.6-3.6 6.9-6.9 7.9-7.9z" fill={f} />
      <P d="M6.9 13.2l3.9 3.9" />
      <P d="M8.6 16.7l-4.9 4.9" />
      <P d="M5.6 18.2l.9.9" />
    </>
  ),
  // Steps: two footprints walking.
  steps: ({ f }) => (
    <>
      <Ellipse cx={8} cy={8.3} rx={2.6} ry={4.2} fill={f} />
      <Ellipse cx={8} cy={15.2} rx={1.7} ry={1.5} fill={f} />
      <Ellipse cx={16} cy={11.7} rx={2.6} ry={4.2} fill={f} />
      <Ellipse cx={16} cy={18.6} rx={1.7} ry={1.5} fill={f} />
    </>
  ),
  // Sleep: a crescent moon with a z.
  sleep: ({ f }) => (
    <>
      <P d="M19.4 15.2A8.2 8.2 0 0 1 8.8 4.6 8.2 8.2 0 1 0 19.4 15.2z" fill={f} />
      <P d="M14.5 3.5h3.4l-3.4 3.4h3.4" />
    </>
  ),
  // The vow: a scroll with a seal.
  vow: ({ f, c }) => (
    <>
      <P d="M6 5.2h12v13.6H6z" fill={f} />
      <P d="M3.8 5.2h16.4M3.8 18.8h16.4" />
      <P d="M8.8 9h6.4M8.8 12h6.4M8.8 15h3.4" />
      <Circle cx={15.6} cy={15.4} r={1.3} fill={c} stroke="none" fillOpacity={1} />
    </>
  ),
  // REI: the three-tomoe core.
  rei: ({ f, c }) => (
    <>
      <Circle cx={12} cy={12} r={9.2} fill={f} />
      <G fill={c} stroke="none" fillOpacity={1}>
        <Path d="M12 6.4a2 2 0 1 1-.1 4c-1.6.1-2.2 1-2.6 2.2-.3-2.4.6-6.1 2.7-6.2z" />
        <Path d="M16.9 14.8a2 2 0 1 1-3.5-1.9c.7-1.4.2-2.4-.7-3.3 2.3.9 5 3.6 4.2 5.2z" />
        <Path d="M7.1 14.8a2 2 0 1 1 3.4-2c.8 1.4 1.9 1.4 3.2 1.2-1.9 1.5-5.5 2.4-6.6.8z" />
      </G>
    </>
  ),
  // Live voice: sound waves.
  voice: () => <P d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />,
  // Settings: a shuriken.
  settings: ({ f }) => (
    <>
      <P d="M12 2.6l2.1 7.3 7.3 2.1-7.3 2.1-2.1 7.3-2.1-7.3L2.6 12l7.3-2.1z" fill={f} />
      <Circle cx={12} cy={12} r={1.7} fill="none" />
    </>
  ),
  // Rank: a crest with chevrons.
  rank: ({ f }) => (
    <>
      <P d="M12 2.8l7.2 3v5.6c0 4.5-3 8-7.2 9.8-4.2-1.8-7.2-5.3-7.2-9.8V5.8z" fill={f} />
      <P d="M8.4 9.2 12 11.8l3.6-2.6M8.4 12.8 12 15.4l3.6-2.6" />
    </>
  ),
  // A badge: a medal on a ribbon.
  badge: ({ f }) => (
    <>
      <P d="M8 2.8l2.6 6.4M16 2.8l-2.6 6.4" />
      <Circle cx={12} cy={15} r={5.6} fill={f} />
      <P d="M12 12l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
    </>
  ),
  // Leaderboard: a podium with a star.
  board: ({ f }) => (
    <>
      <P d="M3 20.5V14h6v6.5M9 20.5V9.5h6v11M15 20.5V12h6v8.5" fill={f} />
      <P d="M2 20.5h20" />
      <P d="M12 2.8l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" />
    </>
  ),
  // Streak: a flame (the same family as calories, sharper).
  streak: ({ f }) => (
    <>
      <P d="M13 2.5c.4 2.8 4.8 5 4.8 10.4a5.8 5.8 0 0 1-11.6 0c0-2.9 1.6-4.3 2.4-6.4.9 1.2 1.2 2.6 1.1 3.9C12.4 8.4 13.6 5.7 13 2.5z" fill={f} />
      <P d="M12 18.7c-1.3 0-2.2-.9-2.2-2.1 0-1.6 1.6-2.3 2.2-3.8.6 1.5 2.2 2.2 2.2 3.8 0 1.2-.9 2.1-2.2 2.1z" />
    </>
  ),
  // Training log: a book with a bookmark.
  log: ({ f }) => (
    <>
      <P d="M5 4.5h10a3 3 0 0 1 3 3V20.5H8a3 3 0 0 1-3-3z" fill={f} />
      <P d="M5 17.5a3 3 0 0 1 3-3h10" />
      <P d="M9 4.5v6l1.8-1.3 1.8 1.3v-6" />
    </>
  ),
  // Progress: Mount Fuji.
  progress: ({ f }) => (
    <>
      <P d="M2.5 19.5 9.2 8.4c.5-.8 1.1-1.2 2.8-1.2s2.3.4 2.8 1.2l6.7 11.1z" fill={f} />
      <P d="M7.6 11.1l1.7 1.3 1.4-1.1 1.3 1.2 1.3-1.2 1.4 1.1 1.7-1.3" />
    </>
  ),
  // Weight: a bathroom scale.
  weight: ({ f }) => (
    <>
      <P d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill={f} />
      <P d="M8.2 10.4a4 4 0 0 1 7.6 0z" />
      <P d="M12 10.4l1.4-2" />
    </>
  ),
  // Look: a folding fan.
  look: ({ f }) => (
    <>
      <P d="M12 19.5 3.2 10.3a12.4 12.4 0 0 1 17.6 0z" fill={f} />
      <P d="M12 19.5 7.4 7.3M12 19.5V6.4M12 19.5l4.6-12.2" />
      <Circle cx={12} cy={19.5} r={1} fill="none" />
    </>
  ),
  // Notifications: a temple bell.
  bell: ({ f }) => (
    <>
      <P d="M7 9.5a5 5 0 0 1 10 0v6l1.6 2.3H5.4L7 15.5z" fill={f} />
      <P d="M12 2.8v1.7M10 20.6a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  // Memory: a lantern.
  memory: ({ f }) => (
    <>
      <P d="M9 3.5h6M9 20.5h6M12 2v1.5" />
      <P d="M8.5 5.5h7c2.4 1.6 3.4 4 3.4 6.5s-1 4.9-3.4 6.5h-7c-2.4-1.6-3.4-4-3.4-6.5s1-4.9 3.4-6.5z" fill={f} />
      <P d="M5.3 10h13.4M5.3 14h13.4" />
    </>
  ),
  // Profile: a ninja headband.
  profile: ({ f }) => (
    <>
      <Circle cx={12} cy={9} r={4.6} fill={f} />
      <P d="M7.2 8h9.6M16.8 8l3.5 1.5M16.8 8l2.6 3" />
      <P d="M4.6 20.6c1-3.6 4-5.4 7.4-5.4s6.4 1.8 7.4 5.4" />
    </>
  ),
  // Run: a figure mid-stride with speed lines.
  run: ({ f }) => (
    <>
      <Circle cx={15} cy={4.6} r={2} fill={f} />
      <P d="M14.2 8.2 11 13.4l3 2.3-1.8 5" />
      <P d="M11 13.4l-4.2.9" />
      <P d="M14.2 8.2l2.6 3.2 3-.9" />
      <P d="M14.2 8.2l-4 .4-2 2.3" />
      <P d="M2.5 9.5h3M2 13h2.5M3 16.5h2.5" />
    </>
  ),
  // Ride: a bicycle.
  ride: ({ f }) => (
    <>
      <Circle cx={6} cy={16} r={3.8} fill={f} />
      <Circle cx={18} cy={16} r={3.8} fill={f} />
      <P d="M6 16l4-7.5h5.5L18 16M10 8.5 12.4 16H6M14 6h2.4" />
    </>
  ),
  // Sport: a ball mid-flight.
  sport: ({ f }) => (
    <>
      <Circle cx={13.5} cy={10.5} r={7} fill={f} />
      <P d="M7.4 7.2c3.6 1.4 8.7 1.6 12.2-.1M8.5 15.2c3.2-1 7-1.5 10.4.3M13.5 3.5c-2.4 3.6-2.4 10.2 0 14" />
      <P d="M2.5 18.5h4M3.5 21h4" />
    </>
  ),
  // Gym: a dumbbell.
  gym: ({ f }) => (
    <>
      <P d="M5.5 7.5h2v9h-2zM16.5 7.5h2v9h-2z" fill={f} />
      <P d="M3 9.5v5M21 9.5v5M7.5 12h9" />
    </>
  ),
  // A timer.
  timer: ({ f }) => (
    <>
      <Circle cx={12} cy={13.2} r={7.6} fill={f} />
      <P d="M12 13.2V9M9.6 2.8h4.8M12 2.8v2.8M18.4 6.4l1.4-1.4" />
    </>
  ),
  // Camera, for photo logging.
  camera: ({ f }) => (
    <>
      <P d="M3.5 8.5a2 2 0 0 1 2-2h2.3l1.6-2.2h5.2l1.6 2.2h2.3a2 2 0 0 1 2 2v9.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill={f} />
      <Circle cx={12} cy={13} r={3.6} fill="none" />
    </>
  ),
  // Barcode.
  barcode: () => <P d="M4 5v14M7 5v14M10 5v14M12.5 5v14M16 5v14M18 5v14M20.5 5v14" />,
  // Add.
  plus: () => <P d="M12 5v14M5 12h14" />,
  // Done.
  check: () => <P d="M4.5 12.5l4.6 4.6L19.5 6.6" />,
  // Close.
  close: () => <P d="M6 6l12 12M18 6 6 18" />,
  // Forward.
  chevron: () => <P d="M9 5l7 7-7 7" />,
  // Back.
  back: () => <P d="M15 5l-7 7 7 7" />,
  // Lock, for badges not yet earned.
  lock: ({ f }) => (
    <>
      <P d="M6 11h12v9.5H6z" fill={f} />
      <P d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  // Account / sign out: a door.
  door: ({ f }) => (
    <>
      <P d="M6 3.5h9.5v17H6z" fill={f} />
      <P d="M15.5 6.5l3.5 1.4v12.6H15.5" />
      <Circle cx={12.8} cy={12} r={0.9} fill="none" />
    </>
  ),
  // Theme crests.
  kunai: ({ f }) => (
    <>
      <P d="M12 2.5 15 11h-6z" fill={f} />
      <P d="M9.6 11h4.8M12 11v6.5" />
      <Circle cx={12} cy={19.6} r={2} fill="none" />
    </>
  ),
  strawhat: ({ f, c }) => (
    <>
      <P d="M2.5 15.2c0-1.4 4.3-2.5 9.5-2.5s9.5 1.1 9.5 2.5-4.3 2.5-9.5 2.5-9.5-1.1-9.5-2.5z" fill={f} />
      <P d="M7 13.2c0-4 2.2-6.7 5-6.7s5 2.7 5 6.7" fill={f} />
      <Path d="M7.2 11.6c3.2.7 6.4.7 9.6 0l.2 1.6c-3.3.8-6.7.8-10 0z" fill={c} stroke="none" fillOpacity={1} />
    </>
  ),
  fist: ({ f }) => (
    <>
      <P d="M6.5 10.5V7.8a1.6 1.6 0 0 1 3.2 0V10M9.7 9.6V6.8a1.6 1.6 0 0 1 3.2 0v3M12.9 9.6V7.2a1.6 1.6 0 0 1 3.2 0v3.2M16.1 10.4V8.8a1.6 1.6 0 0 1 3.2 0v4.6c0 4-3 7.1-7 7.1h-.8c-3.3 0-5.8-2.3-6.5-5.4l-.6-2.6c-.3-1.3.8-2.4 2.1-2.1l1.9.5" fill={f} />
    </>
  ),
  eye: ({ f, c }) => (
    <>
      <P d="M2.5 12c2.4-4.2 5.8-6.3 9.5-6.3s7.1 2.1 9.5 6.3c-2.4 4.2-5.8 6.3-9.5 6.3S4.9 16.2 2.5 12z" fill={f} />
      <Circle cx={12} cy={12} r={3.4} fill="none" />
      <Circle cx={12} cy={12} r={1.3} fill={c} stroke="none" fillOpacity={1} />
    </>
  ),
  wave: ({ f }) => (
    <>
      <P d="M2.5 15.5c2.4-6.5 7.6-10.2 13.4-9.3-2.8 1.3-3.6 3.4-2.6 5.5 1.3 2.6 4.6 2.6 6.4.6 0 3.9-3.3 7.2-8.6 7.2H2.5z" fill={f} />
      <P d="M2.5 19.5h19" />
    </>
  ),
};

/** One of REI's icons. `tint` fills its shapes at low strength; set it to 0 for line only. */
export function Icon({ name, size = 22, color, tint = 0.22, strokeWidth = 1.7 }: { name: IconKey; size?: number; color: string; tint?: number; strokeWidth?: number }) {
  const draw = ICONS[name] ?? ICONS.rei;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <G fillOpacity={tint}>{draw({ c: color, f: color })}</G>
    </Svg>
  );
}
