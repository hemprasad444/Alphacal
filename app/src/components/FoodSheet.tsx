// Bottom sheets for food: pick a portion of a food, or fix a logged meal.
import { amountLabel, foodFromMeal, type Food, itemFor, type Meal, type MealItem, mealFromItems, unitFor } from '@rei/shared';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newId } from '../lib/sync';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';
import { Label, Tap, Txt } from './ui';

const SOURCE: Record<Food['src'], string> = { ifct: 'IFCT 2017 · INDIAN FOOD TABLES', dish: 'TYPICAL PORTION', usda: 'USDA · VIA TEMPOLIFE (CC-BY)', barcode: 'OPEN FOOD FACTS', mine: 'YOUR FOOD' };

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { theme } = useStore();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
        <View style={{ maxHeight: '85%', backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: C.line3, paddingTop: 10, paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 12 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Pill({ on, children, onPress }: { on?: boolean; children: string; onPress: () => void }) {
  const { accent } = useStore();
  return (
    <Tap onPress={onPress} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderColor: on ? accent : 'rgba(255,255,255,0.1)', backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
      <Txt size={13} color={on ? C.text : C.body}>{children}</Txt>
    </Tap>
  );
}

export function Button({ children, onPress, primary, danger, disabled }: { children: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const { accent } = useStore();
  return (
    <Tap disabled={disabled} onPress={onPress} style={{ flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: primary && !disabled ? accent : 'transparent', borderWidth: primary ? 0 : 1, borderColor: danger ? 'rgba(255,90,60,0.45)' : 'rgba(255,255,255,0.14)' }}>
      <Txt size={15} w={500} color={primary ? (disabled ? C.dim : C.ink) : danger ? C.alert : C.body}>{children}</Txt>
    </Tap>
  );
}

function Stepper({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  const { settings } = useStore();
  const [text, setText] = useState<string | null>(null);
  const fix = (v: number) => Math.max(step, Math.round(v / step) * step);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Tap onPress={() => onChange(fix(value - step))} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={20} color={C.body}>−</Txt>
      </Tap>
      <TextInput
        value={text ?? String(+value.toFixed(2))}
        onChangeText={t => {
          setText(t);
          const v = parseFloat(t.replace(',', '.'));
          if (v > 0) onChange(v);
        }}
        onBlur={() => setText(null)}
        keyboardType="decimal-pad"
        keyboardAppearance="dark"
        selectTextOnFocus
        style={{ width: 76, textAlign: 'center', fontFamily: fontFamily(settings.font, 400), fontSize: 24, color: C.text }}
      />
      <Tap onPress={() => onChange(fix(value + step))} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Txt size={20} color={C.body}>+</Txt>
      </Tap>
    </View>
  );
}

function Macros({ i }: { i: Pick<MealItem, 'kcal' | 'p' | 'c' | 'f'> }) {
  const { accent } = useStore();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14 }}>
      <Txt size={28} w={300} ls={-0.03}>{`${Math.round(i.kcal)}`}<Txt size={13} color={C.dim}> kcal</Txt></Txt>
      <Txt face="mono" size={12} color={accent}>{`P ${Math.round(i.p)}`}</Txt>
      <Txt face="mono" size={12} color={C.carbs}>{`C ${Math.round(i.c)}`}</Txt>
      <Txt face="mono" size={12} color={C.fat}>{`F ${Math.round(i.f)}`}</Txt>
    </View>
  );
}

/** Portion picker for one food; reports the resulting item. */
export function Portion({ food, qty, unit, onChange }: { food: Food; qty: number; unit: string; onChange: (qty: number, unit: string) => void }) {
  const units = [...food.units.map(u => u.n), ...(food.serving ? [] : ['g'])];
  const item = itemFor(food, qty, unit);
  const u = unitFor(food, unit);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {units.map(n => (
          <Pill key={n} on={u.n === n} onPress={() => onChange(n === 'g' ? Math.round(qty * u.g) || 100 : u.n === 'g' ? 1 : qty, n)}>{n}</Pill>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stepper value={qty} step={u.n === 'g' ? 10 : 0.5} onChange={v => onChange(v, u.n)} />
        <Txt face="mono" size={12} color={C.dim}>{food.serving ? amountLabel(item) : `${item.g} g`}</Txt>
      </View>
      <Macros i={item} />
    </View>
  );
}

/** Pick an amount of a food and log it. */
export function FoodSheet({ pick, onClose }: { pick: { food: Food; qty: number; unit?: string } | null; onClose: () => void }) {
  return (
    <Sheet open={!!pick} onClose={onClose}>
      {pick ? <FoodSheetBody key={pick.food.id} pick={pick} onDone={onClose} /> : null}
    </Sheet>
  );
}

export function FoodSheetBody({ pick, onDone, src = 'food', beforeLog }: { pick: { food: Food; qty: number; unit?: string }; onDone: () => void; src?: Meal['src']; beforeLog?: () => void }) {
  const s = useStore();
  const food = s.allFoods.find(f => f.id === pick.food.id) ?? pick.food;
  const [qty, setQty] = useState(pick.qty);
  const [unit, setUnit] = useState(unitFor(food, pick.unit).n);
  const fav = !!s.foods.find(f => f.id === food.id)?.fav;
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Label size={10} ls={0.14}>{food.brand ? `${food.brand.toUpperCase()} · ${SOURCE[food.src]}` : SOURCE[food.src]}</Label>
          <Txt size={22} w={500} ls={-0.02}>{food.name}</Txt>
        </View>
        <Tap onPress={() => s.toggleFav(food)} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: fav ? s.accent : 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={18} color={fav ? s.accent : C.dim}>{fav ? '★' : '☆'}</Txt>
        </Tap>
      </View>
      <Portion food={food} qty={qty} unit={unit} onChange={(q, u) => (setQty(q), setUnit(u))} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button onPress={onDone}>Cancel</Button>
        <Button
          primary
          onPress={() => {
            beforeLog?.();
            s.logItems([itemFor(food, qty, unit)], src);
            onDone();
          }}
        >
          Log it
        </Button>
      </View>
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { settings } = useStore();
  const [text, setText] = useState(String(Math.round(value)));
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Label size={10}>{label}</Label>
      <TextInput
        value={text}
        onChangeText={t => {
          setText(t);
          const v = parseFloat(t.replace(',', '.'));
          onChange(v >= 0 ? v : 0);
        }}
        keyboardType="decimal-pad"
        keyboardAppearance="dark"
        selectTextOnFocus
        style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, fontFamily: fontFamily(settings.font, 400), fontSize: 17, color: C.text }}
      />
    </View>
  );
}

