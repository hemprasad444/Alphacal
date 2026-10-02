// What REI remembers about you: learned in conversation or added here. REI uses it in
// every reply, check-in, weekly plan and report.
import { MEMORY_KINDS, MAX_MEMORY, type MemoryKind } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '../components/FoodSheet';
import { Screen, SubHeader } from '../components/Screen';
import { Label, Tap, Txt } from '../components/ui';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

const KIND_LABEL: Record<MemoryKind, string> = { diet: 'Diet', health: 'Health', schedule: 'Schedule', equipment: 'Equipment', preference: 'Likes', life: 'Life' };
const EXAMPLES = ['Vegetarian, eats eggs and dairy', 'Left knee: no deep squats', 'Trains at 6 am before work', 'Home gym: dumbbells to 30 kg'];

export default function Memory() {
  const s = useStore();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MemoryKind>('diet');
  const groups = MEMORY_KINDS.map(k => [k, s.memory.filter(m => m.kind === k)] as const).filter(([, ms]) => ms.length);
  const add = () => {
    if (!text.trim()) return;
    s.remember(text, kind);
    setText('');
  };

  return (
    <Screen tabs={false}>
      <SubHeader title="WHAT REI REMEMBERS" onBack={() => router.back()} />
      <Txt size={15} lh={1.5} color={C.body} style={{ marginTop: 20 }}>
        REI picks these up when you mention them and uses them in every answer, check-in, weekly plan and report. Remove anything that’s wrong.
      </Txt>

      {!s.memory.length ? (
        <View style={{ marginTop: 20, gap: 8 }}>
          <Label size={10}>NOTHING YET · FOR EXAMPLE</Label>
          {EXAMPLES.map(e => (
            <Tap key={e} onPress={() => setText(e)}>
              <Txt size={14} color={C.dim}>{`“${e}”`}</Txt>
            </Tap>
          ))}
        </View>
      ) : null}

      {groups.map(([k, ms]) => (
        <View key={k} style={{ marginTop: 24 }}>
          <Label>{KIND_LABEL[k].toUpperCase()}</Label>
          <View style={{ marginTop: 6 }}>
            {ms.map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt size={15} lh={1.35}>{m.text}</Txt>
                  <Txt face="mono" size={10} color={C.faint}>{m.source === 'rei' ? 'REI LEARNED THIS' : 'YOU ADDED THIS'}</Txt>
                </View>
                <Tap onPress={() => s.forget(m.id)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={13} color={C.faint}>✕</Txt>
                </Tap>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Label style={{ marginTop: 30 }}>{`TELL REI · ${s.memory.length} / ${MAX_MEMORY}`}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {MEMORY_KINDS.map(k => (
          <Tap key={k} onPress={() => setKind(k)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: k === kind ? s.accent : 'rgba(255,255,255,0.1)' }}>
            <Txt size={13} color={k === kind ? C.text : C.body}>{KIND_LABEL[k]}</Txt>
          </Tap>
        ))}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        placeholder="One fact, e.g. lactose intolerant"
        placeholderTextColor={C.dim}
        keyboardAppearance="dark"
        returnKeyType="done"
        maxLength={160}
        style={{ marginTop: 12, height: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontFamily: fontFamily(s.settings.font, 400), fontSize: 16, color: C.text }}
      />
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Button primary disabled={!text.trim()} onPress={add}>Remember this</Button>
      </View>
    </Screen>
  );
}
