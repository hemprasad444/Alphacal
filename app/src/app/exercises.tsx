// Browse the exercise library by muscle, or search it.
import { library, type LibExercise, searchExercises } from '@rei/shared';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Chip, Field } from '../components/dojo';
import { SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { ListScreen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { F, HIT, SP } from '../lib/theme';

const GROUPS: [string, string[]][] = [
  ['All', []],
  ['Chest', ['chest']],
  ['Back', ['lats', 'middle back', 'lower back', 'traps']],
  ['Shoulders', ['shoulders']],
  ['Legs', ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']],
  ['Arms', ['biceps', 'triceps', 'forearms']],
  ['Core', ['abdominals']],
  ['Cardio', []],
];

export default function Exercises() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const list = useMemo(() => {
    const muscles = GROUPS.find(g => g[0] === group)?.[1] ?? [];
    const pool = library().filter((e: LibExercise) => (group === 'Cardio' ? e.category === 'cardio' : group === 'All' ? e.category !== 'stretching' : muscles.includes(e.primary[0])));
    return q.trim() ? searchExercises(q, 200, pool) : pool;
  }, [q, group]);

  const header = (
    <View>
      <SubHeader title="Exercise library" onBack={() => router.back()} />
      <Field value={q} onChangeText={setQ} placeholder="Search 750+ exercises" accessibilityLabel="Search exercises" autoCorrect={false} style={{ marginTop: SP.lg }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {GROUPS.map(([g]) => <Chip key={g} label={g} on={g === group} onPress={() => setGroup(g)} />)}
      </View>
      <SectionHeader title={`${list.length} exercises`} meta="free-exercise-db" style={{ marginTop: SP.xl, marginBottom: SP.md }} />
    </View>
  );

  return <ListScreen header={header} data={list} keyExtractor={e => e.id} renderItem={({ item }) => <Row e={item} />} />;
}

const Row = memo(function Row({ e }: { e: LibExercise }) {
  return (
    <Tap onPress={() => router.push({ pathname: '/lift', params: { name: e.name, id: e.id } })} accessibilityLabel={`${e.name}. ${e.primary.join(', ')}, ${e.equipment}, ${e.level}`} style={{ minHeight: HIT, marginBottom: SP.xs, paddingVertical: SP.sm, paddingHorizontal: SP.md, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} w={600} lh={1.3}>{e.name}</Txt>
        <Txt face="label" w={400} size={12} ls={0.08} color={F.smoke} numberOfLines={1}>{`${e.primary.join(', ')} · ${e.equipment} · ${e.level}`.toUpperCase()}</Txt>
      </View>
      <Icon name="chevron" size={16} color={F.smoke} tint={0} strokeWidth={2} />
    </Tap>
  );
});
