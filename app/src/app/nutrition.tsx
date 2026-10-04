// Today's nutrition: everything eaten today, nutrient by nutrient, against your targets, and
// which meal brought the most of each. Vitamins and minerals say how much of the day they're
// based on, because an estimated meal has calories and macros but no iron figure.
import { dailyTargets, dayIntake, formatNutrient, type IntakeKey, NUTRIENTS, type NutrientGroup, type NutrientKey } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from '../components/icons';
import { Gauge, Heading, Panel, Stamp } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

const GROUPS: { id: NutrientGroup; title: string; icon: IconKey; note: string }[] = [
  { id: 'limit', title: 'Watch', icon: 'kcal', note: 'Stay under these.' },
  { id: 'mineral', title: 'Minerals', icon: 'mineral', note: 'ICMR-NIN 2020' },
  { id: 'vitamin', title: 'Vitamins', icon: 'vitamin', note: 'ICMR-NIN 2020' },
];

export default function Nutrition() {
  const s = useStore();
  const { accent, profile, meals } = s;
  const d = useMemo(() => dayIntake(meals), [meals]);
  const kcalT = parseFloat(profile.kcal) || 0;
  const targets = useMemo(() => dailyTargets({ kcal: kcalT, sex: s.sex }), [kcalT, s.sex]);
  const [open, setOpen] = useState<IntakeKey | null>(null);
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

  /** "Chicken wrap · 46 g (62%)" for the meal that brought the most. */
  const leader = (k: IntakeKey, unit: string) => {
    const i = d.top[k];
    if (i < 0 || !d.totals[k]) return '';
    const m = meals[i];
    const v = k === 'kcal' || k === 'p' || k === 'c' || k === 'f' ? m[k] : m.n?.[k] ?? 0;
    return `${m.name} · ${+v.toFixed(1)} ${unit} (${Math.round((v / d.totals[k]) * 100)}%)`;
  };

  const macros: { k: IntakeKey; name: string; icon: IconKey; unit: string; target: number; color: string }[] = [
    { k: 'p', name: 'Protein', icon: 'protein', unit: 'g', target: parseFloat(profile.protein) || 0, color: accent },
    { k: 'c', name: 'Carbs', icon: 'carbs', unit: 'g', target: parseFloat(profile.carbs) || 0, color: C.carbs },
    { k: 'f', name: 'Fat', icon: 'fat', unit: 'g', target: parseFloat(profile.fat) || 0, color: C.fat },
    { k: 'fib', name: 'Fibre', icon: 'fiber', unit: 'g', target: targets.fib, color: '#7BD88F' },
  ];

  const row = (k: NutrientKey, limit: boolean) => {
    const info = NUTRIENTS.find(n => n.key === k)!;
    const v = d.totals[k], t = targets[k], cov = d.coverage[k];
    const pct = t ? v / t : 0;
    // Shown as soon as any of today's food reports it; marked partial while most of the day doesn't.
    const known = cov > 0;
    const partial = known && cov < 0.6;
    const color = !known ? C.ghost : limit ? (pct > 1 ? C.alert : pct > 0.85 ? C.warn : accent) : pct >= 1 ? accent : pct >= 0.6 ? C.body : C.warn;
    const on = open === k;
    return (
      <Tap key={k} haptic={false} onPress={() => setOpen(on ? null : k)} style={{ paddingVertical: 10, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt size={14} w={500} style={{ flex: 1 }} color={known ? C.text : C.dim}>{info.name}</Txt>
          {partial ? <Txt face="mono" size={8.5} ls={0.12} color={C.faint}>{`PARTIAL · ${Math.round(cov * 100)}%`}</Txt> : null}
          <Txt face="mono" size={12} color={known ? C.body : C.dim}>{known ? formatNutrient(k, v) : '—'}</Txt>
          <Txt face="mono" size={11} color={C.faint}>{`/ ${formatNutrient(k, t)}`}</Txt>
        </View>
        <Gauge pct={known ? pct : 0} acc={color} segments={24} height={4} />
        {on ? (
          <Txt size={12} color={C.muted}>
            {known
              ? `${leader(k, info.unit) ? `Most from ${leader(k, info.unit)}. ` : ''}${cov < 0.95 ? `Based on ${Math.round(cov * 100)}% of today’s food; estimated meals don’t carry this figure.` : 'Based on everything you ate today.'}`
              : 'Not enough of today’s food has this figure yet. Foods from the list (dal, rice, eggs, paneer…) and scanned packs do.'}
          </Txt>
        ) : null}
      </Tap>
    );
  };

  return (
    <Screen tabs={false}>
      <SubHeader title="TODAY'S NUTRITION" onBack={() => router.back()} />

      <Panel acc={accent} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Txt face="mono" size={10} ls={0.14} color={C.muted}>EATEN TODAY</Txt>
            <Txt size={44} w={300} ls={-0.04} lh={1.05}>{fmt(d.totals.kcal)}</Txt>
            <Txt face="mono" size={11} color={C.muted}>{`OF ${fmt(kcalT)} KCAL · ${meals.length} MEAL${meals.length === 1 ? '' : 'S'}`}</Txt>
          </View>
          <Stamp text={s.sex === 'Female' ? 'Targets · women' : 'Targets · men'} color={C.muted} tilt={0} size={8.5} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Gauge pct={kcalT ? d.totals.kcal / kcalT : 0} acc={d.totals.kcal > kcalT ? C.alert : accent} segments={24} />
        </View>
      </Panel>

      <Heading icon="protein" title="Macros & fibre" acc={accent} style={{ marginTop: 28 }} />
      <View style={{ marginTop: 12, gap: 10 }}>
        {macros.map(m => {
          const v = d.totals[m.k], pct = m.target ? v / m.target : 0, lead = leader(m.k, m.unit);
          return (
            <View key={m.k} style={{ padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name={m.icon} size={20} color={m.color} />
                <Txt size={15} w={600} style={{ flex: 1 }}>{m.name}</Txt>
                <Txt face="mono" size={13} color={C.text}>{`${+v.toFixed(m.k === 'fib' ? 1 : 0)} g`}</Txt>
                <Txt face="mono" size={11} color={C.faint}>{`/ ${m.target} g`}</Txt>
              </View>
              <Gauge pct={pct} acc={m.k !== 'p' && m.k !== 'fib' && pct > 1 ? C.alert : m.color} segments={24} height={5} />
              {lead ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="badge" size={13} color={C.warn} />
                  <Txt size={12} color={C.sub} numberOfLines={1} style={{ flex: 1 }}>{`Most from ${lead}`}</Txt>
                </View>
              ) : null}
              {m.k === 'fib' && d.coverage.fib < 0.95 && d.totals.kcal > 0 ? <Txt size={11} color={C.faint}>{`Fibre known for ${Math.round(d.coverage.fib * 100)}% of today’s food.`}</Txt> : null}
            </View>
          );
        })}
      </View>

      {GROUPS.map(g => (
        <View key={g.id}>
          <Heading icon={g.icon} title={g.title} acc={accent} right={g.note.toUpperCase().replace('.', '')} style={{ marginTop: 28 }} />
          <Panel acc={accent} tone={0.15} dots={false} style={{ marginTop: 12 }} pad={12}>
            {NUTRIENTS.filter(n => n.group === g.id).map(n => row(n.key, g.id === 'limit'))}
          </Panel>
        </View>
      ))}
      <Txt size={11} color={C.faint} style={{ marginTop: 8 }}>Tap any line for where it came from.</Txt>

      <Heading icon="fuel" title="By meal" acc={accent} style={{ marginTop: 28 }} />
      <View style={{ marginTop: 12, gap: 10 }}>
        {!meals.length ? <Txt size={14} color={C.dim}>Nothing logged yet today.</Txt> : null}
        {meals.map((m, i) => {
          const wins = ([['p', 'Most protein'], ['fib', 'Most fibre'], ['c', 'Most carbs'], ['f', 'Most fat'], ['na', 'Most sodium']] as [IntakeKey, string][]).filter(([k]) => d.top[k] === i && meals.length > 1);
          return (
            <View key={`${m.time}-${i}`} style={{ padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: wins.length ? C.line2 : C.line3, backgroundColor: '#0D0F13', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt face="mono" size={11} color={C.dim}>{m.time}</Txt>
                <Txt size={15} w={600} style={{ flex: 1 }} numberOfLines={2}>{m.name}</Txt>
                <Txt face="mono" size={12} color={C.value}>{`${fmt(m.kcal)} kcal`}</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {([['protein', m.p, accent, 'g'], ['carbs', m.c, C.carbs, 'g'], ['fat', m.f, C.fat, 'g'], ['fiber', m.n?.fib, '#7BD88F', 'g']] as const).map(([ic, v, col, u]) =>
                  typeof v === 'number' ? (
                    <View key={ic} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name={ic} size={13} color={col} />
                      <Txt face="mono" size={11} color={col}>{`${+v.toFixed(1)}${u}`}</Txt>
                    </View>
                  ) : null,
                )}
                {typeof m.n?.na === 'number' ? <Txt face="mono" size={11} color={C.muted}>{`Na ${Math.round(m.n.na)}mg`}</Txt> : null}
              </View>
              {wins.length ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {wins.map(([, label]) => <Stamp key={label} text={label} color={label === 'Most sodium' ? C.warn : accent} tilt={0} size={8.5} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
