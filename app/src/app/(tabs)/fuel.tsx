// Fuel: the ensō (calories closing toward the day's target) with what is left beside it, the
// macros, REI's read, four ways to log a meal, quick re-adds, and today's meals.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform, TextInput, View } from 'react-native';
import { CoachShout, CutButton, Meter, RoundStamp, SectionHeader, useWarn } from '../../components/fight';
import { FoodSheet, MealSheet } from '../../components/FoodSheet';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { InkDot } from '../../components/ink';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Dots, Tap, Txt } from '../../components/ui';
import { amountLabel, dailyTargets, dayIntake, dayStamp, daysBetween, ENERGY_WON_AT, energyState, type Food, fuelLine, itemFor, type Meal, nutrition, parseIsoDate, searchFoods, splitMealText } from '@rei/shared';
import { C, F, fontFamily, HIT, RADIUS, soften, SP } from '../../lib/theme';
import { useStore } from '../../state/store';

const QUICK = ['200 g chicken + rice', 'Protein shake', '3 eggs on toast', '2 roti + dal'];

export default function Fuel() {
  const s = useStore();
  const now = useNow();
  const { settings, profile, accent, meals } = s;
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const [pick, setPick] = useState<{ food: Food; qty: number; unit?: string } | null>(null);
  // The meal itself, not its place in the list: another device can change the order meanwhile.
  const [editing, setEditing] = useState<Meal | null>(null);
  // Why a photo couldn't be taken (no account, camera off), said on the page.
  const [notice, setNotice] = useState('');
  // Live matches for what's being typed (the last piece, so "2 roti, da" suggests dal).
  const piece = draft.includes(',') || / and | with |\+/.test(draft) ? null : splitMealText(draft).pop();
  const suggestions = piece && !s.fuelBusy ? searchFoods(piece.query, s.allFoods, 5) : [];
  const favs = s.foods.filter(f => f.fav);
  const recent = s.recent.filter(m => !favs.some(f => f.name.toLowerCase() === m.name.toLowerCase())).slice(0, 6);
  const nu = nutrition(meals, s.activity);
  const n = (k: keyof typeof profile) => parseFloat(profile[k]) || 0;
  const kcalT = n('kcal'), protT = n('protein');
  const kL = kcalT - nu.kcal, pL = protT - nu.protein;
  const energy = energyState(nu.kcal, kcalT);
  const tag = energy === 'over' ? 'Over' : !meals.length ? 'Nothing yet' : pL > 0 && pL * 4 > kL * 0.6 ? 'Tight' : 'On track';
  const has = !!draft.trim() && !s.fuelBusy;
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
  const warn = useWarn();
  // Shown by the time eaten, whatever order they were logged in (a breakfast added at night goes first).
  const hits = meals.map((m, i) => ({ m, i })).sort((a, b) => a.m.time.localeCompare(b.m.time) || a.i - b.i);
  const started = parseIsoDate(s.startedOn);
  const day = started ? Math.max(1, daysBetween(started, now) + 1) : 1;

  /** Camera (or library on web): resize on the phone, then let REI read the plate. */
  const photo = async (fromLibrary = false) => {
    if (s.fuelBusy) return;
    setNotice('');
    if (!s.cloud) {
      setNotice('Sign in for photo logging. REI reads plates in the cloud, so photos need an account.');
      return;
    }
    const useLibrary = fromLibrary || Platform.OS === 'web';
    if (!useLibrary) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setNotice('Camera is off. Allow camera access in Settings to log meals by photo.');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = useLibrary ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    const img = await ImageManipulator.manipulate(asset.uri).resize({ width: 1024 }).renderAsync();
    const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (out.base64) await s.logMealPhoto(out.base64, draft.trim() || undefined);
    setDraft('');
  };

  const log = (t: string) => {
    if (!t.trim() || s.fuelBusy) return;
    setDraft('');
    setNotice('');
    input.current?.blur();
    s.logMeal(t);
  };

  const intake = dayIntake(meals);
  const fibT = dailyTargets({ kcal: kcalT, sex: s.sex }).fib;
  // `cap`: going past it is flagged (carbs, fat); protein and fibre can't be overdone here.
  const macros: { label: string; eaten: number; target: number; cap?: boolean }[] = [
    { label: 'Protein', eaten: nu.protein, target: protT },
    { label: 'Carbs', eaten: nu.carbs, target: n('carbs'), cap: true },
    { label: 'Fat', eaten: nu.fat, target: n('fat'), cap: true },
    { label: 'Fibre', eaten: intake.totals.fib, target: fibT },
  ];
  const toNutrition = () => router.push('/nutrition');
  const need = pL > 0 ? `Protein needs ${fmt(pL)} g` : kL > 0 && energy !== 'won' && energy !== 'unset' ? `${fmt(kL)} kcal left` : undefined;
  // What the meter shows, in words: the same call as its stamp and as Today's status.
  const energySay = energy === 'unset' ? `Energy ${fmt(nu.kcal)} kcal, no target set` : `Energy ${fmt(nu.kcal)} of ${fmt(kcalT)} kcal, ${energy === 'over' ? `${fmt(-kL)} over` : energy === 'won' ? 'kept' : `${fmt(kL)} left`}`;

  return (
    <Screen>
      <PageTitle
        icon="fuel"
        title="Fuel"
        sub={`Day ${day} · ${soften(dayStamp(now))}`}
        right={<RoundStamp size="sm" label={tag === 'Nothing yet' ? 'Open' : tag} tone={tag === 'On track' ? 'accent' : 'outline'} />}
      />

      <Tap onPress={toNutrition} accessibilityLabel={`${energySay}. Open the full breakdown`} style={{ marginTop: SP.xl }}>
        <Meter value={nu.kcal} target={kcalT} unit="kcal" size="lg" past="flag" wonAt={ENERGY_WON_AT} label="Energy" />
        {energy === 'unset' ? <Txt face="label" w={400} size={12} color={F.smoke} style={{ marginTop: SP.sm }}>No calorie target yet. Set one in Vow.</Txt> : null}
      </Tap>

      <View style={{ marginTop: SP.xl, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.xs }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: SP.lg, rowGap: SP.lg, paddingBottom: SP.md }}>
          {macros.map(m => (
            <View key={m.label} style={{ width: '45%', flexGrow: 1 }}>
              <Meter size="sm" label={m.label} value={m.eaten} target={m.target} unit="g" past={m.cap ? 'flag' : 'win'} />
            </View>
          ))}
        </View>
        <Tap onPress={toNutrition} accessibilityLabel="Full breakdown: vitamins, minerals, sodium, by meal" style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: SP.sm, borderTopWidth: 1, borderTopColor: C.line }}>
          <Txt face="label" size={13} color={accent} style={{ flex: 1 }}>Full breakdown: vitamins, minerals, by meal</Txt>
          <Icon name="chevron" size={16} color={accent} tint={0} strokeWidth={1.8} />
        </Tap>
      </View>

      <CoachShout before={s.fuelBusy ? 'Reading the plate…' : s.fuelVerdict || fuelLine(profile, nu)} style={{ marginTop: SP.xl }} />

      <SectionHeader title="Log a meal" style={{ marginTop: SP.huge }} />
      <CutButton label="Log a meal" icon="plus" meta={need} accessibilityLabel={`Log a meal: type it${need ? `. ${need}` : ''}`} onPress={() => input.current?.focus()} style={{ marginTop: SP.md }} />
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        <View style={{ flex: 1, height: 48, backgroundColor: F.canvas, borderWidth: 1, borderColor: draft ? F.smoke : F.rule, borderRadius: RADIUS.sm, justifyContent: 'center', paddingHorizontal: SP.lg }}>
          <TextInput
            ref={input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => log(draft)}
            placeholder="2 roti, dal and curd…"
            placeholderTextColor={C.dim}
            returnKeyType="done"
            keyboardAppearance="dark"
            accessibilityLabel="Describe what you ate"
            style={{ fontFamily: fontFamily(settings.font, 500), fontSize: 16 * settings.textSize, color: C.text }}
          />
        </View>
        <Tap onPress={() => log(draft)} disabled={!has} accessibilityLabel={s.fuelBusy ? 'REI is working on it' : 'Log this meal'} style={{ width: 48, height: 48, backgroundColor: has ? F.chalk : F.canvas, borderWidth: 1, borderColor: has ? F.chalk : F.rule, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' }}>
          {s.fuelBusy ? <Dots /> : <Icon name="check" size={20} color={has ? F.arena : F.smoke} tint={0} strokeWidth={2} />}
        </Tap>
      </View>
      {suggestions.length ? (
        <View style={{ marginTop: SP.xs }}>
          {suggestions.map(({ food }) => {
            const it = itemFor(food, piece!.qty, piece!.unit);
            return (
              <Tap key={food.id} onPress={() => setPick({ food, qty: piece!.qty, unit: piece!.unit })} accessibilityLabel={`${food.name}, ${amountLabel(it)}, ${it.kcal} kcal, protein ${Math.round(it.p)} grams${food.fav ? ', favourite' : ''}`}>
                <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <InkDot color={food.fav ? accent : F.rule} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt size={15} w={500} lh={1.35} numberOfLines={1}>{food.name}</Txt>
                    <Txt face="label" w={400} size={12} color={F.smoke} numberOfLines={1}>{`${amountLabel(it)}${food.brand ? ` · ${food.brand}` : ''}`}</Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt face="num" size={14} lh={1.3}>{`${it.kcal} kcal`}</Txt>
                    <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{`P ${Math.round(it.p)}`}</Txt>
                  </View>
                </View>
              </Tap>
            );
          })}
        </View>
      ) : (
        <Txt size={13} lh={1.5} color={F.smoke} style={{ marginTop: SP.sm }}>Foods on the list log at once. Anything else, REI estimates.</Txt>
      )}
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        <CutButton label="Photo" tone="quiet" size="md" accessibilityLabel="Snap a photo of the plate" onPress={() => photo()} style={{ flex: 1 }} />
        <CutButton label="Scan" tone="quiet" size="md" accessibilityLabel="Scan a barcode on packaged food" onPress={() => router.push('/scan')} style={{ flex: 1 }} />
        <CutButton label="Tell REI" tone="quiet" size="md" accessibilityLabel="Tell REI what you ate" onPress={() => router.push({ pathname: '/talk', params: { draft: 'I just ate ' } })} style={{ flex: 1 }} />
      </View>
      {notice ? <Txt size={13} lh={1.5} color={warn} style={{ marginTop: SP.sm }}>{notice}</Txt> : null}

      <SectionHeader title="Quick add" meta={favs.length || recent.length ? 'One tap' : 'Try one'} style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {favs.map(f => <Chip key={f.id} label={f.name} fav accent={accent} onPress={() => setPick({ food: f, qty: 1 })} />)}
        {recent.map(m => <Chip key={`r-${m.name}`} label={m.name} accent={accent} onPress={() => s.repeatMeal(m)} />)}
        {!favs.length && !recent.length ? QUICK.map(t => <Chip key={t} label={t} accent={accent} onPress={() => log(t)} />) : null}
      </View>

      <SectionHeader title="Meals" meta={meals.length ? `${meals.length} logged · ${fmt(nu.kcal)} kcal` : 'Nothing yet'} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.xs }}>
        {meals.length === 0 ? (
          <View style={{ marginTop: SP.sm, padding: SP.lg, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, gap: SP.xs }}>
            <Txt face="heading" size={17} lh={1.4} color={F.smoke}>Nothing on the page yet</Txt>
            <Txt size={14} lh={1.5} color={F.smoke}>Log your first meal for +10 XP.</Txt>
          </View>
        ) : null}
        {hits.map(({ m, i }) => {
          const est = m.items?.some(it => !it.food) || m.src === 'photo' || m.src === 'ai';
          const rest = ([['P', m.p], ['C', m.c], ['F', m.f], ['Fibre', m.n?.fib]] as const).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${Math.round(v as number)}`);
          return (
            <Tap key={m.id ?? `${m.time}-${i}`} haptic={false} onPress={() => setEditing(m)} accessibilityLabel={`${m.time}, ${m.name}, ${fmt(m.kcal)} kcal, protein ${Math.round(m.p)} grams${est ? ', estimated' : ''}. Edit`}>
              <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Txt face="mono" size={13} lh={1.25} color={F.smoke} style={{ minWidth: 44 }}>{m.time}</Txt>
                <InkDot />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={15} w={500} lh={1.35} numberOfLines={2}>{m.name}</Txt>
                  {m.items && m.items.length > 1 ? (
                    <Txt size={12} lh={1.4} color={F.smoke} numberOfLines={2}>{m.items.map(it => `${amountLabel(it)} ${it.name.toLowerCase()}`).join(' · ')}</Txt>
                  ) : null}
                  {rest.length || est ? <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{[...rest, ...(est ? ['est.'] : [])].join(' · ')}</Txt> : null}
                </View>
                <Txt face="num" size={14} lh={1.3} align="right">{`${fmt(m.kcal)} kcal`}</Txt>
                <Tap onPress={() => void s.removeMeal(m)} accessibilityLabel={`Delete ${m.name}`} hitSlop={{ left: 8 }} style={{ width: 32, height: HIT, alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={1.6} />
                </Tap>
              </View>
            </Tap>
          );
        })}
      </View>
      <FoodSheet pick={pick} onClose={() => (setPick(null), setDraft(''))} />
      <MealSheet meal={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** A quick-add chip: a quiet outlined tag, 44pt tall. Favourites are outlined in your colour and carry a star. */
function Chip({ label, fav, accent, onPress }: { label: string; fav?: boolean; accent: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={`${fav ? 'Favourite: ' : 'Add '}${label}`} style={{ flexShrink: 1, minHeight: HIT, paddingHorizontal: SP.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: F.canvas, borderWidth: 1, borderColor: fav ? accent : F.rule, borderRadius: RADIUS.sm }}>
      {fav ? <View><Icon name="star" size={14} color={accent} tint={1} strokeWidth={1.6} /></View> : <Icon name="plus" size={14} color={F.smoke} tint={0} strokeWidth={1.8} />}
      <Txt size={14} w={500} lh={1.4} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
    </Tap>
  );
}
