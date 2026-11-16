// Bottom sheets for food: pick a portion of a food, or fix a logged meal.
import { amountLabel, findMeal, foodFromMeal, type Food, itemFor, type Meal, type MealItem, mealFromItems, unitFor, withTotals } from '@rei/shared';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newId } from '../lib/sync';
import { C, F, fontFamily, HIT, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';
import { Icon } from './icons';
import { BrushRule } from './ink';
import { Tap, Txt } from './ui';

const SOURCE: Record<Food['src'], string> = { ifct: 'IFCT 2017 · Indian food tables', dish: 'Typical portion', usda: 'USDA · via TempoLife (CC-BY)', barcode: 'Open Food Facts', mine: 'Your food' };

/** A bottom sheet: a sumi sheet under a quiet line, softly rounded at the top. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: 'rgba(10,9,8,0.78)' }} onPress={onClose} />
        <View style={{ maxHeight: '85%', backgroundColor: F.canvas, borderTopWidth: 1, borderTopColor: F.rule, borderTopLeftRadius: 12, borderTopRightRadius: 12, marginTop: -12, paddingTop: SP.md, paddingBottom: Math.max(insets.bottom, SP.lg) + SP.sm }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: F.rope, alignSelf: 'center', marginBottom: SP.lg }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xxl }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Pill({ on, children, onPress }: { on?: boolean; children: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: !!on, checked: !!on }} accessibilityLabel={children} style={{ minHeight: HIT, minWidth: HIT, paddingHorizontal: SP.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? F.chalk : F.rule, borderRadius: RADIUS.sm, backgroundColor: on ? F.chalk : F.arena }}>
      <Txt face="labelItalic" size={13} lh={1.35} color={on ? F.arena : F.chalk} numberOfLines={1}>{children}</Txt>
    </Tap>
  );
}

/**
 * A sheet or form button, 48pt: `primary` is the rice-paper button with ink text, `danger` and
 * plain are quiet outlines (the words carry what it does). It fills its row.
 */
export function Button({ children, onPress, primary, disabled }: { children: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const solid = !!primary && !disabled;
  const ink = disabled ? C.faint : primary ? F.arena : F.chalk;
  const fill = solid ? F.chalk : disabled && primary ? F.canvas2 : F.arena;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, paddingHorizontal: SP.lg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: solid ? F.chalk : primary ? F.canvas2 : disabled ? F.rope : F.rule, backgroundColor: fill, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
    >
      <Txt face="heading" size={16} lh={1.25} color={ink} fit>{children}</Txt>
    </Pressable>
  );
}

function Stepper({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  const textSize = useStore(s => s.settings.textSize);
  const [text, setText] = useState<string | null>(null);
  const fix = (v: number) => Math.max(step, Math.round(v / step) * step);
  const key = { width: HIT, height: HIT, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.arena, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
      <Tap onPress={() => onChange(fix(value - step))} accessibilityLabel="Less" style={key}>
        <View style={{ width: 12, height: 1.5, borderRadius: 1, backgroundColor: F.chalk }} />
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
        accessibilityLabel="Amount"
        style={{ width: 80, height: HIT, paddingVertical: 0, textAlign: 'center', fontFamily: fontFamily('num'), fontSize: 22 * textSize, color: C.text, borderBottomWidth: 1, borderBottomColor: F.rule }}
      />
      <Tap onPress={() => onChange(fix(value + step))} accessibilityLabel="More" style={key}>
        <Icon name="plus" size={18} color={F.chalk} tint={0} strokeWidth={1.7} />
      </Tap>
    </View>
  );
}

function Macros({ i }: { i: Pick<MealItem, 'kcal' | 'p' | 'c' | 'f'> }) {
  const accent = useStore(s => s.accent);
  return (
    <View accessible accessibilityLabel={`${Math.round(i.kcal)} kcal, protein ${Math.round(i.p)}, carbs ${Math.round(i.c)}, fat ${Math.round(i.f)} grams`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
      <Txt face="display" exact size={28} lh={1.2}>{Math.round(i.kcal).toLocaleString('en-US')}</Txt>
      <Txt face="mono" size={12} lh={1.35} color={F.smoke}>kcal</Txt>
      <View style={{ flex: 1 }} />
      <Txt face="num" raw size={14} lh={1.3} color={accent}>{`P ${Math.round(i.p)}`}</Txt>
      <Txt face="num" raw size={14} lh={1.3} color={F.smoke}>{`C ${Math.round(i.c)}`}</Txt>
      <Txt face="num" raw size={14} lh={1.3} color={F.smoke}>{`F ${Math.round(i.f)}`}</Txt>
    </View>
  );
}

/** Portion picker for one food; reports the resulting item. */
export function Portion({ food, qty, unit, onChange }: { food: Food; qty: number; unit: string; onChange: (qty: number, unit: string) => void }) {
  const units = [...food.units.map(u => u.n), ...(food.serving ? [] : ['g'])];
  const item = itemFor(food, qty, unit);
  const u = unitFor(food, unit);
  return (
    <View style={{ gap: SP.lg }}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
        {units.map(n => (
          <Pill key={n} on={u.n === n} onPress={() => onChange(n === 'g' ? Math.round(qty * u.g) || 100 : u.n === 'g' ? 1 : qty, n)}>{n}</Pill>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
        <Stepper value={qty} step={u.n === 'g' ? 10 : 0.5} onChange={v => onChange(v, u.n)} />
        <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{food.serving ? amountLabel(item) : `${item.g} g`}</Txt>
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
    <View style={{ gap: SP.xl }}>
      <View style={{ gap: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
          <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-start' }}>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{food.brand ? `${food.brand} · ${SOURCE[food.src]}` : SOURCE[food.src]}</Txt>
            <View accessibilityRole="header">
              <Txt face="display" exact size={22} lh={1.3}>{food.name}</Txt>
            </View>
          </View>
          <Tap onPress={() => s.toggleFav(food)} accessibilityRole="switch" accessibilityState={{ checked: fav }} accessibilityLabel="Favourite" style={{ width: HIT, height: HIT, borderWidth: 1, borderColor: fav ? s.accent : F.rule, borderRadius: RADIUS.sm, backgroundColor: F.arena, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star" size={20} color={fav ? s.accent : F.smoke} tint={fav ? 1 : 0} strokeWidth={1.7} />
          </Tap>
        </View>
        <BrushRule />
      </View>
      <Portion food={food} qty={qty} unit={unit} onChange={(q, u) => (setQty(q), setUnit(u))} />
      <View style={{ flexDirection: 'row', gap: SP.sm }}>
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
    <View style={{ flex: 1, gap: SP.xs }}>
      <Txt face="label" size={12} lh={1.35} color={F.smoke}>{label}</Txt>
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
        accessibilityLabel={label}
        style={{ height: 48, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.arena, paddingHorizontal: SP.md, paddingVertical: 0, fontFamily: fontFamily('num'), fontSize: 16 * settings.textSize, color: C.text }}
      />
    </View>
  );
}

/** Fix a logged meal: change amounts, correct REI's numbers, or keep it as your own food. */
export function MealSheet({ meal: opened, onClose }: { meal: Meal | null; onClose: () => void }) {
  const s = useStore();
  // Found by id (by content for older meals), never by position: the list can reorder while this is open.
  const at = opened ? findMeal(s.meals, opened) : -1;
  const meal = at >= 0 ? s.meals[at] : null;
  return (
    <Sheet open={!!meal} onClose={onClose}>
      {meal ? <MealSheetBody key={meal.id ?? `${meal.time}-${meal.name}-${meal.kcal}`} meal={meal} onDone={onClose} /> : null}
    </Sheet>
  );
}

function MealSheetBody({ meal, onDone }: { meal: Meal; onDone: () => void }) {
  const s = useStore();
  const [items, setItems] = useState<MealItem[]>(() => meal.items ?? []);
  // A meal without items (a photo, or older entries) is edited as one total; its fibre, sodium and so on follow the calories.
  const [total, setTotal] = useState({ kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f });
  const [saved, setSaved] = useState(false);
  const next: Meal = items.length ? { ...mealFromItems(items, meal.time, meal.src, meal.name), name: meal.name } : withTotals(meal, total);
  const foodOf = (i: MealItem) => (i.food ? s.allFoods.find(f => f.id === i.food) : undefined);

  return (
    <View style={{ gap: SP.lg }}>
      <View style={{ gap: SP.xs, alignItems: 'flex-start' }}>
        <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`${meal.time} · ${meal.src === 'photo' ? 'From a photo' : meal.src === 'ai' ? 'Logged by REI' : meal.src === 'barcode' ? 'Scanned' : 'Logged'}`}</Txt>
        <View accessibilityRole="header">
          <Txt face="display" exact size={22} lh={1.3}>{meal.name}</Txt>
        </View>
      </View>

      {items.length ? (
        items.map((i, k) => {
          const food = foodOf(i);
          const set = (x: MealItem | null) => setItems(cur => (x ? cur.map((y, j) => (j === k ? x : y)) : cur.filter((_, j) => j !== k)));
          return (
            <View key={`${k}-${i.food}`} style={{ gap: SP.md, paddingTop: SP.lg, borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.md }}>
                <Txt face="heading" size={17} lh={1.4} style={{ flex: 1 }}>{i.name}</Txt>
                <Tap onPress={() => set(null)} accessibilityLabel={`Remove ${i.name}`} hitSlop={8} style={{ minHeight: HIT, justifyContent: 'center' }}>
                  <Txt face="label" size={13} lh={1.35} color={F.smoke}>Remove</Txt>
                </Tap>
              </View>
              {food ? (
                <Portion food={food} qty={i.qty} unit={i.unit} onChange={(q, u) => set(itemFor(food, q, u))} />
              ) : (
                // REI's estimate: correct the numbers directly.
                <View style={{ flexDirection: 'row', gap: SP.sm }}>
                  <NumField label="kcal" value={i.kcal} onChange={v => set({ ...i, kcal: v })} />
                  <NumField label="Protein" value={i.p} onChange={v => set({ ...i, p: v })} />
                  <NumField label="Carbs" value={i.c} onChange={v => set({ ...i, c: v })} />
                  <NumField label="Fat" value={i.f} onChange={v => set({ ...i, f: v })} />
                </View>
              )}
            </View>
          );
        })
      ) : (
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          <NumField label="kcal" value={total.kcal} onChange={v => setTotal(t => ({ ...t, kcal: v }))} />
          <NumField label="Protein" value={total.p} onChange={v => setTotal(t => ({ ...t, p: v }))} />
          <NumField label="Carbs" value={total.c} onChange={v => setTotal(t => ({ ...t, c: v }))} />
          <NumField label="Fat" value={total.f} onChange={v => setTotal(t => ({ ...t, f: v }))} />
        </View>
      )}

      <View style={{ paddingTop: SP.lg, borderTopWidth: 1, borderTopColor: C.line, gap: SP.sm }}>
        <Txt face="label" size={12} lh={1.35} color={F.smoke}>Total</Txt>
        <Macros i={next} />
      </View>

      <Tap
        disabled={saved}
        onPress={() => {
          s.saveFood({ ...foodFromMeal(next, `m:${newId()}`), fav: true });
          setSaved(true);
        }}
        accessibilityLabel={saved ? 'Saved to your foods' : 'Save as my food, to log it in one tap'}
        style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: SP.sm }}
      >
        <Icon name="star" size={18} color={saved ? s.accent : F.smoke} tint={saved ? 1 : 0} strokeWidth={1.7} />
        <Txt size={15} w={500} lh={1.4} color={saved ? s.accent : C.body} style={{ flex: 1 }}>{saved ? 'Saved to your foods' : 'Save as my food, to log it in one tap'}</Txt>
      </Tap>

      <View style={{ flexDirection: 'row', gap: SP.sm }}>
        <Button
          danger
          onPress={() => {
            void s.removeMeal(meal);
            onDone();
          }}
        >
          Delete
        </Button>
        <Button
          primary
          disabled={!!meal.items?.length && !items.length}
          onPress={() => {
            void s.updateMeal(meal, next);
            onDone();
          }}
        >
          Save
        </Button>
      </View>
    </View>
  );
}
