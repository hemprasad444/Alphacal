// The weekly ladder: XP earned since Monday by everyone in the beta. Resets every Monday.
import { RANKS } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { BoardLadder, useBoard } from '../components/Board';
import { SectionHeader } from '../components/fight';
import { Screen, SubHeader } from '../components/Screen';
import { Row, Toggle, Txt } from '../components/ui';
import { F, SP } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

export default function Board() {
  const s = useStore();
  const g = useGame();
  const rows = useBoard();
  const me = s.account.uid;
  const shown = s.settings.board !== false;
  const place = rows ? rows.findIndex(r => r.uid === me) + 1 : 0;
  const dayOfWeek = (new Date().getDay() + 6) % 7;
  const left = 7 - dayOfWeek;
  return (
    <Screen tabs={false}>
      <SubHeader title="Weekly ladder" onBack={() => router.back()} />

      <View style={{ marginTop: SP.lg, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View accessibilityRole="header" style={{ flexShrink: 1, alignItems: 'flex-start' }}>
            {place ? <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>YOUR PLACE</Txt> : null}
            <Txt face="display" size={place ? 56 : 30} lh={place ? 1.1 : 1.2} color={place ? s.accent : F.chalk}>
              {place ? `#${place}` : !s.cloud ? 'SAMPLE LADDER' : shown ? 'NOT ON THE LADDER YET' : 'HIDDEN FROM THE LADDER'}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Txt face="display" size={32} lh={1.15}>{g.weekXp.toLocaleString('en-US')}</Txt>
              <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>XP</Txt>
            </View>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`THIS WEEK · RESETS IN ${left} DAY${left === 1 ? '' : 'S'}`}</Txt>
          </View>
        </View>
        <Txt size={14} w={500} lh={1.4} color={F.smoke}>XP comes from what you log: meals, protein days, sessions, runs, weigh-ins and streaks. Same rules for everyone.</Txt>
        {s.cloud ? (
          <View style={{ backgroundColor: F.canvas, paddingHorizontal: SP.md }}>
            <Row title="Show me on the board" sub="Your first name and XP, seen by everyone in the beta" right={<Toggle on={shown} onPress={() => s.setOpt('board', !shown)} accessibilityLabel="Show me on the board" />} last />
          </View>
        ) : null}
      </View>

      <SectionHeader title="This week" meta={rows?.length ? `${rows.length} on the ladder` : undefined} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md }}>
        {rows === null ? <Txt size={14} w={500} color={F.smoke}>Loading the board…</Txt> : null}
        {rows?.length === 0 ? <Txt size={14} w={500} lh={1.4} color={F.smoke}>Nobody has scored this week yet. Log anything to take first place.</Txt> : null}
        {rows?.length ? <BoardLadder rows={rows} /> : null}
      </View>

      <SectionHeader title="Ranks" meta="Total XP" style={{ marginTop: SP.xxl }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: SP.lg, rowGap: SP.xs, marginTop: SP.md }}>
        {RANKS.map(r => (
          <Txt key={r.id} face="label" w={600} size={13} ls={0.1} color={r.id === g.rank.id ? s.accent : F.smoke}>{`${r.name.toUpperCase()} ${r.min.toLocaleString('en-US')}`}</Txt>
        ))}
      </View>
    </Screen>
  );
}
