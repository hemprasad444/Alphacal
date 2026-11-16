// Development only: every Sumi & Hanko part on one page, in any of the six worlds. Open it from
// Settings (dev builds) or at /gallery. Release builds send you home.
import type { GameBadge } from '@rei/shared';
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { BadgeUnlock } from '../components/BadgeUnlock';
import { Chip, Field, QuietButton, StatStrip } from '../components/dojo';
import { CoachShout, Combo, CutButton, Ladder, Meter, MeterBar, MoveRow, RoundStamp, SectionHeader, SpecialMoveCard, VersusHeader } from '../components/fight';
import { BrushBar, BrushRule, Enso, HankoSeal, InkDot, InkPanel, ReiSeal, SealTag } from '../components/ink';
import { Screen, SubHeader } from '../components/Screen';
import { Card, IconButton, Row, Segmented, Toggle, Txt } from '../components/ui';
import { C, F, RADIUS, SP, THEMES } from '../lib/theme';
import { useStore } from '../state/store';

const SAMPLE_BADGE: GameBadge = { id: 'gallery', title: 'First Bowl', desc: 'Log your first meal.', earned: '2026-11-15', progress: 1, icon: 'fuel', tier: 'bronze' };
const SWATCHES: [string, string, string][] = [['Night washi', F.arena, 'Ground'], ['Sumi', F.canvas, 'Cards'], ['Dry brush', F.rope, 'Tracks'], ['Ash', F.smoke, 'Second text'], ['Rice paper', F.chalk, 'Text'], ['Vermilion', F.seal, 'REI, seals']];

