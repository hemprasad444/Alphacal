// Development only: every Manga Panel part on one page, in any of the six worlds. Open it from
// Settings (dev builds) or at /gallery. Release builds send you home.
import type { GameBadge } from '@rei/shared';
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { BadgeUnlock } from '../components/BadgeUnlock';
import { CutShape } from '../components/cut';
import { CoachShout, Combo, CutButton, Ladder, Meter, MeterBar, MoveRow, RoundStamp, SectionHeader, Slash, SpecialMoveCard, VersusHeader } from '../components/fight';
import { Panel, Stamp, Tile } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Card, IconButton, Label, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { C, F, THEMES } from '../lib/theme';
import { useStore } from '../state/store';

const SAMPLE_BADGE: GameBadge = { id: 'gallery', title: 'First Bowl', desc: 'Log your first meal.', earned: '2026-11-15', progress: 1, icon: 'fuel', tier: 'bronze' };
const SWATCHES: [string, string, string][] = [['ARENA', F.arena, 'ground'], ['CANVAS', F.canvas, 'rows'], ['ROPE', F.rope, 'lines'], ['SMOKE', F.smoke, 'quiet text'], ['CHALK', F.chalk, 'text'], ['RIVAL', F.rival, 'excuses'], ['BRONZE', F.bronze, 'medals']];

function Block({ title, meta, acc, children }: { title: string; meta?: string; acc: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 28, gap: 12 }}>
      <SectionHeader title={title} meta={meta} accent={acc} />
      {children}
    </View>
  );
}

