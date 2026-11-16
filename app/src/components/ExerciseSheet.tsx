// Form tips and photos for an exercise, and swapping it for one that trains the same muscles.
import { alternatives, e1rm, exerciseImage, findExercise, type LibExercise, liftKey, records, searchExercises } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { TextInput, View } from 'react-native';
import { alpha, C, F, fontFamily, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';
import { Field, QuietButton } from './dojo';
import { CutButton } from './fight';
import { Sheet } from './FoodSheet';
import { IconButton, Tap, Txt } from './ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The form steps are large (about 580 KB), so they load the first time a guide opens.
let TIPS: Record<string, string[]> | null = null;
const tipsFor = (id: string): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred on purpose
  TIPS ??= (require('@rei/shared/src/exercises/tips') as typeof import('@rei/shared/src/exercises/tips')).TIPS;
  return TIPS[id] ?? [];
};

/**
 * A form photo: cropped into a softly rounded frame and dimmed to sit on the night ground, with a
 * quiet tag saying which end of the lift it is.
 * (The library's photos are bright gym stock shots; raw, they are louder than the rest of the screen.)
 */
function FormPhoto({ uri, label, tag }: { uri: string; label: string; tag: string }) {
  return (
    <View style={{ flex: 1, aspectRatio: 1.25, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, backgroundColor: F.canvas, overflow: 'hidden' }}>
      <Image source={{ uri }} accessibilityLabel={label} cachePolicy="memory-disk" transition={120} contentFit="cover" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      {/* A flat dim. A plain overlay, so it draws the same on iOS (no blend modes). */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: alpha(F.arena, 0.5) }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: SP.sm, bottom: SP.sm, paddingHorizontal: SP.sm, paddingVertical: 2, backgroundColor: alpha(F.arena, 0.82), borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.tag }}>
        <Txt face="mono" size={12} lh={1.35} color={F.chalk}>{tag}</Txt>
      </View>
    </View>
  );
}