/** Fix a logged meal: change amounts, correct REI's numbers, or keep it as your own food. */
export function MealSheet({ index, onClose }: { index: number | null; onClose: () => void }) {
  const s = useStore();
  const meal = index === null ? null : s.meals[index];
  return (
    <Sheet open={!!meal} onClose={onClose}>
      {meal && index !== null ? <MealSheetBody key={`${index}-${meal.time}-${meal.name}`} meal={meal} index={index} onDone={onClose} /> : null}
    </Sheet>
  );
}

function MealSheetBody({ meal, index, onDone }: { meal: Meal; index: number; onDone: () => void }) {
  const s = useStore();
  const [items, setItems] = useState<MealItem[]>(() => meal.items ?? []);
  // A meal without items (a photo, or older entries) is edited as one total.
  const [total, setTotal] = useState({ kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f });
  const [saved, setSaved] = useState(false);
  const next: Meal = items.length ? { ...mealFromItems(items, meal.time, meal.src, meal.name), name: meal.name } : { ...meal, ...total, kcal: Math.round(total.kcal), p: Math.round(total.p), c: Math.round(total.c), f: Math.round(total.f) };
  const foodOf = (i: MealItem) => (i.food ? s.allFoods.find(f => f.id === i.food) : undefined);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Label size={10} ls={0.14}>{`${meal.time} · ${meal.src === 'photo' ? 'FROM A PHOTO' : meal.src === 'ai' ? 'LOGGED BY REI' : meal.src === 'barcode' ? 'SCANNED' : 'LOGGED'}`}</Label>
        <Txt size={22} w={500} ls={-0.02}>{meal.name}</Txt>
      </View>

      {items.length ? (
        items.map((i, k) => {
          const food = foodOf(i);
          const set = (x: MealItem | null) => setItems(cur => (x ? cur.map((y, j) => (j === k ? x : y)) : cur.filter((_, j) => j !== k)));
          return (
            <View key={`${k}-${i.food}`} style={{ gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Txt size={16} w={500} style={{ flex: 1 }}>{i.name}</Txt>
                <Tap onPress={() => set(null)} style={{ paddingHorizontal: 6 }}>
                  <Txt size={12} color={C.faint}>REMOVE</Txt>
                </Tap>
              </View>
              {food ? (
                <Portion food={food} qty={i.qty} unit={i.unit} onChange={(q, u) => set(itemFor(food, q, u))} />
              ) : (
                // REI's estimate: correct the numbers directly.
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <NumField label="KCAL" value={i.kcal} onChange={v => set({ ...i, kcal: v })} />
                  <NumField label="P" value={i.p} onChange={v => set({ ...i, p: v })} />
                  <NumField label="C" value={i.c} onChange={v => set({ ...i, c: v })} />
                  <NumField label="F" value={i.f} onChange={v => set({ ...i, f: v })} />
                </View>
              )}
            </View>
          );
        })
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <NumField label="KCAL" value={total.kcal} onChange={v => setTotal(t => ({ ...t, kcal: v }))} />
          <NumField label="P" value={total.p} onChange={v => setTotal(t => ({ ...t, p: v }))} />
          <NumField label="C" value={total.c} onChange={v => setTotal(t => ({ ...t, c: v }))} />
          <NumField label="F" value={total.f} onChange={v => setTotal(t => ({ ...t, f: v }))} />
        </View>
      )}

      <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line, gap: 8 }}>
        <Label size={10}>TOTAL</Label>
        <Macros i={next} />
      </View>

      <Tap
        disabled={saved}
        onPress={() => {
          s.saveFood({ ...foodFromMeal(next, `m:${newId()}`), fav: true });
          setSaved(true);
        }}
        style={{ paddingVertical: 4 }}
      >
        <Txt size={14} color={saved ? s.accent : C.body}>{saved ? '★ Saved to your foods' : '☆ Save as my food, to log it in one tap'}</Txt>
      </Tap>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          danger
          onPress={() => {
            s.removeMeal(index);
            onDone();
          }}
        >
          Delete
        </Button>
        <Button
          primary
          disabled={!!meal.items?.length && !items.length}
          onPress={() => {
            s.updateMeal(index, next);
            onDone();
          }}
        >
          Save
        </Button>
      </View>
    </View>
  );
}