function Block({ title, meta, acc, children }: { title: string; meta?: string; acc: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: SP.huge, gap: SP.md }}>
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
  const [chip, setChip] = useState('Week');
  const [text, setText] = useState('');
  const [unlock, setUnlock] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  const t = THEMES.find(x => x.id === id) ?? THEMES[0];
  const acc = t.acc;

  return (
    <Screen tabs={false}>
      <SubHeader title="Sumi & Hanko" onBack={() => router.back()} />

      <Txt size={15} w={500} lh={1.5} color={C.smoke} style={{ marginTop: SP.xxl }}>The world sets the accent. Paper, ink and the seal red never change.</Txt>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {THEMES.map(x => <Chip key={x.id} label={x.name} on={x.id === id} onPress={() => setId(x.id)} />)}
      </View>

      <Block title="Type" meta="Three faces" acc={acc}>
        <Txt face="display" exact size={34} lh={1.2}>Day 23</Txt>
        <Txt face="heading" size={20} lh={1.4}>Today’s goals</Txt>
        <Txt face="voice" size={17} lh={1.5}>You said this mattered. Show me.</Txt>
        <Txt size={15} w={500} lh={1.5}>Chicken tikka, 150 g. Body text is Zen Kaku Gothic New.</Txt>
        <Txt face="label" size={13} lh={1.35} color={C.smoke}>A label, for the name of a thing</Txt>
        <Txt face="mono" raw size={12} lh={1.35} color={C.smoke}>Sun 15 Nov · Week 1 · 4 meals</Txt>
        <Txt face="num" raw size={24} lh={1.3}>1,240</Txt>
      </Block>

      <Block title="Palette" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {[...SWATCHES, ['Accent', acc, 'Data, active'] as [string, string, string]].map(([name, col, use]) => (
            <View key={name} style={{ width: 80, gap: 2 }}>
              <View style={{ height: 40, backgroundColor: col, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm }} />
              <Txt face="label" size={13} lh={1.35}>{name}</Txt>
              <Txt face="mono" raw size={12} lh={1.35} color={C.smoke}>{col.toUpperCase()}</Txt>
              <Txt face="label" w={400} size={12} lh={1.35} color={C.smoke}>{use}</Txt>
            </View>
          ))}
        </View>
      </Block>

      <Block title="Ink" meta="Brush, ensō, seal" acc={acc}>
        <BrushRule long />
        <BrushBar pct={0.62} color={acc} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg }}>
          <Enso pct={0.72} size={88} color={acc}>
            <Txt face="num" raw size={16} lh={1.3}>72%</Txt>
          </Enso>
          <HankoSeal mark="7" />
          <HankoSeal shape="round" icon="fuel" />
          <HankoSeal earned={false} icon="streak" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <ReiSeal ground={F.arena} />
          <SealTag text="T" />
          <SealTag icon="fuel" />
          <SealTag text="Day 23" size="lg" />
          <InkDot />
          <InkDot color={acc} />
        </View>
        <InkPanel>
          <Txt size={15} w={500} lh={1.5}>A card: sumi inside a quiet line, softly rounded.</Txt>
        </InkPanel>
      </Block>

      <Block title="Hero" meta="Top of Today" acc={acc}>
        <VersusHeader name="Hem" sub="Rookie · 220 XP" rivalSub="2 sessions missed this week" plate={{ big: '18:30', small: 'Push day' }} accent={acc} />
        <StatStrip items={[{ v: '94 kg', k: 'Est. max' }, { v: '+60', k: 'XP today', hot: true }, { v: '12 t', k: 'Lifted' }]} />
      </Block>

      <Block title="Progress" meta="Toward the target" acc={acc}>
        <Meter size="lg" label="Energy" value={1240} target={2100} unit="kcal" accent={acc} />
        <Meter label="Protein" value={96} target={185} unit="g" accent={acc} />
        <Meter label="Protein" value={190} target={185} unit="g" accent={acc} />
        <Meter label="Energy" value={2380} target={2100} unit="kcal" past="flag" accent={acc} />
        <View style={{ flexDirection: 'row', gap: SP.lg }}>
          <Meter size="sm" label="Protein" value={96} target={185} unit="g" accent={acc} />
          <Meter size="sm" label="Carbs" value={140} target={230} unit="g" accent={acc} />
          <Meter size="sm" label="Fat" value={72} target={70} unit="g" accent={acc} />
        </View>
        <MeterBar pct={0.59} accent={acc} accessibilityLabel="Sample progress, 59 percent" />
      </Block>

      <Block title="Stamps and streak" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SP.md }}>
          <RoundStamp />
          <RoundStamp label="Done" />
          <RoundStamp label="On" tone="accent" accent={acc} />
          <RoundStamp label="Open" tone="outline" />
          <RoundStamp label="Soon" tone="outline" size="sm" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.xxl }}>
          <Combo count={12} accent={acc} />
          <Combo count={0} accent={acc} />
          <Combo count={4} top="Week" bottom="Streak" size="sm" accent={acc} />
        </View>
      </Block>

      <Block title="Lifts" meta="45 min · 3 lifts" acc={acc}>
        <View>
          <MoveRow index={1} name="Bench press" pips={{ total: 4, done: 4 }} value="4 × 8" done accent={acc} />
          <MoveRow index={2} name="Incline dumbbell press" pips={{ total: 3, done: 1 }} value="3 × 10" accent={acc} onPress={() => {}} />
          <MoveRow index={3} name="Cable fly" detail="15 kg" value="3 × 12" accent={acc} />
        </View>
      </Block>

      <Block title="Meals" meta="2 meals · 880 kcal" acc={acc}>
        <View>
          <MoveRow index="08:10" indexWidth={44} name="Poha with peanuts" detail="P 9" value="380 kcal" accent={acc} />
          <MoveRow index="13:20" indexWidth={44} name="2 roti, dal, sabzi" detail="P 23" value="500 kcal" accent={acc} />
        </View>
      </Block>

      <Block title="This week’s board" meta="Your row, and the gap" acc={acc}>
        <Ladder accent={acc} rows={[{ rank: 1, name: 'Arjun', score: 1840 }, { rank: 2, name: 'Hem', score: 1210, you: true }, { rank: 3, name: 'Priya', score: 990 }, { rank: 4, name: 'Meera', score: 640 }]} />
      </Block>

      <Block title="Seals" meta="3 of 5 earned" acc={acc}>
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          <SpecialMoveCard title="First Bowl" tier="bronze" earned icon="fuel" style={{ flex: 1 }} />
          <SpecialMoveCard title="Protein Week" tier="silver" earned icon="protein" style={{ flex: 1 }} />
          <SpecialMoveCard title="Iron Streak" tier="gold" earned icon="streak" style={{ flex: 1 }} />
          <SpecialMoveCard title="Early Riser" tier="bronze" earned={false} icon="sleep" progress={0.4} accent={acc} style={{ flex: 1 }} />
          <SpecialMoveCard title="Plus One" tier="silver" earned={false} style={{ flex: 1 }} />
        </View>
        <SpecialMoveCard layout="row" width={56} title="First Bowl" tier="bronze" earned icon="fuel" hint="Log one meal" />
        <SpecialMoveCard layout="row" width={56} title="Iron Streak" tier="gold" earned={false} icon="streak" hint="Train seven days in a row" progress={0.57} accent={acc} />
        <QuietButton label="Show a seal being earned" onPress={() => setUnlock(true)} />
      </Block>

      <Block title="REI says" meta="Red is REI’s alone" acc={acc}>
        <CoachShout before="You said this mattered. Two sessions missed this week." shout="Stop bargaining with yourself." after="Push day, 18:30." accent={acc} />
      </Block>

      <Block title="Controls" acc={acc}>
        <Card style={{ paddingHorizontal: SP.lg }}>
          <Row title="Paper texture" sub="A toggle in a settings row" right={<Toggle on={on} onPress={() => setOn(!on)} accessibilityLabel="Paper texture" />} />
          <Row title="Emblem strength" right={<Segmented value={seg} options={[['Subtle', 'Subtle'], ['Medium', 'Medium'], ['Bold', 'Bold']]} onChange={setSeg} />} />
          <Row title="Icon buttons" right={<View style={{ flexDirection: 'row', gap: SP.sm }}><IconButton onPress={() => {}}>‹</IconButton><IconButton size={44} onPress={() => {}}>✕</IconButton></View>} last />
        </Card>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: SP.sm }}>
          {['Week', 'Month', 'All'].map(c => <Chip key={c} label={c} on={chip === c} onPress={() => setChip(c)} />)}
        </View>
        <Field label="A field" value={text} onChangeText={setText} placeholder="Type something" />
      </Block>

      <Block title="Actions" meta="One primary per screen" acc={acc}>
        <CutButton label="Begin" meta="45 min · 4 lifts" onPress={() => {}} />
        <CutButton size="md" icon="plus" label="Log a meal" onPress={() => {}} />
        <CutButton size="md" tone="quiet" label="Skip today" onPress={() => {}} />
        <CutButton size="md" label="Not ready" disabled onPress={() => {}} />
      </Block>

      <Block title="Six worlds" meta="One accent each" acc={acc}>
        <View style={{ gap: SP.sm }}>
          {THEMES.map(x => (
            <Card key={x.id} style={{ padding: SP.lg, gap: SP.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
                <Txt face="heading" raw size={17} lh={1.4} color={x.acc}>{x.name}</Txt>
                <RoundStamp label="On" tone="accent" size="sm" accent={x.acc} />
              </View>
              <MeterBar pct={0.59} accent={x.acc} accessibilityLabel={`${x.name} sample progress`} />
              <Txt face="mono" raw size={12} lh={1.35} color={C.smoke}>{`${x.vibe} · ${x.acc.toUpperCase()}`}</Txt>
            </Card>
          ))}
        </View>
      </Block>

      {unlock ? <BadgeUnlock badges={[SAMPLE_BADGE]} onDone={() => setUnlock(false)} /> : null}
    </Screen>
  );
}
