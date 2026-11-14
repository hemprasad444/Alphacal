// What REI remembers about you: learned in conversation or added here. REI uses it in
// every reply, check-in, weekly plan and report.
import { MEMORY_KINDS, MAX_MEMORY, type MemoryKind } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { inputType } from '../components/corner';
import { CutButton, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C, HIT, onColor, SP } from '../lib/theme';
import { useStore } from '../state/store';

const KIND_LABEL: Record<MemoryKind, string> = { diet: 'Diet', health: 'Health', schedule: 'Schedule', equipment: 'Equipment', preference: 'Likes', life: 'Life' };
const EXAMPLES = ['Vegetarian, eats eggs and dairy', 'Left knee: no deep squats', 'Trains at 6 am before work', 'Home gym: dumbbells to 30 kg'];

export default function Memory() {
  const s = useStore();
  const { accent } = s;
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
      <Txt size={15} w={500} lh={1.5} color={C.body} style={{ marginTop: SP.xl }}>
        REI picks these up when you mention them and uses them in every answer, check-in, weekly plan and report. Remove anything that’s wrong.
      </Txt>

      {!s.memory.length ? (
        <View style={{ marginTop: SP.xl }}>
          <SectionHeader title="Nothing yet" meta="For example" />
          <View style={{ marginTop: SP.md, gap: SP.xs }}>
            {EXAMPLES.map(e => (
              <Tap key={e} onPress={() => setText(e)} accessibilityLabel={`Use the example: ${e}`} style={{ minHeight: HIT, justifyContent: 'center', paddingHorizontal: SP.md, backgroundColor: C.canvas }}>
                <Txt size={15} w={500} color={C.smoke}>{`“${e}”`}</Txt>
              </Tap>
            ))}
          </View>
        </View>
      ) : null}

      {groups.map(([k, ms]) => (
        <View key={k} style={{ marginTop: SP.xxl }}>
          <SectionHeader title={KIND_LABEL[k]} meta={`${ms.length}`} />
          <View style={{ marginTop: SP.md, gap: SP.xs }}>
            {ms.map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 56, paddingLeft: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas }}>
                {m.source === 'rei' ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={15} w={500} lh={1.35}>{m.text}</Txt>
                  <Txt face="label" w={600} size={12} ls={0.1} color={C.smoke}>{m.source === 'rei' ? 'REI LEARNED THIS' : 'YOU ADDED THIS'}</Txt>
                </View>
                <Tap onPress={() => s.forget(m.id)} accessibilityLabel={`Forget: ${m.text}`} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={18} color={C.smoke} strokeWidth={2.2} />
                </Tap>
              </View>
            ))}
          </View>
        </View>
      ))}

      <SectionHeader title="Tell REI" meta={`${s.memory.length} / ${MAX_MEMORY}`} style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {MEMORY_KINDS.map(k => {
          const on = k === kind;
          return (
            <Tap key={k} onPress={() => setKind(k)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={KIND_LABEL[k]} style={{ minHeight: HIT, paddingHorizontal: SP.md, justifyContent: 'center', borderWidth: 2, borderColor: on ? accent : C.rope, backgroundColor: on ? accent : C.canvas }}>
              <Txt face="label" w={600} size={15} ls={0.08} color={on ? onColor(accent) : C.smoke}>{KIND_LABEL[k].toUpperCase()}</Txt>
            </Tap>
          );
        })}
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
        accessibilityLabel="Something REI should remember"
        style={[{ marginTop: SP.md, height: 52, paddingHorizontal: SP.md, backgroundColor: C.canvas, borderWidth: 2, borderColor: text ? accent : C.rope }, inputType(s.settings.textSize)]}
      />
      <CutButton label="Remember this" disabled={!text.trim()} onPress={add} style={{ marginTop: SP.md }} />
    </Screen>
  );
}
