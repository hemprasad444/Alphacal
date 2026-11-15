// Today's nutrition: everything eaten today, nutrient by nutrient, against your targets, and
// which meal brought the most of each. Vitamins and minerals say how much of the day they're
// based on, because an estimated meal has calories and macros but no iron figure.
import { dailyTargets, dayIntake, ENERGY_WON_AT, formatNutrient, type IntakeKey, NUTRIENTS, type NutrientGroup, type NutrientKey } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Meter, MeterBar, RoundStamp, SectionHeader } from '../components/fight';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C, F, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';

const GROUPS: { id: NutrientGroup; title: string; note: string }[] = [
  { id: 'limit', title: 'Watch', note: 'Stay under these' },
  { id: 'mineral', title: 'Minerals', note: 'ICMR-NIN 2020' },
  { id: 'vitamin', title: 'Vitamins', note: 'ICMR-NIN 2020' },
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

  const macros: { k: IntakeKey; name: string; unit: string; target: number }[] = [
    { k: 'p', name: 'Protein', unit: 'g', target: parseFloat(profile.protein) || 0 },
    { k: 'c', name: 'Carbs', unit: 'g', target: parseFloat(profile.carbs) || 0 },
    { k: 'f', name: 'Fat', unit: 'g', target: parseFloat(profile.fat) || 0 },
    { k: 'fib', name: 'Fibre', unit: 'g', target: targets.fib },
  ];

  const row = (k: NutrientKey, limit: boolean) => {
    const info = NUTRIENTS.find(n => n.key === k)!;
    const v = d.totals[k], t = targets[k], cov = d.coverage[k];
    const pct = t ? v / t : 0;
    // Shown as soon as any of today's food reports it; marked partial while most of the day doesn't.
    const known = cov > 0;
    const partial = known && cov < 0.6;
    const color = !known ? F.rope : limit ? (pct > 1 ? C.alert : pct > 0.85 ? C.warn : accent) : pct >= 1 ? accent : pct >= 0.6 ? C.body : C.warn;
    const on = open === k;
    const state = !known ? 'no figure yet' : partial ? `partial, ${Math.round(cov * 100)} percent of today's food` : '';
    return (
      <Tap key={k} haptic={false} onPress={() => setOpen(on ? null : k)} accessibilityState={{ expanded: on }} accessibilityLabel={`${info.name}: ${known ? formatNutrient(k, v) : 'unknown'} of ${formatNutrient(k, t)}${state ? `, ${state}` : ''}`} style={{ minHeight: HIT, paddingVertical: SP.sm, gap: 6, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
          <Txt size={15} w={500} style={{ flex: 1 }} color={known ? C.text : F.smoke}>{info.name}</Txt>
          {partial ? <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke}>{`PARTIAL · ${Math.round(cov * 100)}%`}</Txt> : null}
          <Txt face="label" w={600} size={15} ls={0.04} color={known ? F.chalk : F.smoke}>{known ? formatNutrient(k, v) : '—'}</Txt>
          <Txt face="label" size={14} ls={0.04} color={F.smoke}>{`/ ${formatNutrient(k, t)}`}</Txt>
        </View>
        <MeterBar pct={known ? pct : 0} accent={color} height={8} />
        {on ? (
          <Txt size={13} lh={1.4} color={F.smoke}>
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

      <SectionHeader title="Eaten today" meta={s.sex === 'Female' ? 'Targets · women' : 'Targets · men'} style={{ marginTop: SP.xl }} />
      <Meter value={d.totals.kcal} target={kcalT} unit="kcal" size="lg" past="flag" wonAt={ENERGY_WON_AT} label="Energy" style={{ marginTop: SP.md }} />
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ marginTop: SP.xs }}>{`${meals.length} MEAL${meals.length === 1 ? '' : 'S'} LANDED`}</Txt>

      <SectionHeader title="Macros & fibre" style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {macros.map(m => {
          const v = d.totals[m.k], pct = m.target ? v / m.target : 0, lead = leader(m.k, m.unit);
          const over = m.k !== 'p' && m.k !== 'fib' && pct > 1 ? pct - 1 : 0;
          return (
            <View key={m.k} style={{ backgroundColor: F.canvas, padding: SP.md, gap: SP.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
                <Txt face="label" w={600} size={13} ls={0.12} color={F.smoke} style={{ flex: 1 }}>{m.name.toUpperCase()}</Txt>
                <Txt face="display" size={24} lh={1.15}>{`${+v.toFixed(m.k === 'fib' ? 1 : 0)}`}</Txt>
                <Txt face="label" size={14} color={over ? F.chalk : F.smoke}>{`/ ${m.target} g${over ? ' · OVER' : ''}`}</Txt>
              </View>
              <MeterBar pct={pct} over={over} height={12} accessibilityLabel={`${m.name} ${Math.round(v)} of ${m.target} grams${over ? ', over' : ''}`} />
              {lead ? <Txt size={13} color={F.smoke} numberOfLines={1}>{`Most from ${lead}`}</Txt> : null}
              {m.k === 'fib' && d.coverage.fib < 0.95 && d.totals.kcal > 0 ? <Txt size={13} color={F.smoke}>{`Fibre known for ${Math.round(d.coverage.fib * 100)}% of today’s food.`}</Txt> : null}
            </View>
          );
        })}
      </View>

      {GROUPS.map(g => (
        <View key={g.id}>
          <SectionHeader title={g.title} meta={g.note} style={{ marginTop: SP.xxl }} />
          <View style={{ marginTop: SP.md, backgroundColor: F.canvas, paddingHorizontal: SP.md, paddingVertical: SP.xs }}>
            {NUTRIENTS.filter(n => n.group === g.id).map(n => row(n.key, g.id === 'limit'))}
          </View>
        </View>
      ))}
      <Txt size={13} color={F.smoke} style={{ marginTop: SP.sm }}>Tap any line for where it came from.</Txt>

      <SectionHeader title="By meal" meta={meals.length ? `${fmt(d.totals.kcal)} kcal` : undefined} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {!meals.length ? <Txt size={14} color={F.smoke}>Nothing logged yet today.</Txt> : null}
        {meals.map((m, i) => {
          const wins = ([['p', 'Most protein'], ['fib', 'Most fibre'], ['c', 'Most carbs'], ['f', 'Most fat'], ['na', 'Most sodium']] as [IntakeKey, string][]).filter(([k]) => d.top[k] === i && meals.length > 1);
          const parts = ([['P', m.p, 'g'], ['C', m.c, 'g'], ['F', m.f, 'g'], ['FIBRE', m.n?.fib, 'g'], ['NA', m.n?.na, 'mg']] as const)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v, u]) => `${k} ${k === 'NA' ? Math.round(v as number) : +(v as number).toFixed(1)}${u}`);
          return (
            <View key={`${m.time}-${i}`} accessible accessibilityLabel={`${m.time}, ${m.name}, ${fmt(m.kcal)} kcal. ${parts.join(', ')}${wins.length ? `. ${wins.map(w => w[1]).join(', ')}` : ''}`} style={{ backgroundColor: F.canvas, padding: SP.md, gap: SP.sm }}>
              {wins.length ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke} style={{ minWidth: 40 }}>{m.time}</Txt>
                <Txt size={15} w={500} lh={1.3} style={{ flex: 1 }} numberOfLines={2}>{m.name}</Txt>
                <Txt face="display" size={22} lh={1.15} color={accent}>{`+${fmt(m.kcal)}`}</Txt>
              </View>
              <Txt face="label" w={600} size={13} ls={0.08} color={F.smoke}>{parts.join(' · ')}</Txt>
              {wins.length ? (
                <View style={{ flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' }}>
                  {wins.map(([, label]) => <RoundStamp key={label} label={label} size="sm" tone={label === 'Most sodium' ? 'outline' : 'accent'} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
