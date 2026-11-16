// What REI remembers about you: learned in conversation or added here. REI uses it in
// every reply, check-in, weekly plan and report.
import { MEMORY_KINDS, MAX_MEMORY, type MemoryKind } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip, Field } from '../components/dojo';
import { CutButton, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { ReiSeal } from '../components/ink';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Tap, Txt } from '../components/ui';
import { C, HIT, SP } from '../lib/theme';
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
      <SubHeader title="What REI remembers" onBack={() => router.back()} />
      <Txt size={15} w={500} lh={1.5} color={C.body} style={{ marginTop: SP.xxl }}>
        REI picks these up when you mention them and uses them in every answer, check-in, weekly plan and report. Remove anything that’s wrong.
      </Txt>

      {!s.memory.length ? (
        <View style={{ marginTop: SP.huge }}>
          <SectionHeader title="Nothing yet" meta="For example" />
          <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
            {EXAMPLES.map((e, i) => (
              <Tap key={e} onPress={() => setText(e)} accessibilityLabel={`Use the example: ${e}`} style={{ minHeight: 52, justifyContent: 'center', paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <Txt size={15} w={500} lh={1.4} color={C.smoke}>{`“${e}”`}</Txt>
              </Tap>
            ))}
          </Card>
        </View>
      ) : null}

      {groups.map(([k, ms]) => (
        <View key={k} style={{ marginTop: SP.huge }}>
          <SectionHeader title={KIND_LABEL[k]} meta={`${ms.length}`} />
          <Card style={{ marginTop: SP.md, paddingLeft: SP.lg, paddingRight: SP.xs }}>
            {ms.map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, minHeight: 64, paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1, gap: SP.xs }}>
                  <Txt size={15} w={500} lh={1.4}>{m.text}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                    {m.source === 'rei' ? <ReiSeal size={16} /> : null}
                    <Txt face="mono" raw size={12} lh={1.35} color={C.smoke}>{m.source === 'rei' ? 'REI learned this' : 'You added this'}</Txt>
                  </View>
                </View>
                <Tap onPress={() => s.forget(m.id)} accessibilityLabel={`Forget: ${m.text}`} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={18} color={C.smoke} tint={0} strokeWidth={1.7} />
                </Tap>
              </View>
            ))}
          </Card>
        </View>
      ))}

      <SectionHeader title="Tell REI" meta={`${s.memory.length} / ${MAX_MEMORY}`} style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {MEMORY_KINDS.map(k => <Chip key={k} label={KIND_LABEL[k]} on={k === kind} onPress={() => setKind(k)} />)}
      </View>
      <Field
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        placeholder="One fact, e.g. lactose intolerant"
        returnKeyType="done"
        maxLength={160}
        accessibilityLabel="Something REI should remember"
        style={{ marginTop: SP.md }}
      />
      <CutButton label="Remember this" disabled={!text.trim()} onPress={add} style={{ marginTop: SP.lg }} />
    </Screen>
  );
}
