// Form tips and photos for an exercise, and swapping it for one that trains the same muscles.
import { alternatives, e1rm, exerciseImage, findExercise, type LibExercise, liftKey, records, searchExercises } from '@rei/shared';
import { TIPS } from '@rei/shared/src/exercises/tips';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';
import { Button, Sheet } from './FoodSheet';
import { Label, Tap, Txt } from './ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Photos, muscles and the first form cues. */
export function ExerciseInfo({ ex, steps = 4 }: { ex: LibExercise; steps?: number }) {
  const tips = TIPS[ex.id] ?? [];
  return (
    <View style={{ gap: 14 }}>
      {ex.images ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1].slice(0, ex.images).map(i => (
            <Image key={i} source={{ uri: exerciseImage(ex.id, i) }} style={{ flex: 1, aspectRatio: 1.2, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="cover" />
          ))}
        </View>
      ) : null}
      <Label size={10} ls={0.12} color={C.muted}>{[ex.primary.join(' · '), ex.equipment, ex.level].filter(Boolean).join(' · ').toUpperCase()}</Label>
      {tips.slice(0, steps).map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Txt face="mono" size={12} color={C.dim} style={{ width: 16, paddingTop: 2 }}>{i + 1}</Txt>
          <Txt size={14} lh={1.45} color={C.body} style={{ flex: 1 }}>{t}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Tap an exercise in a session: how to do it, your best, and swaps. */
export function ExerciseSheet({ name, onClose, onSwap }: { name: string | null; onClose: () => void; onSwap: (to: LibExercise) => void }) {
  return (
    <Sheet open={!!name} onClose={onClose}>
      {name ? <Body key={name} name={name} onClose={onClose} onSwap={onSwap} /> : null}
    </Sheet>
  );
}

function Body({ name, onClose, onSwap }: { name: string; onClose: () => void; onSwap: (to: LibExercise) => void }) {
  const s = useStore();
  const ex = useMemo(() => findExercise(name), [name]);
  const best = records(s.sessions)[liftKey(name)]?.best;
  const [swapping, setSwapping] = useState(false);
  const [q, setQ] = useState('');
  const options = q.trim() ? searchExercises(q, 12).filter(e => e.category !== 'stretching') : ex ? alternatives(ex) : searchExercises('', 0);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Label size={10} ls={0.14}>{ex ? ex.name.toUpperCase() : 'EXERCISE'}</Label>
        <Txt size={22} w={500} ls={-0.02}>{name}</Txt>
        {best ? (
          <Txt face="mono" size={12} color={s.accent}>{`YOUR BEST · ${best.kg != null ? `${best.kg} × ${best.reps}` : `${best.reps} reps`}${best.e1rm ? ` · EST. MAX ${Math.round(best.e1rm)} KG` : ''}`}</Txt>
        ) : null}
      </View>

      {!swapping ? (
        <>
          {ex ? <ExerciseInfo ex={ex} /> : <Txt size={14} color={C.dim}>No form guide for this one yet.</Txt>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              onPress={() => {
                onClose();
                router.push({ pathname: '/lift', params: { name, ...(ex ? { id: ex.id } : {}) } });
              }}
            >
              History
            </Button>
            <Button primary onPress={() => setSwapping(true)}>Swap exercise</Button>
          </View>
        </>
      ) : (
        <>
          <Txt size={14} color={C.body}>{ex ? `Same main muscle (${ex.primary[0]}). Pick one, or search.` : 'Search for a replacement.'}</Txt>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search exercises"
            placeholderTextColor={C.dim}
            keyboardAppearance="dark"
            style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', fontFamily: fontFamily(s.settings.font, 400), fontSize: 15, color: C.text }}
          />
          {options.map(o => {
            const b = records(s.sessions)[liftKey(o.name)]?.best;
            return (
              <Tap
                key={o.id}
                onPress={() => {
                  onSwap(o);
                  onClose();
                }}
                style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, gap: 3 }}
              >
                <Txt size={15}>{o.name}</Txt>
                <Txt face="mono" size={11} color={C.dim}>{`${cap(o.equipment)} · ${o.primary.join(', ')}${b?.e1rm ? ` · BEST ${b.kg} × ${b.reps}` : ''}`}</Txt>
              </Tap>
            );
          })}
          <Button onPress={() => setSwapping(false)}>Back</Button>
        </>
      )}
    </View>
  );
}

/** Long press a set: reps and weight actually done. */
export function SetSheet({ edit, onClose, onSave }: { edit: { title: string; reps: number; kg: number | null } | null; onClose: () => void; onSave: (reps: number, kg: number | null) => void }) {
  return (
    <Sheet open={!!edit} onClose={onClose}>
      {edit ? <SetBody key={edit.title} edit={edit} onClose={onClose} onSave={onSave} /> : null}
    </Sheet>
  );
}

function Step({ label, value, step, onChange, suffix }: { label: string; value: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  const s = useStore();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <Label size={10}>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Tap onPress={() => onChange(Math.max(0, +(value - step).toFixed(2)))} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={22} color={C.body}>−</Txt>
        </Tap>
        <TextInput
          value={text ?? String(value)}
          onChangeText={t => {
            setText(t);
            const v = parseFloat(t.replace(',', '.'));
            if (v >= 0) onChange(v);
          }}
          onBlur={() => setText(null)}
          keyboardType="decimal-pad"
          keyboardAppearance="dark"
          selectTextOnFocus
          style={{ width: 90, textAlign: 'center', fontFamily: fontFamily(s.settings.font, 300), fontSize: 34, color: C.text }}
        />
        <Tap onPress={() => onChange(+(value + step).toFixed(2))} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={22} color={C.body}>+</Txt>
        </Tap>
        {suffix ? <Txt size={14} color={C.dim}>{suffix}</Txt> : null}
      </View>
    </View>
  );
}

function SetBody({ edit, onClose, onSave }: { edit: { title: string; reps: number; kg: number | null }; onClose: () => void; onSave: (reps: number, kg: number | null) => void }) {
  const s = useStore();
  const [reps, setReps] = useState(edit.reps);
  const [kg, setKg] = useState<number | null>(edit.kg);
  const est = e1rm(kg, reps);
  return (
    <View style={{ gap: 18 }}>
      <Txt size={20} w={500}>{edit.title}</Txt>
      <Step label="REPS" value={reps} step={1} onChange={v => setReps(Math.round(v))} />
      {kg != null ? (
        <Step label="WEIGHT" value={kg} step={2.5} onChange={setKg} suffix="kg" />
      ) : null}
      <Tap onPress={() => setKg(kg == null ? 20 : null)}>
        <Txt size={14} color={C.body}>{kg == null ? '+ Add weight' : 'Bodyweight only'}</Txt>
      </Tap>
      {est ? <Txt face="mono" size={12} color={s.accent}>{`EST. MAX ${Math.round(est)} KG`}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button onPress={onClose}>Cancel</Button>
        <Button
          primary
          onPress={() => {
            onSave(reps, kg);
            onClose();
          }}
        >
          Save set
        </Button>
      </View>
    </View>
  );
}
