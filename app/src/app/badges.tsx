// Every badge as a special-move card: earned ones with the day they landed, locked ones with how far along you are.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { BadgeGrid } from '../components/dojo';
import { MeterBar, SectionHeader } from '../components/fight';
import { Screen, SubHeader } from '../components/Screen';
import { Txt } from '../components/ui';
import { F, SP } from '../lib/theme';
import { useGame } from '../state/game';

export default function Badges() {
  const g = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const total = g.earned.length + g.locked.length;
  const left = total - g.earned.length;
  return (
    <Screen tabs={false}>
      <SubHeader title="Special moves" onBack={() => router.back()} />

      <View style={{ marginTop: SP.lg, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
            <Txt face="display" size={64} lh={1.08}>{g.earned.length}</Txt>
            <Txt face="label" w={400} size={18} ls={0.03} color={F.smoke}>{`/ ${total} BADGES`}</Txt>
          </View>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ paddingBottom: 8 }}>{left ? `${left} TO UNLOCK` : 'ALL UNLOCKED'}</Txt>
        </View>
        <MeterBar pct={total ? g.earned.length / total : 0} accessibilityLabel={`${g.earned.length} of ${total} badges unlocked`} />
        <Txt size={14} w={500} lh={1.4} color={F.smoke}>Everything you log counts. Tap a move to see how to earn it.</Txt>
      </View>

      {g.earned.length ? (
        <>
          <SectionHeader title="Unlocked" meta={`${g.earned.length}`} style={{ marginTop: SP.xxl }} />
          <BadgeGrid badges={g.earned} open={open} onOpen={setOpen} style={{ marginTop: SP.md }} />
        </>
      ) : null}
      <SectionHeader title="Still to earn" meta={`${g.locked.length}`} style={{ marginTop: SP.xxl }} />
      <BadgeGrid badges={g.locked} open={open} onOpen={setOpen} style={{ marginTop: SP.md }} />
    </Screen>
  );
}
