// Fuel: what's left in the tank today, four ways to log a meal, quick re-adds, and today's plate.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, TextInput, View } from 'react-native';
import { Core } from '../../components/Core';
import { FoodSheet, MealSheet } from '../../components/FoodSheet';
import { Icon, type IconKey } from '../../components/icons';
import { Gauge, Heading, Panel, Stamp, Tile } from '../../components/manga';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { amountLabel, dailyTargets, dayIntake, type Food, fuelLine, itemFor, nutrition, searchFoods, splitMealText } from '@rei/shared';
import { alpha, C, fontFamily } from '../../lib/theme';
import { useStore } from '../../state/store';

const QUICK = ['200 g chicken + rice', 'Protein shake', '3 eggs on toast', '2 roti + dal'];

export default function Fuel() {
  const s = useStore();
  const { settings, profile, accent, meals } = s;
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const [pick, setPick] = useState<{ food: Food; qty: number; unit?: string } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // Live matches for what's being typed (the last piece, so "2 roti, da" suggests dal).
  const piece = draft.includes(',') || / and | with |\+/.test(draft) ? null : splitMealText(draft).pop();
  const suggestions = piece && !s.fuelBusy ? searchFoods(piece.query, s.allFoods, 5) : [];
  const favs = s.foods.filter(f => f.fav);
  const recent = s.recent.filter(m => !favs.some(f => f.name.toLowerCase() === m.name.toLowerCase())).slice(0, 6);
  const nu = nutrition(meals, s.activity);
  const n = (k: keyof typeof profile) => parseFloat(profile[k]) || 0;
  const kcalT = n('kcal'), protT = n('protein');
  const kL = kcalT - nu.kcal, pL = protT - nu.protein;
  const tag = kL < 0 ? 'Over' : pL > 0 && pL * 4 > kL * 0.6 ? 'Tight' : 'On track';
  const tagColor = kL < 0 ? C.alert : tag === 'Tight' ? C.warn : accent;
  const has = !!draft.trim() && !s.fuelBusy;
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

  /** Camera (or library on web): resize on the phone, then let REI read the plate. */
  const photo = async (fromLibrary = false) => {
    if (s.fuelBusy) return;
    if (!s.cloud) {
      Alert.alert('Sign in for photo logging', 'REI reads plates in the cloud, so photos need an account.');
      return;
    }
    const useLibrary = fromLibrary || Platform.OS === 'web';
    if (!useLibrary) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera is off', 'Allow camera access in Settings to log meals by photo.');
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
    input.current?.blur();
    s.logMeal(t);
  };

  const intake = dayIntake(meals);
  const fibT = dailyTargets({ kcal: kcalT, sex: s.sex }).fib;
  const macros: { label: string; icon: IconKey; eaten: number; target: number; color: string }[] = [
    { label: 'Protein', icon: 'protein', eaten: nu.protein, target: protT, color: accent },
    { label: 'Carbs', icon: 'carbs', eaten: nu.carbs, target: n('carbs'), color: C.carbs },
    { label: 'Fat', icon: 'fat', eaten: nu.fat, target: n('fat'), color: C.fat },
    { label: 'Fibre', icon: 'fiber', eaten: intake.totals.fib, target: fibT, color: '#7BD88F' },
  ];

  return (
    <Screen>
      <PageTitle icon="fuel" title="Fuel" sub="Eat · log · refuel" />

      <Panel acc={tagColor} style={{ marginTop: 22 }} pad={20} onPress={() => router.push('/nutrition')}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Txt face="mono" size={10} ls={0.16} color={C.muted}>{kL < 0 ? 'CALORIES OVER' : 'CALORIES LEFT'}</Txt>
            <Txt size={56} w={300} ls={-0.05} lh={1.05} color={kL < 0 ? C.alert : C.text}>{fmt(Math.abs(kL))}</Txt>
            <Txt face="mono" size={11} color={C.muted}>{`${fmt(nu.kcal)} EATEN · ${fmt(kcalT)} TARGET`}</Txt>
          </View>
          <Stamp text={tag} color={tagColor} />
        </View>
        <View style={{ marginTop: 14 }}>
          <Gauge pct={kcalT ? nu.kcal / kcalT : 0} acc={kL < 0 ? C.alert : accent} segments={24} />
        </View>
        <View style={{ marginTop: 18, gap: 12 }}>
          {macros.map(m => {
            const over = m.target > 0 && m.eaten > m.target && m.label !== 'Protein' && m.label !== 'Fibre';
            return (
              <View key={m.label} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={m.icon} size={17} color={over ? C.alert : m.color} />
                  <Txt size={14} w={500} style={{ flex: 1 }}>{m.label}</Txt>
                  <Txt face="mono" size={12} color={over ? C.alert : C.body}>{`${fmt(m.eaten)} / ${fmt(m.target)} g`}</Txt>
                </View>
                <Gauge pct={m.target ? m.eaten / m.target : 0} acc={over ? C.alert : m.color} segments={24} height={6} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line2 }}>
          <Core size={28} alert={kL < 0} speaking={s.fuelBusy} />
          <Txt size={14} lh={1.45} color={C.textSoft} style={{ flex: 1 }}>{s.fuelBusy ? 'Reading the plate…' : s.fuelVerdict || fuelLine(profile, nu)}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line2 }}>
          <Icon name="vitamin" size={16} color={accent} />
          <Txt size={13} w={500} color={accent} style={{ flex: 1 }}>Full breakdown: vitamins, minerals, sodium, by meal</Txt>
          <Icon name="chevron" size={14} color={accent} />
        </View>
      </Panel>

      <Heading icon="plus" title="Log a meal" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Tile icon="fuel" label="Describe" sub="type it" acc={accent} hot onPress={() => input.current?.focus()} />
        <Tile icon="camera" label="Snap" sub="photo of the plate" acc={accent} onPress={() => photo()} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Tile icon="barcode" label="Scan" sub="packaged food" acc={accent} onPress={() => router.push('/scan')} />
        <Tile icon="voice" label="Tell REI" sub="just say it" acc={accent} onPress={() => router.push({ pathname: '/talk', params: { draft: 'I just ate ' } })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <View style={{ flex: 1, height: 54, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: draft ? alpha(accent, 0.6) : C.line3, justifyContent: 'center', paddingHorizontal: 16 }}>
          <TextInput
            ref={input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => log(draft)}
            placeholder="2 roti, dal and curd…"
            placeholderTextColor={C.dim}
            returnKeyType="done"
            keyboardAppearance="dark"
            style={{ fontFamily: fontFamily(settings.font, 400), fontSize: 16, color: C.text }}
          />
        </View>
        <Tap onPress={() => log(draft)} disabled={!has} style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: has ? accent : '#14161A', alignItems: 'center', justifyContent: 'center' }}>
          {s.fuelBusy ? <Txt size={18} color={C.dim}>…</Txt> : <Icon name="check" size={22} color={has ? C.ink : C.dim} tint={0} strokeWidth={2.2} />}
        </Tap>
      </View>
      {suggestions.length ? (
        <View style={{ marginTop: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', paddingHorizontal: 14 }}>
          {suggestions.map(({ food }, i) => {
            const it = itemFor(food, piece!.qty, piece!.unit);
            return (
              <Tap key={food.id} onPress={() => setPick({ food, qty: piece!.qty, unit: piece!.unit })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt size={15} numberOfLines={1}>{`${food.fav ? '★ ' : ''}${food.name}`}</Txt>
                  <Txt face="mono" size={11} color={C.dim}>{`${amountLabel(it)}${food.brand ? ` · ${food.brand}` : ''}`}</Txt>
                </View>
                <Txt face="mono" size={13} color={C.value}>{`${it.kcal} kcal`}</Txt>
                <Txt face="mono" size={11} color={accent}>{`P ${Math.round(it.p)}`}</Txt>
              </Tap>
            );
          })}
        </View>
      ) : (
        <Txt size={12} color={C.faint} style={{ marginTop: 8 }}>Foods on the list log instantly. Anything else, REI estimates.</Txt>
      )}

      <Heading icon="streak" title="Quick add" acc={accent} style={{ marginTop: 28 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {favs.map(f => (
          <Tap key={f.id} onPress={() => setPick({ food: f, qty: 1 })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: alpha(C.warn, 0.4), backgroundColor: '#14130F' }}>
            <Icon name="badge" size={14} color={C.warn} />
            <Txt size={13}>{f.name}</Txt>
          </Tap>
        ))}
        {recent.map(m => (
          <Tap key={`r-${m.name}`} onPress={() => s.repeatMeal(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13' }}>
            <Icon name="plus" size={13} color={C.muted} />
            <Txt size={13} color={C.body}>{m.name}</Txt>
          </Tap>
        ))}
        {!favs.length && !recent.length ? QUICK.map(t => (
          <Tap key={t} onPress={() => log(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13' }}>
            <Icon name="plus" size={13} color={C.muted} />
            <Txt size={13} color={C.body}>{t}</Txt>
          </Tap>
        )) : null}
      </View>

      <Heading icon="fuel" title="Today's plate" acc={accent} right={`${fmt(nu.kcal)} KCAL`} style={{ marginTop: 30 }} />
      <View style={{ marginTop: 14, gap: 10 }}>
        {meals.length === 0 ? (
          <View style={{ padding: 18, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line3, alignItems: 'center', gap: 8 }}>
            <Icon name="fuel" size={30} color={C.faint} />
            <Txt size={14} color={C.dim} align="center">Nothing on the plate yet. Log your first meal for +10 XP.</Txt>
          </View>
        ) : null}
        {meals.map((m, i) => {
          const est = m.items?.some(it => !it.food) || m.src === 'photo' || m.src === 'ai';
          return (
            <Tap key={`${m.time}-${i}`} haptic={false} onPress={() => setEditing(i)}>
              <View style={{ padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Txt face="mono" size={11} color={C.dim}>{m.time}</Txt>
                  <Txt size={16} w={600} style={{ flex: 1 }} numberOfLines={2}>{m.name}</Txt>
                  <Tap onPress={() => s.removeMeal(i)} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={14} color={C.faint} />
                  </Tap>
                </View>
                {m.items && m.items.length > 1 ? (
                  <Txt size={12} color={C.dim} numberOfLines={2}>{m.items.map(it => `${amountLabel(it)} ${it.name.toLowerCase()}`).join(' · ')}</Txt>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {([['protein', m.p, accent], ['carbs', m.c, C.carbs], ['fat', m.f, C.fat], ['fiber', m.n?.fib, '#7BD88F']] as const).map(([ic, v, col]) =>
                    typeof v === 'number' ? (
                      <View key={ic} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name={ic} size={13} color={col} />
                        <Txt face="mono" size={11} color={col}>{`${Math.round(v)}g`}</Txt>
                      </View>
                    ) : null,
                  )}
                  {est ? <Txt face="mono" size={9} ls={0.12} color={C.faint}>≈ EST</Txt> : null}
                  <View style={{ flex: 1 }} />
                  <Txt face="mono" size={13} color={C.value}>{`${fmt(m.kcal)} kcal`}</Txt>
                </View>
              </View>
            </Tap>
          );
        })}
      </View>
      <FoodSheet pick={pick} onClose={() => (setPick(null), setDraft(''))} />
      <MealSheet index={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
