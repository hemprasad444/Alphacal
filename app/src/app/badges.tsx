// Every badge: earned ones with their date, locked ones with how far along you are.
import { parseIsoDate, type GameBadge } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Heading, Medal, Panel, Stamp, TIER } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

const when = (iso: string | null) => (iso ? (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase() : '');

export default function Badges() {
  const accent = useStore(s => s.accent);
  const g = useGame();
  const [open, setOpen] = useState<GameBadge | null>(null);
  const grid = (list: GameBadge[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 22 }}>
      {list.map(b => (
        <Tap key={b.id} onPress={() => setOpen(o => (o?.id === b.id ? null : b))} style={{ width: '33.33%', alignItems: 'center', gap: 8 }}>
          <Medal icon={b.icon} tier={b.tier} earned={!!b.earned} progress={b.progress} size={70} />
          <Txt size={12} w={500} color={b.earned ? C.text : C.dim} align="center" numberOfLines={2} style={{ paddingHorizontal: 4 }}>{b.title}</Txt>
          {b.earned ? <Txt face="mono" size={9} ls={0.12} color={TIER[b.tier]}>{when(b.earned)}</Txt> : <Txt face="mono" size={9} ls={0.12} color={C.faint}>{`${Math.round(b.progress * 100)}%`}</Txt>}
        </Tap>
      ))}
    </View>
  );
  return (
    <Screen tabs={false}>
      <SubHeader title="BADGES" onBack={() => router.back()} />
      <Panel acc={accent} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Txt size={44} w={300} ls={-0.04}>{g.earned.length}</Txt>
          <View style={{ flex: 1 }}>
            <Txt size={16} w={500}>{`of ${g.earned.length + g.locked.length} badges`}</Txt>
            <Txt size={13} color={C.sub}>Everything you log counts. Tap one to see how to earn it.</Txt>
          </View>
        </View>
      </Panel>
      {open ? (
        <Panel acc={TIER[open.tier]} tone={0.6} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Medal icon={open.icon} tier={open.tier} earned={!!open.earned} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt size={18} w={600}>{open.title}</Txt>
              <Txt size={14} color={C.sub}>{open.desc}</Txt>
            </View>
            <Stamp text={open.tier} color={TIER[open.tier]} />
          </View>
        </Panel>
      ) : null}
      {g.earned.length ? (
        <>
          <Heading icon="badge" title="Earned" acc={accent} style={{ marginTop: 28 }} />
          {grid(g.earned)}
        </>
      ) : null}
      <Heading icon="lock" title="Still to earn" acc={accent} style={{ marginTop: 32 }} />
      {grid(g.locked)}
    </Screen>
  );
}