export default function Gallery() {
  const world = useStore(s => s.theme);
  const [id, setId] = useState(world.id);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState('Medium');
  const [unlock, setUnlock] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  const t = THEMES.find(x => x.id === id) ?? THEMES[0];
  const acc = t.acc;

  return (
    <Screen tabs={false}>
      <SubHeader title="Manga Panel" onBack={() => router.back()} />

      <Label style={{ marginTop: 16 }}>THE WORLD SETS THE ACCENT. INK, PAPER AND POP NEVER CHANGE.</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {THEMES.map(x => (
          <Tap key={x.id} onPress={() => setId(x.id)} accessibilityState={{ selected: x.id === id }} accessibilityLabel={`${x.name} world`} style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.canvas, borderWidth: 2, borderColor: x.id === id ? x.acc : C.smoke }}>
            <CutShape width={16} height={12} fill={x.acc} />
            <Txt face="label" w={600} size={14} ls={0.1} color={x.id === id ? C.chalk : C.smoke}>{x.name.toUpperCase()}</Txt>
          </Tap>
        ))}
      </View>

      <Block title="Type" meta="Dela Gothic One · Zen Maru Gothic" acc={acc}>
        <Txt face="display" size={56} lh={1.1}>1,240</Txt>
        <Txt face="display" size={28}>ROUND WON</Txt>
        <Txt face="labelItalic" w={600} size={14} ls={0.14}>TO THE BELL</Txt>
        <Txt size={15} w={500}>Chicken tikka 150 g. Body text is Zen Maru Gothic, 500 to 900.</Txt>
        <Txt face="label" size={12} ls={0.12} color={C.smoke}>4 MEALS LANDED</Txt>
      </Block>

      <Block title="Palette" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...SWATCHES.slice(0, 5), ['CORNER', acc, 'you + CTA'] as [string, string, string], ...SWATCHES.slice(5)].map(([name, col, use]) => (
            <View key={name} style={{ width: 76, gap: 2 }}>
              <View style={{ height: 36, backgroundColor: col, borderWidth: 2, borderColor: C.smoke }} />
              <Txt face="label" w={600} size={13} ls={0.08}>{name}</Txt>
              <Txt face="label" size={12} color={C.smoke}>{col.toUpperCase()}</Txt>
              <Txt face="label" size={12} color={C.smoke}>{use}</Txt>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Versus header" meta="Hero of Today" acc={acc}>
        <View style={{ marginHorizontal: -20 }}>
          <VersusHeader name="Hem" sub="Rookie · 220 XP" rivalSub="2 sessions taken this week" plate={{ big: '00:48', small: 'To the bell · 18:30' }} accent={acc} />
        </View>
        <Combo count={3} accent={acc} />
      </Block>

      <Block title="Meter" meta="Fills toward full" acc={acc}>
        <Meter size="lg" label="Energy" value={1240} target={2100} unit="kcal" segments={21} accent={acc} />
        <Meter size="lg" label="Energy" value={1240} target={2100} unit="kcal" accent={acc} />
        <Meter label="Protein" value={96} target={185} unit="g" accent={acc} />
        <Meter label="Protein" value={190} target={185} unit="g" accent={acc} />
        <Meter label="Energy" value={2380} target={2100} unit="kcal" past="flag" accent={acc} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Meter size="sm" label="Protein" value={96} target={185} unit="g" accent={acc} />
          <Meter size="sm" label="Carbs" value={140} target={230} unit="g" accent={acc} />
          <Meter size="sm" label="Fat" value={72} target={70} unit="g" accent={acc} />
        </View>
      </Block>

      <Block title="Stamps and combo" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <RoundStamp />
          <RoundStamp label="Rank up" tone="accent" accent={acc} />
          <RoundStamp label="Round open" tone="outline" />
          <RoundStamp label="Excuses 2" tone="rival" size="sm" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          <Combo count={12} accent={acc} />
          <Combo count={0} accent={acc} />
          <Combo count={4} top="Week" bottom="Streak" size="sm" accent={acc} />
        </View>
      </Block>

      <Block title="Move list · Push day" meta="18:30 · 45 min" acc={acc}>
        <View style={{ gap: 4 }}>
          <MoveRow index={1} name="Bench press" pips={{ total: 4, done: 4 }} value="4 × 8" done accent={acc} />
          <MoveRow index={2} name="Incline dumbbell press" pips={{ total: 3, done: 1 }} value="3 × 10" accent={acc} onPress={() => {}} />
          <MoveRow index={3} name="Cable fly" detail="15 kg" value="3 × 12" accent={acc} />
        </View>
      </Block>

      <Block title="Hit log" meta="2 meals landed" acc={acc}>
        <View style={{ gap: 4 }}>
          <MoveRow index="08:10" indexWidth={44} name="Poha with peanuts" detail="P 9" value="+380" accent={acc} />
          <MoveRow index="13:20" indexWidth={44} name="2 roti, dal, sabzi" detail="P 23" value="+500" accent={acc} />
        </View>
      </Block>

      <Block title="Week 1 ladder" meta="Your row, and the gap" acc={acc}>
        <Ladder accent={acc} rows={[{ rank: 1, name: 'Arjun', score: 1840 }, { rank: 2, name: 'Hem', score: 1210, you: true }, { rank: 3, name: 'Priya', score: 990 }, { rank: 4, name: 'Meera', score: 640 }]} />
      </Block>

      <Block title="Special moves" meta="1 of 6 unlocked" acc={acc}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SpecialMoveCard title="First Bowl" tier="bronze" earned icon="fuel" style={{ flex: 1 }} />
          <SpecialMoveCard title="Protein Week" tier="silver" earned icon="protein" style={{ flex: 1 }} />
          <SpecialMoveCard title="Iron Streak" tier="gold" earned icon="streak" style={{ flex: 1 }} />
          <SpecialMoveCard title="Early Riser" tier="bronze" earned={false} icon="sleep" progress={0.4} accent={acc} style={{ flex: 1 }} />
          <SpecialMoveCard title="Plus One" tier="silver" earned={false} style={{ flex: 1 }} />
        </View>
        <SpecialMoveCard layout="row" width={56} title="First Bowl" tier="bronze" earned icon="fuel" hint="Log + 1 meal" />
        <SpecialMoveCard layout="row" width={56} title="Iron Streak" tier="gold" earned={false} icon="streak" hint="Train + 7 days" progress={0.57} accent={acc} />
        <CutButton size="md" tone="quiet" label="Play the unlock" meta="New special move" onPress={() => setUnlock(true)} accent={acc} />
      </Block>

      <Block title="Corner coach" meta="Chalk panel is REI's alone" acc={acc}>
        <CoachShout before="You said this mattered. Two sessions missed this week." shout="Stop negotiating with yourself." after="Push day, 18:30." accent={acc} />
        <Slash accent={acc} />
      </Block>

      <Block title="Controls" acc={acc}>
        <Card style={{ paddingHorizontal: 16 }}>
          <Row title="Arena lights" sub="A toggle in a settings row" right={<Toggle on={on} onPress={() => setOn(!on)} accessibilityLabel="Arena lights" />} />
          <Row title="Emblem strength" right={<Segmented value={seg} options={[['Subtle', 'Subtle'], ['Medium', 'Medium'], ['Bold', 'Bold']]} onChange={setSeg} />} />
          <Row title="Icon buttons" right={<View style={{ flexDirection: 'row', gap: 10 }}><IconButton onPress={() => {}}>‹</IconButton><IconButton size={44} onPress={() => {}}>✕</IconButton></View>} last />
        </Card>
        <Panel acc={acc} tone={0.8}>
          <Txt size={15} w={500}>Panel (older screens): flat canvas, corner bar.</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Stamp text="Rookie" color={acc} />
            <Stamp text="220 XP" color={C.warn} />
          </View>
        </Panel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile icon="camera" label="Scan a meal" sub="Photo" acc={acc} onPress={() => {}} hot />
          <Tile icon="log" label="Log training" sub="Manual" acc={acc} onPress={() => {}} />
        </View>
      </Block>

      <Block title="Primary action" meta="One per screen" acc={acc}>
        <CutButton label="Start push day" meta="45 min · 4 moves" onPress={() => {}} accent={acc} />
        <CutButton size="md" tone="chalk" icon="plus" label="Log a meal" meta="Protein needs 89 g" onPress={() => {}} accent={acc} />
        <CutButton size="md" tone="quiet" label="Skip today" onPress={() => {}} accent={acc} />
        <CutButton size="md" label="Not ready" disabled onPress={() => {}} accent={acc} />
      </Block>

      <Block title="Six worlds, one token" acc={acc}>
        <View style={{ gap: 8 }}>
          {THEMES.map(x => (
            <View key={x.id} style={{ backgroundColor: C.canvas, borderWidth: 2, borderColor: C.chalk, padding: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt face="display" size={22} color={x.acc}>{x.name.toUpperCase()}</Txt>
                <Combo count={3} size="sm" accent={x.acc} />
              </View>
              <MeterBar pct={0.59} accent={x.acc} accessibilityLabel={`${x.name} meter`} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CutButton size="md" label="Start" meta={x.acc} onPress={() => setId(x.id)} accent={x.acc} style={{ flex: 1 }} />
                <RoundStamp label="Rank up" tone="accent" size="sm" accent={x.acc} />
              </View>
            </View>
          ))}
        </View>
      </Block>

      {unlock ? <BadgeUnlock badges={[SAMPLE_BADGE]} onDone={() => setUnlock(false)} /> : null}
    </Screen>
  );
}
