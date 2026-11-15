// The weekly leaderboard as a ladder: live rows from Firestore (a sample board in demo mode).
// Your rung is always on it, wherever you stand, with what it takes to climb.
import { isoWeek, RANKS } from '@rei/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ladder, ladderLines, type LadderRow } from './fight';
import { Txt } from './ui';
import { onBoard, type Player } from '../lib/sync';
import { F, SP } from '../lib/theme';
import { useStore } from '../state/store';

const rankName = (id: string) => RANKS.find(x => x.id === id)?.name ?? 'Rookie';

/**
 * The whole ladder, best first, with you on it. `you` is your live XP this week (the board can lag
 * behind what you just logged) and `rank` your rank's name. You are slotted in by live XP, below
 * anyone on the same score (passing takes one more XP than they have). Not posted yet, hidden from
 * the board or in the demo, your rung is still there: only its tag changes.
 */
export function useStanding(rows: Player[], you = 0, rank?: string): LadderRow[] {
  const me = useStore(s => s.account.uid), name = useStore(s => s.profile.name), cloud = useStore(s => s.cloud), listed = useStore(s => s.settings.board !== false);
  const posted = rows.find(r => r.uid === me);
  const score = Math.max(you, posted?.xp ?? 0);
  const tag = posted ? rankName(posted.rank) : !cloud || listed ? rank : 'Hidden · only you see this';
  const mine = { id: me || 'you', name: posted?.name ?? (name.trim().split(/\s+/)[0] || 'You'), score, you: true, tag };
  const others = rows.filter(r => r.uid !== me).map(r => ({ id: r.uid, name: r.name, score: r.xp, tag: rankName(r.rank) })).sort((a, b) => b.score - a.score);
  const at = others.filter(r => r.score >= score).length;
  return [...others.slice(0, at), mine, ...others.slice(at)].map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * The board as rungs. `limit` keeps the top few; when you stand below them your rung follows after
 * a break that says how many are in between. The lines underneath say what it takes to pass the
 * player above you, and to take the top.
 */
export function BoardLadder({ rows, limit, you, rank }: { rows: Player[]; limit?: number; you?: number; rank?: string }) {
  const accent = useStore(s => s.accent);
  const list = useStanding(rows, you, rank);
  const mine = list.findIndex(r => r.you);
  const shown = list.filter((_, i) => !limit || i < limit || i === mine).map(r => (limit && r.you && mine > limit ? { ...r, skipped: mine - limit } : r));
  const lines = ladderLines(list);
  return (
    <View style={{ gap: SP.sm }}>
      <Ladder rows={shown} showGap={false} />
      {lines ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: SP.md, rowGap: 2 }}>
          <Txt face="label" w={600} size={12} ls={0.12} color={accent}>{lines.next}</Txt>
          {lines.top ? <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{lines.top}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Top three this week and where you stand. Demo mode shows a sample board. */
export function BoardPreview({ you, rank }: { you: number; rank?: string }) {
  const cloud = useStore(s => s.cloud);
  const rows = useBoard();
  const list = rows ?? [];
  if (!list.length) {
    return <Txt size={14} w={500} lh={1.4} color={F.smoke}>{cloud ? 'Nobody on the board yet this week. Log anything to claim first place.' : 'Sign in to join the weekly board.'}</Txt>;
  }
  return <BoardLadder rows={list} limit={3} you={you} rank={rank} />;
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
