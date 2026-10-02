// Browse the exercise library by muscle, or search it.
import { library, type LibExercise, searchExercises } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Screen, SubHeader } from '../components/Screen';
import { Label, Tap, Txt } from '../components/ui';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

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
  const s = useStore();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const list = useMemo(() => {
    const muscles = GROUPS.find(g => g[0] === group)?.[1] ?? [];
    const pool = library().filter((e: LibExercise) => (group === 'Cardio' ? e.category === 'cardio' : group === 'All' ? e.category !== 'stretching' : muscles.includes(e.primary[0])));
    return q.trim() ? searchExercises(q, 60, pool) : pool.slice(0, 80);
  }, [q, group]);

  return (
    <Screen tabs={false}>
      <SubHeader title="EXERCISE LIBRARY" onBack={() => router.back()} />
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search 870+ exercises"
        placeholderTextColor={C.dim}
        keyboardAppearance="dark"
        style={{ marginTop: 20, height: 48, borderRadius: 24, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontFamily: fontFamily(s.settings.font, 400), fontSize: 16, color: C.text }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {GROUPS.map(([g]) => (
          <Tap key={g} onPress={() => setGroup(g)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: g === group ? s.accent : 'rgba(255,255,255,0.1)' }}>
            <Txt size={13} color={g === group ? C.text : C.body}>{g}</Txt>
          </Tap>
        ))}
      </View>
      <Label size={10} color={C.faint} style={{ marginTop: 14 }}>{`${list.length}${list.length >= 60 ? '+' : ''} EXERCISES · FREE-EXERCISE-DB`}</Label>
      <View style={{ marginTop: 6 }}>
        {list.map(e => (
          <Tap key={e.id} onPress={() => router.push({ pathname: '/lift', params: { name: e.name, id: e.id } })} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, gap: 3 }}>
            <Txt size={15}>{e.name}</Txt>
            <Txt face="mono" size={11} color={C.dim}>{`${e.primary.join(', ')} · ${e.equipment} · ${e.level}`}</Txt>
          </Tap>
        ))}
      </View>
    </Screen>
  );
}