/** Photos, muscles and the first form cues. */
export function ExerciseInfo({ ex, steps = 4 }: { ex: LibExercise; steps?: number }) {
  const tips = tipsFor(ex.id);
  return (
    <View style={{ gap: SP.lg }}>
      {ex.images ? (
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          {[0, 1].slice(0, ex.images).map(i => (
            <FormPhoto key={i} uri={exerciseImage(ex.id, i)} label={`${ex.name}, ${i ? 'finish' : 'start'} position`} tag={i ? 'Finish' : 'Start'} />
          ))}
        </View>
      ) : null}
      <Txt face="mono" size={12} lh={1.4} color={F.smoke}>{cap([ex.primary.join(' · '), ex.equipment, ex.level].filter(Boolean).join(' · '))}</Txt>
      <View style={{ gap: SP.md }}>
        {tips.slice(0, steps).map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: SP.md }}>
            <Txt face="heading" size={15} lh={1.5} color={F.smoke} style={{ width: 20 }}>{i + 1}</Txt>
            <Txt size={15} lh={1.5} color={C.body} style={{ flex: 1 }}>{t}</Txt>
          </View>
        ))}
      </View>
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
    <View style={{ gap: SP.xl, paddingTop: SP.xs }}>
      <View style={{ gap: SP.xs, alignItems: 'flex-start' }}>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{ex && ex.name.toLowerCase() !== name.toLowerCase() ? ex.name : 'Exercise'}</Txt>
        <View accessibilityRole="header">
          <Txt face="display" exact size={24} lh={1.25} numberOfLines={2}>{name}</Txt>
        </View>
        {best ? (
          <Txt face="mono" size={12} lh={1.4} color={s.accent}>{`Your best · ${best.kg != null ? `${best.kg} × ${best.reps}` : `${best.reps} reps`}${best.e1rm ? ` · est. max ${Math.round(best.e1rm)} kg` : ''}`}</Txt>
        ) : null}
      </View>

      {!swapping ? (
        <>
          {ex ? <ExerciseInfo ex={ex} /> : <Txt size={15} lh={1.45} color={F.smoke}>No form guide for this one yet.</Txt>}
          <View style={{ gap: SP.sm }}>
            <CutButton size="md" label="Swap exercise" onPress={() => setSwapping(true)} />
            <QuietButton
              label="History"
              accessibilityLabel={`History for ${name}`}
              onPress={() => {
                onClose();
                router.push({ pathname: '/lift', params: { name, ...(ex ? { id: ex.id } : {}) } });
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Txt size={15} lh={1.45} color={F.smoke}>{ex ? `Same main muscle (${ex.primary[0]}). Pick one, or search.` : 'Search for a replacement.'}</Txt>
          <Field value={q} onChangeText={setQ} placeholder="Search exercises" autoCorrect={false} />
          <View>
            {options.map(o => {
              const b = records(s.sessions)[liftKey(o.name)]?.best;
              return (
                <Tap
                  key={o.id}
                  accessibilityLabel={`Swap to ${o.name}`}
                  onPress={() => {
                    onSwap(o);
                    onClose();
                  }}
                  style={{ minHeight: 56, paddingVertical: SP.sm, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.line, gap: 2 }}
                >
                  <Txt size={15} w={500} lh={1.35}>{o.name}</Txt>
                  <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{`${cap(o.equipment)} · ${o.primary.join(', ')}${b?.e1rm ? ` · best ${b.kg} × ${b.reps}` : ''}`}</Txt>
                </Tap>
              );
            })}
          </View>
          <QuietButton label="Back" onPress={() => setSwapping(false)} />
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
    <View style={{ gap: SP.sm }}>
      <Txt face="label" size={12} color={F.smoke}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
        <IconButton size={48} onPress={() => onChange(Math.max(0, +(value - step).toFixed(2)))} accessibilityLabel={`${cap(label.toLowerCase())}: ${step} less`}>−</IconButton>
        <TextInput
          value={text ?? String(value)}
          accessibilityLabel={cap(label.toLowerCase())}
          onChangeText={t => {
            setText(t);
            const v = parseFloat(t.replace(',', '.'));
            if (v >= 0) onChange(v);
          }}
          onBlur={() => setText(null)}
          keyboardType="decimal-pad"
          keyboardAppearance="dark"
          selectTextOnFocus
          style={{ width: 96, height: 48, padding: 0, textAlign: 'center', fontFamily: fontFamily('num'), fontSize: 28 * s.settings.textSize, color: F.chalk }}
        />
        <IconButton size={48} onPress={() => onChange(+(value + step).toFixed(2))} accessibilityLabel={`${cap(label.toLowerCase())}: ${step} more`}>+</IconButton>
        {suffix ? <Txt face="mono" size={12} color={F.smoke}>{suffix}</Txt> : null}
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
    <View style={{ gap: SP.xl, paddingTop: SP.xs }}>
      <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
        <Txt face="display" exact size={24} lh={1.25}>{edit.title}</Txt>
      </View>
      <Step label="Reps" value={reps} step={1} onChange={v => setReps(Math.round(v))} />
      {kg != null ? (
        <Step label="Weight" value={kg} step={2.5} onChange={setKg} suffix="kg" />
      ) : null}
      <QuietButton label={kg == null ? 'Add weight' : 'Bodyweight only'} icon={kg == null ? 'plus' : undefined} onPress={() => setKg(kg == null ? 20 : null)} style={{ alignSelf: 'flex-start' }} />
      {est ? <Txt face="mono" size={12} lh={1.4} color={s.accent}>{`Est. max ${Math.round(est)} kg`}</Txt> : null}
      <View style={{ gap: SP.sm }}>
        <CutButton
          size="md"
          label="Save set"
          onPress={() => {
            onSave(reps, kg);
            onClose();
          }}
        />
        <QuietButton label="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}
