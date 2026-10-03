// The weekly leaderboard: XP earned since Monday by everyone in the beta. Resets every Monday.
import { RANKS } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { BoardRow, useBoard } from '../components/Board';
import { Icon } from '../components/icons';
import { Panel } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Txt } from '../components/ui';
import { C } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

export default function Board() {
  const s = useStore();
  const g = useGame();
  const rows = useBoard();
  const me = s.account.uid;
  const place = rows ? rows.findIndex(r => r.uid === me) + 1 : 0;
  const dayOfWeek = (new Date().getDay() + 6) % 7;
  return (
    <Screen tabs={false}>
      <SubHeader title="WEEKLY BOARD" onBack={() => router.back()} />
      <Panel acc={s.accent} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Icon name="board" size={40} color={s.accent} tint={0.3} />
          <View style={{ flex: 1, gap: 3 }}>
            <Txt size={20} w={600}>{place ? `You're #${place}` : s.cloud ? 'Not on the board yet' : 'Sample board'}</Txt>
            <Txt size={13} color={C.sub}>{`${g.weekXp} XP this week · resets in ${7 - dayOfWeek} day${7 - dayOfWeek === 1 ? '' : 's'}`}</Txt>
          </View>
        </View>
        <Txt size={12} color={C.faint} style={{ marginTop: 12 }}>XP comes from what you log: meals, protein days, sessions, runs, weigh-ins and streaks. Same rules for everyone.</Txt>
      </Panel>
      <View style={{ marginTop: 18, gap: 8 }}>
        {rows === null ? <Txt size={14} color={C.dim}>Loading the board…</Txt> : null}
        {rows?.length === 0 ? <Txt size={14} color={C.dim}>Nobody has scored this week yet. Log anything to take first place.</Txt> : null}
        {rows?.map((r, i) => <BoardRow key={r.uid} r={r} place={i + 1} me={r.uid === me} />)}
      </View>
      <Txt face="mono" size={10} ls={0.12} color={C.faint} style={{ marginTop: 22 }}>
        {`RANKS · ${RANKS.map(r => `${r.name.toUpperCase()} ${r.min}`).join(' · ')}`}
      </Txt>
    </Screen>
  );
}
