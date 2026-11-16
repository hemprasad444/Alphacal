// Every seal: earned ones with the day they were earned, locked ones with how far along you are.
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
      <SubHeader title="Seals" onBack={() => router.back()} />

      <View style={{ marginTop: SP.xxl, gap: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
            <Txt face="display" exact size={44} lh={1.2}>{g.earned.length}</Txt>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`of ${total} seals`}</Txt>
          </View>
          <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{left ? `${left} to earn` : 'All earned'}</Txt>
        </View>
        <MeterBar pct={total ? g.earned.length / total : 0} accessibilityLabel={`${g.earned.length} of ${total} seals earned`} />
        <Txt size={15} w={500} lh={1.5} color={F.smoke}>Everything you log counts. Tap a seal to see how it is earned.</Txt>
      </View>

      {g.earned.length ? (
        <>
          <SectionHeader title="Earned" meta={`${g.earned.length}`} style={{ marginTop: SP.huge }} />
          <BadgeGrid badges={g.earned} open={open} onOpen={setOpen} style={{ marginTop: SP.lg }} />
        </>
      ) : null}
      <SectionHeader title="Still to earn" meta={`${g.locked.length}`} style={{ marginTop: SP.huge }} />
      <BadgeGrid badges={g.locked} open={open} onOpen={setOpen} style={{ marginTop: SP.lg }} />
    </Screen>
  );
}
