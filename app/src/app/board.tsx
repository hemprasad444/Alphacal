// The weekly ladder: XP earned since Monday by everyone in the beta. Resets every Monday.
// Under it, the rank ladder: eight steps of total XP, with the one you stand on and the next one up.
import { RANKS } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { BoardLadder, useBoard, useStanding } from '../components/Board';
import { CutBox } from '../components/cut';
import { MeterBar, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Row, Toggle, Txt } from '../components/ui';
import { F, onColor, SHADOW, SP } from '../lib/theme';
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
              <Txt face="display" size={32} lh={1.15}>{num(g.weekXp)}</Txt>
              <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>XP</Txt>
            </View>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`THIS WEEK · RESETS IN ${left} DAY${left === 1 ? '' : 'S'}`}</Txt>
          </View>
        </View>
        <Txt size={14} w={500} lh={1.4} color={F.smoke}>XP comes from what you log: meals, protein days, sessions, runs, weigh-ins and streaks. Same rules for everyone.</Txt>
        {s.cloud ? (
          <View style={{ backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, paddingHorizontal: SP.md }}>
            <Row title="Show me on the board" sub="Your first name and XP, seen by everyone in the beta" right={<Toggle on={shown} onPress={() => s.setOpt('board', !shown)} accessibilityLabel="Show me on the board" />} last />
          </View>
        ) : null}
      </View>

      <SectionHeader title="This week" meta={rows?.length ? `${rows.length} on the ladder` : undefined} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md }}>
        {rows === null ? <Txt size={14} w={500} color={F.smoke}>Loading the board…</Txt> : null}
        {rows?.length === 0 ? <Txt size={14} w={500} lh={1.4} color={F.smoke}>Nobody has scored this week yet. Log anything to take first place.</Txt> : null}
        {rows?.length ? <BoardLadder rows={rows} you={g.weekXp} rank={g.rank.name} /> : null}
      </View>

      <SectionHeader title="Rank ladder" meta="Total XP" style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Txt face="display" size={28} lh={1.15} color={s.accent}>{num(g.xp)}</Txt>
            <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>XP IN TOTAL</Txt>
          </View>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{g.next ? `${num(g.next.min - g.xp)} TO ${g.next.name.toUpperCase()}` : 'TOP RANK'}</Txt>
        </View>
        <MeterBar pct={g.progress} height={12} accessibilityLabel={g.next ? `${num(g.xp)} of ${num(g.next.min)} XP to ${g.next.name}` : `${num(g.xp)} XP, top rank`} />
      </View>
      <RankSteps xp={g.xp} current={g.rank.id} accent={s.accent} />
    </Screen>
  );
}

/**
 * The eight ranks as steps, top rank first: each step down is wider, so the left-hand run reads as
 * a staircase to climb. Steps behind you are ticked, yours is filled in your colour on a hard
 * shadow, the next one says how far it is, and the rest wait in rope.
 */
function RankSteps({ xp, current, accent }: { xp: number; current: string; accent: string }) {
  const at = Math.max(0, RANKS.findIndex(r => r.id === current));
  return (
    <View style={{ marginTop: SP.md, gap: 6 }}>
      {[...RANKS].reverse().map(r => {
        const i = RANKS.indexOf(r);
        const mine = i === at, cleared = i < at, next = i === at + 1;
        const width = `${Math.round(100 - (i / (RANKS.length - 1)) * 40)}%` as const;
        const ink = mine ? onColor(accent) : cleared || next ? F.chalk : F.smoke;
        const say = `Rank ${i + 1}, ${r.name}, ${num(r.min)} XP. ${mine ? 'Your rank' : cleared ? 'Cleared' : `${num(r.min - xp)} XP to go`}`;
        return (
          <View key={r.id} accessible accessibilityLabel={say} style={{ width, paddingRight: SHADOW, paddingBottom: mine ? SHADOW : 0 }}>
            <CutBox fill={mine ? accent : F.canvas} stroke={mine ? undefined : cleared ? F.chalk : F.smoke} shadow={mine ? F.chalk : undefined} style={{ minHeight: 40, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt face="display" lean={false} size={20} lh={1.15} color={ink} style={{ minWidth: 14 }}>{i + 1}</Txt>
              <View style={{ flexShrink: 1 }}>
                <Txt face="label" w={600} size={15} ls={0.08} color={ink} numberOfLines={1}>{r.name.toUpperCase()}</Txt>
                {mine || next ? <Txt face="label" w={600} size={12} ls={0.1} lh={1.1} color={mine ? ink : accent} numberOfLines={1}>{mine ? 'YOU ARE HERE' : `${num(r.min - xp)} XP TO GO`}</Txt> : null}
              </View>
              <View style={{ flex: 1 }} />
              {cleared ? <View><Icon name="check" size={16} color={F.chalk} tint={0} strokeWidth={2.4} /></View> : null}
              <Txt face="display" lean={false} size={18} lh={1.15} color={ink}>{num(r.min)}</Txt>
              <Txt face="label" w={600} size={12} ls={0.12} color={mine ? ink : F.smoke}>XP</Txt>
            </CutBox>
          </View>
        );
      })}
    </View>
  );
}
