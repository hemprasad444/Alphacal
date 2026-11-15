// Form tips and photos for an exercise, and swapping it for one that trains the same muscles.
import { alternatives, e1rm, exerciseImage, findExercise, type LibExercise, liftKey, records, searchExercises } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { TextInput, View } from 'react-native';
import { alpha, F, fontFamily, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';
import { Field, QuietButton } from './dojo';
import { CutButton, RoundStamp } from './fight';
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
 * A form photo as a manga panel: cropped to a square-cornered frame, tinted toward your colour
 * and dimmed to sit on the ink, with a stamp saying which end of the move it is.
 * (The library's photos are bright gym stock shots; raw, they fight the rest of the screen.)
 */
function FormPhoto({ uri, label, tag }: { uri: string; label: string; tag: string }) {
  const accent = useStore(s => s.accent);
  return (
    <View style={{ flex: 1, aspectRatio: 1.25, borderWidth: 3, borderColor: F.chalk, backgroundColor: F.canvas, overflow: 'hidden' }}>
      <Image source={{ uri }} accessibilityLabel={label} cachePolicy="memory-disk" transition={120} contentFit="cover" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      {/* The wash: a flat veil of your colour, then a flat dim. Plain overlays, so it draws the same on iOS (no blend modes). */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: alpha(accent, 0.22) }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: alpha(F.arena, 0.34) }} />
      <RoundStamp label={tag} size="sm" tone="chalk" style={{ position: 'absolute', left: 6, bottom: 6 }} />
    </View>
  );
}

/** Photos, muscles and the first form cues. */
export function ExerciseInfo({ ex, steps = 4 }: { ex: LibExercise; steps?: number }) {
  const tips = tipsFor(ex.id);
  return (
    <View style={{ gap: SP.md }}>
      {ex.images ? (
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          {[0, 1].slice(0, ex.images).map(i => (
            <FormPhoto key={i} uri={exerciseImage(ex.id, i)} label={`${ex.name}, ${i ? 'finish' : 'start'} position`} tag={i ? 'Finish' : 'Start'} />
          ))}
        </View>
      ) : null}
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{[ex.primary.join(' · '), ex.equipment, ex.level].filter(Boolean).join(' · ').toUpperCase()}</Txt>
      <View style={{ gap: SP.sm }}>
        {tips.slice(0, steps).map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: SP.md }}>
            <Txt face="display" lean={false} size={16} lh={1.3} color={F.smoke} style={{ width: 18 }}>{i + 1}</Txt>
            <Txt size={14} w={500} lh={1.45} style={{ flex: 1 }}>{t}</Txt>
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
    <View style={{ gap: SP.lg }}>
      <View style={{ gap: SP.xs, alignItems: 'flex-start' }}>
        <Txt face="label" w={600} size={12} ls={0.14} color={F.smoke}>{ex ? ex.name.toUpperCase() : 'EXERCISE'}</Txt>
        <View accessibilityRole="header">
          <Txt face="display" size={28} lh={1.2} numberOfLines={2}>{name.toUpperCase()}</Txt>
        </View>
        {best ? (
          <Txt face="label" w={600} size={13} ls={0.1} color={s.accent}>{`YOUR BEST · ${best.kg != null ? `${best.kg} × ${best.reps}` : `${best.reps} reps`}${best.e1rm ? ` · EST. MAX ${Math.round(best.e1rm)} KG` : ''}`.toUpperCase()}</Txt>
        ) : null}
      </View>

      {!swapping ? (
        <>
          {ex ? <ExerciseInfo ex={ex} /> : <Txt size={14} w={500} color={F.smoke}>No form guide for this one yet.</Txt>}
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
          <Txt size={14} w={500} lh={1.4} color={F.smoke}>{ex ? `Same main muscle (${ex.primary[0]}). Pick one, or search.` : 'Search for a replacement.'}</Txt>
          <Field value={q} onChangeText={setQ} placeholder="Search exercises" autoCorrect={false} />
          <View style={{ gap: SP.xs }}>
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
                  style={{ minHeight: HIT, paddingVertical: SP.sm, paddingHorizontal: SP.md, backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, gap: 2 }}
                >
                  <Txt size={15} w={600} lh={1.3}>{o.name}</Txt>
                  <Txt face="label" w={400} size={12} ls={0.08} color={F.smoke}>{`${cap(o.equipment)} · ${o.primary.join(', ')}${b?.e1rm ? ` · BEST ${b.kg} × ${b.reps}` : ''}`.toUpperCase()}</Txt>
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
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{label}</Txt>
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
          style={{ width: 96, height: 48, padding: 0, textAlign: 'center', fontFamily: fontFamily('display', 400), fontSize: 34 * s.settings.textSize, color: F.chalk }}
        />
        <IconButton size={48} onPress={() => onChange(+(value + step).toFixed(2))} accessibilityLabel={`${cap(label.toLowerCase())}: ${step} more`}>+</IconButton>
        {suffix ? <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>{suffix.toUpperCase()}</Txt> : null}
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
    <View style={{ gap: SP.lg }}>
      <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
        <Txt face="display" size={26} lh={1.2}>{edit.title.toUpperCase()}</Txt>
      </View>
      <Step label="REPS" value={reps} step={1} onChange={v => setReps(Math.round(v))} />
      {kg != null ? (
        <Step label="WEIGHT" value={kg} step={2.5} onChange={setKg} suffix="kg" />
      ) : null}
      <QuietButton label={kg == null ? 'Add weight' : 'Bodyweight only'} icon={kg == null ? 'plus' : undefined} onPress={() => setKg(kg == null ? 20 : null)} style={{ alignSelf: 'flex-start' }} />
      {est ? <Txt face="label" w={600} size={13} ls={0.1} color={s.accent}>{`EST. MAX ${Math.round(est)} KG`}</Txt> : null}
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
