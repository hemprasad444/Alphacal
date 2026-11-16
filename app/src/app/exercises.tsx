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
import { C, F, SP } from '../lib/theme';

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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
      <Field value={q} onChangeText={setQ} placeholder="Search 750+ exercises" accessibilityLabel="Search exercises" autoCorrect={false} style={{ marginTop: SP.xxl }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {GROUPS.map(([g]) => <Chip key={g} label={g} on={g === group} onPress={() => setGroup(g)} />)}
      </View>
      <SectionHeader title={group === 'All' ? 'Exercises' : group} meta={`${list.length} · free-exercise-db`} style={{ marginTop: SP.huge, marginBottom: SP.xs }} />
      {!list.length ? <Txt size={15} lh={1.45} color={F.smoke} style={{ marginTop: SP.sm }}>Nothing found. Try another word.</Txt> : null}
    </View>
  );

  return <ListScreen header={header} data={list} keyExtractor={e => e.id} renderItem={({ item }) => <Row e={item} />} />;
}

const Row = memo(function Row({ e }: { e: LibExercise }) {
  return (
    <Tap onPress={() => router.push({ pathname: '/lift', params: { name: e.name, id: e.id } })} accessibilityLabel={`${e.name}. ${e.primary.join(', ')}, ${e.equipment}, ${e.level}`} style={{ minHeight: 60, paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} w={500} lh={1.35}>{e.name}</Txt>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{cap([e.primary.join(', '), e.equipment, e.level].filter(Boolean).join(' · '))}</Txt>
      </View>
      <Icon name="chevron" size={16} color={F.smoke} tint={0} strokeWidth={1.6} />
    </Tap>
  );
});
