// This week's board: XP earned since Monday by everyone in the beta. Resets every Monday.
// Under it, the ranks: eight steps of total XP, with the one you stand on and the next one up.
import { RANKS } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { BoardLadder, useBoard, useStanding } from '../components/Board';
import { MeterBar, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Row, Toggle, Txt } from '../components/ui';
import { C, F, SP } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

const num = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Board() {
  const s = useStore();
  const g = useGame();
  const rows = useBoard();
  const me = s.account.uid;
  const shown = s.settings.board !== false;
  const ladder = useStanding(rows ?? [], g.weekXp, g.rank.name);
  // Your place counts once you're really on the board (signed in, shown, scored).
  const place = rows?.some(r => r.uid === me) ? ladder.findIndex(r => r.you) + 1 : 0;
  const dayOfWeek = (new Date().getDay() + 6) % 7;
  const left = 7 - dayOfWeek;
  return (
    <Screen tabs={false}>
      <SubHeader title="This week's board" onBack={() => router.back()} />

      <View style={{ marginTop: SP.xxl, gap: SP.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View accessibilityRole="header" style={{ flexShrink: 1, alignItems: 'flex-start', gap: SP.xs }}>
            {place ? <Txt face="label" size={12} lh={1.35} color={F.smoke}>Your place</Txt> : null}
            <Txt face="display" exact size={place ? 44 : 24} lh={place ? 1.2 : 1.3} color={place ? s.accent : F.chalk}>
              {place ? `#${place}` : !s.cloud ? 'Sample board' : shown ? 'Not on the board yet' : 'Hidden from the board'}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: SP.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
              <Txt face="num" raw size={24} lh={1.3}>{num(g.weekXp)}</Txt>
              <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>XP</Txt>
            </View>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`Resets in ${left} day${left === 1 ? '' : 's'}`}</Txt>
          </View>
        </View>
        <Txt size={15} w={500} lh={1.5} color={F.smoke}>XP comes from what you log: meals, protein days, sessions, runs, weight entries and streaks. The same rules for everyone.</Txt>
        {s.cloud ? (
          <Card style={{ paddingHorizontal: SP.lg }}>
            <Row title="Show me on the board" sub="Your first name and XP, seen by everyone in the beta" right={<Toggle on={shown} onPress={() => s.setOpt('board', !shown)} accessibilityLabel="Show me on the board" />} last />
          </Card>
        ) : null}
      </View>

      <SectionHeader title="This week" meta={rows?.length ? `${rows.length} on the board` : undefined} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md }}>
        {rows === null ? <Txt size={15} w={500} lh={1.5} color={F.smoke}>Loading the board…</Txt> : null}
        {rows?.length === 0 ? <Txt size={15} w={500} lh={1.5} color={F.smoke}>Nobody has scored this week yet. Log anything to take first place.</Txt> : null}
        {rows?.length ? <BoardLadder rows={rows} you={g.weekXp} rank={g.rank.name} /> : null}
      </View>

      <SectionHeader title="Ranks" meta="Total XP" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
            <Txt face="num" raw size={24} lh={1.3} color={s.accent}>{num(g.xp)}</Txt>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>XP in total</Txt>
          </View>
          <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{g.next ? `${num(g.next.min - g.xp)} to ${g.next.name}` : 'Top rank'}</Txt>
        </View>
        <MeterBar pct={g.progress} height={12} accessibilityLabel={g.next ? `${num(g.xp)} of ${num(g.next.min)} XP to ${g.next.name}` : `${num(g.xp)} XP, top rank`} />
      </View>
      <RankSteps xp={g.xp} current={g.rank.id} accent={s.accent} />
    </Screen>
  );
}

/**
 * The eight ranks as a quiet list, top rank first. Ranks behind you are ticked, yours carries the
 * accent down its left edge, the next one says how far it is, and the rest wait in ash.
 */
function RankSteps({ xp, current, accent }: { xp: number; current: string; accent: string }) {
  const at = Math.max(0, RANKS.findIndex(r => r.id === current));
  const steps = [...RANKS].reverse();
  return (
    <Card style={{ marginTop: SP.lg, overflow: 'hidden' }}>
      {steps.map((r, k) => {
        const i = RANKS.indexOf(r);
        const mine = i === at, cleared = i < at, next = i === at + 1;
        const ink = mine || cleared || next ? F.chalk : F.smoke;
        const say = `Rank ${i + 1}, ${r.name}, ${num(r.min)} XP. ${mine ? 'Your rank' : cleared ? 'Cleared' : `${num(r.min - xp)} XP to go`}`;
        return (
          <View key={r.id} accessible accessibilityLabel={say} style={{ minHeight: 52, paddingHorizontal: SP.lg, paddingVertical: SP.sm, flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: mine ? F.canvas2 : 'transparent', borderTopWidth: k ? 1 : 0, borderTopColor: C.line }}>
            {mine ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: accent }} /> : null}
            <Txt face="heading" raw size={17} lh={1.4} color={mine ? accent : F.smoke} style={{ minWidth: 16 }}>{i + 1}</Txt>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={15} w={500} lh={1.4} color={ink} numberOfLines={1}>{r.name}</Txt>
              {mine || next ? <Txt face="mono" raw size={12} lh={1.35} color={mine ? accent : F.smoke} numberOfLines={1}>{mine ? 'You are here' : `${num(r.min - xp)} XP to go`}</Txt> : null}
            </View>
            {cleared ? <Icon name="check" size={16} color={F.smoke} tint={0} strokeWidth={1.7} /> : null}
            <Txt face="num" raw size={14} lh={1.3} color={ink}>{num(r.min)}</Txt>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>XP</Txt>
          </View>
        );
      })}
    </Card>
  );
}
