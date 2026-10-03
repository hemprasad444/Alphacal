// The weekly leaderboard: live rows from Firestore (a sample board in demo mode).
import { isoWeek, RANKS } from '@rei/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from './icons';
import { Txt } from './ui';
import { onBoard, type Player } from '../lib/sync';
import { alpha, C, THEMES } from '../lib/theme';
import { useStore } from '../state/store';

/** Top three this week and where you stand. Demo mode shows a sample board. */
export function BoardPreview({ you }: { you: number }) {
  const s = useStore();
  const rows = useBoard();
  const me = s.account.uid;
  const list = rows ?? [];
  const mine = list.findIndex(r => r.uid === me);
  const top = list.slice(0, 3);
  if (!list.length) {
    return <Txt size={14} color={C.dim} style={{ marginTop: 12 }}>{s.cloud ? 'Nobody on the board yet this week. Log anything to claim first place.' : 'Sign in to join the weekly board.'}</Txt>;
  }
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {top.map((r, i) => <BoardRow key={r.uid} r={r} place={i + 1} me={r.uid === me} />)}
      {mine >= 3 ? <BoardRow r={{ ...list[mine], xp: Math.max(you, list[mine].xp) }} place={mine + 1} me /> : null}
    </View>
  );
}

export function BoardRow({ r, place, me }: { r: Player; place: number; me?: boolean }) {
  const t = THEMES.find(x => x.id === r.theme) ?? THEMES[0];
  const medal = place === 1 ? '#F5C542' : place === 2 ? '#C9D3DE' : place === 3 ? '#D9925B' : C.muted;
  const rank = RANKS.find(x => x.id === r.rank);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: me ? t.acc : C.line3, backgroundColor: me ? alpha(t.acc, 0.08) : '#0D0F13' }}>
      <Txt face="mono" size={16} w={500} color={medal} style={{ width: 26 }}>{String(place).padStart(2, '0')}</Txt>
      <Icon name={t.icon} size={20} color={t.acc} />
      <View style={{ flex: 1 }}>
        <Txt size={15} w={500} numberOfLines={1}>{me ? `${r.name} (you)` : r.name}</Txt>
        <Txt face="mono" size={9.5} ls={0.12} color={C.dim}>{(rank?.name ?? 'Rookie').toUpperCase()}</Txt>
      </View>
      <Txt face="mono" size={14} color={me ? t.acc : C.body}>{`${r.xp.toLocaleString('en-US')} XP`}</Txt>
    </View>
  );
}

/** This week's board, live; null while loading. Demo mode gets a sample so the screen isn't empty. */
export function useBoard(): Player[] | null {
  const cloud = useStore(s => s.cloud);
  const [rows, setRows] = useState<Player[] | null>(null);
  useEffect(() => (cloud ? onBoard(isoWeek(), setRows) : undefined), [cloud]);
  return cloud ? rows : SAMPLE;
}

const SAMPLE: Player[] = [
  { uid: 's1', name: 'Kiran', xp: 1240, rank: 'fighter', theme: 'shinobi', updatedAt: 0 },
  { uid: 's2', name: 'Aisha', xp: 1105, rank: 'vanguard', theme: 'slayer', updatedAt: 0 },
  { uid: 's3', name: 'Rohan', xp: 860, rank: 'trainee', theme: 'cursed', updatedAt: 0 },
  { uid: 's4', name: 'Meera', xp: 640, rank: 'trainee', theme: 'voyager', updatedAt: 0 },
];
