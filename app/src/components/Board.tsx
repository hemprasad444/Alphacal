// The weekly leaderboard as a ladder: live rows from Firestore (a sample board in demo mode).
import { isoWeek, RANKS, xpToPass } from '@rei/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ladder, type LadderRow } from './fight';
import { Txt } from './ui';
import { onBoard, type Player } from '../lib/sync';
import { F, SP } from '../lib/theme';
import { useStore } from '../state/store';

const rankName = (id: string) => RANKS.find(x => x.id === id)?.name ?? 'Rookie';

/**
 * The board as rungs, best first. `limit` keeps the top few and still shows your rung when you
 * are below them. `you` is your live XP this week (the board can lag behind what you just logged).
 * The line underneath says what it takes to pass the player above you.
 */
export function BoardLadder({ rows, limit, you }: { rows: Player[]; limit?: number; you?: number }) {
  const me = useStore(s => s.account.uid);
  const mine = rows.findIndex(r => r.uid === me);
  const rung = (r: Player, i: number): LadderRow => ({ id: r.uid, rank: i + 1, name: r.name, score: r.xp, you: r.uid === me, tag: rankName(r.rank) });
  const shown = rows.map(rung).filter((_, i) => !limit || i < limit);
  // Your XP is the live figure wherever you stand: the board can lag behind what you just logged.
  const myXp = mine >= 0 ? Math.max(you ?? 0, rows[mine].xp) : 0;
  if (limit && mine >= limit) shown.push({ ...rung(rows[mine], mine), score: myXp });
  const above = mine > 0 ? rows[mine - 1] : null;
  // Already past them on live XP (the board hasn't caught up): say nothing rather than "1 XP to pass".
  const gap = above ? xpToPass(above.xp, myXp) : 0;
  return (
    <View style={{ gap: SP.sm }}>
      <Ladder rows={shown} showGap={false} />
      {mine >= 0 && (!above || gap > 0) ? (
        <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>
          {above ? `${gap.toLocaleString('en-US')} XP TO PASS ${above.name.toUpperCase()}` : 'TOP OF THE LADDER. HOLD IT.'}
        </Txt>
      ) : null}
    </View>
  );
}

/** Top three this week and where you stand. Demo mode shows a sample board. */
export function BoardPreview({ you }: { you: number }) {
  const cloud = useStore(s => s.cloud);
  const rows = useBoard();
  const list = rows ?? [];
  if (!list.length) {
    return <Txt size={14} w={500} lh={1.4} color={F.smoke}>{cloud ? 'Nobody on the board yet this week. Log anything to claim first place.' : 'Sign in to join the weekly board.'}</Txt>;
  }
  return <BoardLadder rows={list} limit={3} you={you} />;
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
