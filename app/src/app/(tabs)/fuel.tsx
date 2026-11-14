// Fuel: the super meter (energy filling toward full), the macro bars, REI's read, four ways to
// log a meal, quick re-adds, and the hit log of what has landed today.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform, TextInput, View } from 'react-native';
import { CutBox } from '../../components/cut';
import { CoachShout, CutButton, Meter, MeterBar, RoundStamp, SectionHeader } from '../../components/fight';
import { FoodSheet, MealSheet } from '../../components/FoodSheet';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Dots, Tap, Txt } from '../../components/ui';
import { amountLabel, dailyTargets, dayIntake, dayStamp, daysBetween, type Food, fuelLine, itemFor, type Meal, nutrition, parseIsoDate, searchFoods, splitMealText } from '@rei/shared';
import { C, F, fontFamily, HIT, onColor, SP } from '../../lib/theme';
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
  const tag = kL < 0 ? 'Over' : !meals.length ? 'Nothing yet' : pL > 0 && pL * 4 > kL * 0.6 ? 'Tight' : 'On track';
  const has = !!draft.trim() && !s.fuelBusy;
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
  const started = parseIsoDate(s.startedOn);
  const round = started ? Math.max(1, daysBetween(started, now) + 1) : 1;

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
  // One cell is about 100 kcal; the count is kept sane for very small or very large targets.
  const cells = Math.max(10, Math.min(30, Math.round(kcalT / 100) || 10));
  const toNutrition = () => router.push('/nutrition');
  const need = pL > 0 ? `Protein needs ${fmt(pL)} g` : kL > 0 ? `${fmt(kL)} kcal to full` : undefined;

  return (
    <Screen>
      <PageTitle
        title="Fuel"
        sub={`ROUND ${round} · ${dayStamp(now)}`}
        right={<RoundStamp size="sm" label={tag === 'Nothing yet' ? 'Round open' : tag} tone={tag === 'Over' ? 'rival' : tag === 'On track' ? 'accent' : 'outline'} />}
      />

      <SectionHeader title="Super meter" meta="Full breakdown" onMeta={toNutrition} style={{ marginTop: SP.xl }} />
      <Tap onPress={toNutrition} accessibilityLabel={`Energy ${fmt(nu.kcal)} of ${fmt(kcalT)} kcal, ${kL < 0 ? `${fmt(-kL)} over` : `${fmt(kL)} to full`}. Open the full breakdown`} style={{ marginTop: SP.md }}>
        <Meter value={nu.kcal} target={kcalT} unit="kcal" size="lg" segments={cells} past="flag" label="Energy" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.xs }}>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>0</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`1 CELL = ${fmt(kcalT / cells)} KCAL`}</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} color={accent}>{`${fmt(kcalT)} FULL`}</Txt>
        </View>
      </Tap>

      <View style={{ marginTop: SP.lg, gap: SP.md }}>
        {macros.map(m => {
          const over = m.cap && m.target > 0 && m.eaten > m.target ? (m.eaten - m.target) / m.target : 0;
          return (
            <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Txt face="label" w={600} size={13} ls={0.12} color={F.smoke} style={{ width: 62 }}>{m.label.toUpperCase()}</Txt>
              <MeterBar pct={m.target ? m.eaten / m.target : 0} over={over} height={16} accessibilityLabel={`${m.label} ${fmt(m.eaten)} of ${fmt(m.target)} grams${over ? ', over' : ''}`} style={{ flex: 1, alignSelf: 'center' }} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6, width: 98 }}>
                <Txt face="display" size={22} lh={1.15}>{fmt(m.eaten)}</Txt>
                <Txt face="label" size={14} color={over ? F.chalk : F.smoke} numberOfLines={1}>{over ? `/ ${fmt(m.target)} OVER` : `/ ${fmt(m.target)} g`}</Txt>
              </View>
            </View>
          );
        })}
      </View>
      <Tap onPress={toNutrition} accessibilityLabel="Full breakdown: vitamins, minerals, sodium, by meal" style={{ marginTop: SP.sm, minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Txt face="label" w={600} size={13} ls={0.12} color={accent} style={{ flex: 1 }}>FULL BREAKDOWN: VITAMINS, MINERALS, SODIUM, BY MEAL</Txt>
        <Icon name="chevron" size={16} color={accent} tint={0} strokeWidth={2.2} />
      </Tap>

      <CoachShout portrait={44} before={s.fuelBusy ? 'Reading the plate…' : s.fuelVerdict || fuelLine(profile, nu)} style={{ marginTop: SP.sm }} />

      <SectionHeader title="Log a meal" style={{ marginTop: SP.xxl }} />
      <CutButton label="Log a meal" icon="plus" meta={need} accessibilityLabel={`Log a meal: type it${need ? `. ${need}` : ''}`} onPress={() => input.current?.focus()} style={{ marginTop: SP.md }} />
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        <View style={{ flex: 1, height: 52, backgroundColor: F.canvas, borderWidth: 2, borderColor: draft ? accent : F.rope, justifyContent: 'center', paddingHorizontal: SP.lg }}>
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
            style={{ fontFamily: fontFamily(settings.font, 400), fontSize: 16 * settings.textSize, color: C.text }}
          />
        </View>
        <Tap onPress={() => log(draft)} disabled={!has} accessibilityLabel={s.fuelBusy ? 'REI is working on it' : 'Log this meal'} style={{ width: 52, height: 52, backgroundColor: has ? accent : F.canvas, borderWidth: 2, borderColor: has ? accent : F.rope, alignItems: 'center', justifyContent: 'center' }}>
          {s.fuelBusy ? <Dots /> : <Icon name="check" size={22} color={has ? onColor(accent) : F.smoke} tint={0} strokeWidth={2.4} />}
        </Tap>
      </View>
      {suggestions.length ? (
        <View style={{ marginTop: SP.sm, gap: 2 }}>
          {suggestions.map(({ food }) => {
            const it = itemFor(food, piece!.qty, piece!.unit);
            return (
              <Tap key={food.id} onPress={() => setPick({ food, qty: piece!.qty, unit: piece!.unit })} accessibilityLabel={`${food.name}, ${amountLabel(it)}, ${it.kcal} kcal, protein ${Math.round(it.p)} grams${food.fav ? ', favourite' : ''}`}>
                <View style={{ minHeight: HIT, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm }}>
                  {food.fav ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt size={15} w={500} numberOfLines={1}>{food.name}</Txt>
                    <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} numberOfLines={1}>{`${amountLabel(it)}${food.brand ? ` · ${food.brand}` : ''}`.toUpperCase()}</Txt>
                  </View>
                  <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke}>{`P ${Math.round(it.p)}`}</Txt>
                  <Txt face="display" size={20} lh={1.15} color={accent}>{`+${it.kcal}`}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>
      ) : (
        <Txt size={13} lh={1.4} color={F.smoke} style={{ marginTop: SP.sm }}>Foods on the list log instantly. Anything else, REI estimates.</Txt>
      )}
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        <CutButton label="Photo" tone="quiet" size="md" accessibilityLabel="Snap a photo of the plate" onPress={() => photo()} style={{ flex: 1 }} />
        <CutButton label="Scan" tone="quiet" size="md" accessibilityLabel="Scan a barcode on packaged food" onPress={() => router.push('/scan')} style={{ flex: 1 }} />
        <CutButton label="Tell REI" tone="quiet" size="md" accessibilityLabel="Tell REI what you ate" onPress={() => router.push({ pathname: '/talk', params: { draft: 'I just ate ' } })} style={{ flex: 1 }} />
      </View>
      {notice ? <Txt size={13} lh={1.4} color={C.warn} style={{ marginTop: SP.sm }}>{notice}</Txt> : null}

      <SectionHeader title="Quick add" meta={favs.length || recent.length ? 'One tap' : 'Try one'} style={{ marginTop: SP.xxl }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {favs.map(f => <Chip key={f.id} label={f.name} fav accent={accent} onPress={() => setPick({ food: f, qty: 1 })} />)}
        {recent.map(m => <Chip key={`r-${m.name}`} label={m.name} accent={accent} onPress={() => s.repeatMeal(m)} />)}
        {!favs.length && !recent.length ? QUICK.map(t => <Chip key={t} label={t} accent={accent} onPress={() => log(t)} />) : null}
      </View>

      <SectionHeader title="Hit log" meta={meals.length ? `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} landed · ${fmt(nu.kcal)} kcal` : 'Nothing landed'} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {meals.length === 0 ? (
          <View style={{ padding: SP.lg, borderWidth: 2, borderColor: F.rope, gap: SP.xs }}>
            <Txt face="display" size={20} lh={1.2} color={F.smoke}>NOTHING ON THE PLATE YET</Txt>
            <Txt size={14} lh={1.4} color={F.smoke}>Log your first meal for +10 XP.</Txt>
          </View>
        ) : null}
        {meals.map((m, i) => {
          const est = m.items?.some(it => !it.food) || m.src === 'photo' || m.src === 'ai';
          const rest = ([['C', m.c], ['F', m.f], ['FIBRE', m.n?.fib]] as const).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${Math.round(v as number)}`);
          return (
            <Tap key={m.id ?? `${m.time}-${i}`} haptic={false} onPress={() => setEditing(m)} accessibilityLabel={`${m.time}, ${m.name}, ${fmt(m.kcal)} kcal, protein ${Math.round(m.p)} grams${est ? ', estimated' : ''}. Edit`}>
              <View style={{ minHeight: HIT, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingLeft: SP.md, paddingVertical: SP.sm }}>
                <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke} style={{ minWidth: 40 }}>{m.time}</Txt>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={15} w={500} lh={1.3} numberOfLines={2}>{m.name}</Txt>
                  {m.items && m.items.length > 1 ? (
                    <Txt size={12} lh={1.35} color={F.smoke} numberOfLines={2}>{m.items.map(it => `${amountLabel(it)} ${it.name.toLowerCase()}`).join(' · ')}</Txt>
                  ) : null}
                  {rest.length || est ? <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} numberOfLines={1}>{[...rest, ...(est ? ['EST'] : [])].join(' · ')}</Txt> : null}
                </View>
                <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke}>{`P ${Math.round(m.p)}`}</Txt>
                <Txt face="display" size={22} lh={1.15} color={accent} align="right" style={{ minWidth: 52 }}>{`+${fmt(m.kcal)}`}</Txt>
                <Tap onPress={() => void s.removeMeal(m)} accessibilityLabel={`Delete ${m.name}`} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={2} />
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

/** A quick-add chip: a cut tag, 44pt tall. Favourites are outlined in your colour and carry a star. */
function Chip({ label, fav, accent, onPress }: { label: string; fav?: boolean; accent: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={`${fav ? 'Favourite: ' : 'Add '}${label}`} style={{ flexShrink: 1 }}>
      <CutBox fill={F.canvas} stroke={fav ? accent : F.rope} style={{ minHeight: HIT, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {fav ? <View><Icon name="star" size={14} color={accent} tint={1} strokeWidth={1.6} /></View> : <Txt face="label" w={600} size={16} color={F.smoke}>+</Txt>}
        <Txt size={14} w={500} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      </CutBox>
    </Tap>
  );
}
