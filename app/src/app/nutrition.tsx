// Today's nutrition: everything eaten today, nutrient by nutrient, against your targets, and
// which meal brought the most of each. Vitamins and minerals say how much of the day they're
// based on, because an estimated meal has calories and macros but no iron figure.
import { dailyTargets, dayIntake, ENERGY_WON_AT, formatNutrient, type IntakeKey, NUTRIENTS, type NutrientGroup, type NutrientKey } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Meter, MeterBar, RoundStamp, SectionHeader, useWarn } from '../components/fight';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C, F, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';

const GROUPS: { id: NutrientGroup; title: string; note: string }[] = [
  { id: 'limit', title: 'Watch', note: 'Stay under these' },
  { id: 'mineral', title: 'Minerals', note: 'ICMR-NIN 2020 values' },
  { id: 'vitamin', title: 'Vitamins', note: 'ICMR-NIN 2020 values' },
];

export default function Nutrition() {
  const s = useStore();
  const { accent, profile, meals } = s;
  const d = useMemo(() => dayIntake(meals), [meals]);
  const kcalT = parseFloat(profile.kcal) || 0;
  const targets = useMemo(() => dailyTargets({ kcal: kcalT, sex: s.sex }), [kcalT, s.sex]);
  const [open, setOpen] = useState<IntakeKey | null>(null);
  const warn = useWarn();
  // By the time eaten, whatever order they were logged in. `i` is the meal's place in `meals` (what `d.top` points at).
  const byTime = meals.map((m, i) => ({ m, i })).sort((a, b) => a.m.time.localeCompare(b.m.time) || a.i - b.i);
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

  const row = (k: NutrientKey, limit: boolean, first: boolean) => {
    const info = NUTRIENTS.find(n => n.key === k)!;
    const v = d.totals[k], t = targets[k], cov = d.coverage[k];
    const pct = t ? v / t : 0;
    // Only nutrients some of today's food reports get a row (the rest are gathered into one line); marked partial while most of the day doesn't.
    const partial = cov < 0.6;
    // Past a limit is the watch colour, never the seal red.
    const over = limit && pct > 1;
    const color = limit ? (pct > 0.85 ? warn : accent) : pct >= 1 ? accent : pct >= 0.6 ? C.body : warn;
    const on = open === k;
    const state = [over ? 'over the limit' : '', partial ? `partial, ${Math.round(cov * 100)} percent of today's food` : ''].filter(Boolean).join(', ');
    return (
      <Tap key={k} haptic={false} onPress={() => setOpen(on ? null : k)} accessibilityState={{ expanded: on }} accessibilityLabel={`${info.name}: ${formatNutrient(k, v)} of ${formatNutrient(k, t)}${state ? `, ${state}` : ''}`} style={{ minHeight: 56, paddingVertical: SP.md, gap: SP.sm, justifyContent: 'center', borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
          <Txt size={15} w={500} lh={1.4} style={{ flex: 1 }}>{info.name}</Txt>
          {partial ? <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`Partial · ${Math.round(cov * 100)}%`}</Txt> : null}
          <Txt face="num" raw size={14} lh={1.3} color={over ? warn : F.chalk}>{formatNutrient(k, v)}</Txt>
          <Txt face="mono" raw size={12} lh={1.35} color={over ? warn : F.smoke}>{`/ ${formatNutrient(k, t)}${over ? ' · over' : ''}`}</Txt>
        </View>
        <MeterBar pct={pct} accent={color} height={8} />
        {on ? (
          <Txt size={13} lh={1.5} color={F.smoke}>
            {`${leader(k, info.unit) ? `Most from ${leader(k, info.unit)}. ` : ''}${cov < 0.95 ? `Based on ${Math.round(cov * 100)}% of today’s food; estimated meals don’t carry this figure.` : 'Based on everything you ate today.'}`}
          </Txt>
        ) : null}
      </Tap>
    );
  };
  const anyTracked = NUTRIENTS.some(n => d.coverage[n.key] > 0);

  return (
    <Screen tabs={false}>
      <SubHeader title="Today's nutrition" onBack={() => router.back()} />

      <SectionHeader title="Eaten today" meta={s.sex === 'Female' ? 'Targets · women' : 'Targets · men'} style={{ marginTop: SP.xxl }} />
      <Meter value={d.totals.kcal} target={kcalT} unit="kcal" size="lg" past="flag" wonAt={ENERGY_WON_AT} label="Energy" style={{ marginTop: SP.md }} />
      <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} style={{ marginTop: SP.sm }}>{`${meals.length} meal${meals.length === 1 ? '' : 's'} logged`}</Txt>

      <SectionHeader title="Macros and fibre" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, gap: SP.sm }}>
        {macros.map(m => {
          const v = d.totals[m.k], pct = m.target ? v / m.target : 0, lead = leader(m.k, m.unit);
          const over = m.k !== 'p' && m.k !== 'fib' && pct > 1 ? pct - 1 : 0;
          return (
            <View key={m.k} style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.lg, gap: SP.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
                <Txt face="heading" size={17} lh={1.4} style={{ flex: 1 }}>{m.name}</Txt>
                <Txt face="num" raw size={20} lh={1.3}>{`${+v.toFixed(m.k === 'fib' ? 1 : 0)}`}</Txt>
                <Txt face="mono" raw size={12} lh={1.35} color={over ? warn : F.smoke}>{`/ ${m.target} g${over ? ' · over' : ''}`}</Txt>
              </View>
              <MeterBar pct={pct} over={over} overColor={warn} height={12} accessibilityLabel={`${m.name} ${Math.round(v)} of ${m.target} grams${over ? ', over' : ''}`} />
              {lead ? <Txt size={13} lh={1.4} color={F.smoke} numberOfLines={1}>{`Most from ${lead}`}</Txt> : null}
              {m.k === 'fib' && d.coverage.fib < 0.95 && d.totals.kcal > 0 ? <Txt size={13} lh={1.4} color={F.smoke}>{`Fibre known for ${Math.round(d.coverage.fib * 100)}% of today’s food.`}</Txt> : null}
            </View>
          );
        })}
      </View>

      {GROUPS.map(g => {
        const all = NUTRIENTS.filter(n => n.group === g.id);
        const tracked = all.filter(n => d.coverage[n.key] > 0), unknown = all.filter(n => !(d.coverage[n.key] > 0));
        const names = unknown.map(n => n.name).join(', ');
        return (
          <View key={g.id}>
            <SectionHeader title={g.title} meta={tracked.length ? `${tracked.length} of ${all.length} tracked · ${g.note}` : g.note} style={{ marginTop: SP.huge }} />
            <View style={{ marginTop: SP.md, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: SP.lg, paddingVertical: SP.xs }}>
              {tracked.map((n, i) => row(n.key, g.id === 'limit', i === 0))}
              {/* Everything today's food has no figure for, in one line instead of a row of dashes each. */}
              {unknown.length ? (
                <View accessible accessibilityLabel={`No data yet for ${names}. Log listed foods or scan a pack to see these.`} style={{ paddingVertical: SP.md, gap: SP.xs, borderTopWidth: tracked.length ? 1 : 0, borderTopColor: C.line }}>
                  <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`No data yet · ${unknown.length} of ${all.length}`}</Txt>
                  <Txt size={13} lh={1.5} color={F.smoke}>{`Log listed foods or scan a pack to see these: ${names}.`}</Txt>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      {anyTracked ? <Txt size={13} lh={1.4} color={F.smoke} style={{ marginTop: SP.md }}>Tap any line for where it came from.</Txt> : null}

      <SectionHeader title="By meal" meta={meals.length ? `${fmt(d.totals.kcal)} kcal` : undefined} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, gap: SP.sm }}>
        {!meals.length ? <Txt size={15} w={500} lh={1.5} color={F.smoke}>Nothing logged yet today.</Txt> : null}
        {byTime.map(({ m, i }) => {
          const wins = ([['p', 'Most protein'], ['fib', 'Most fibre'], ['c', 'Most carbs'], ['f', 'Most fat'], ['na', 'Most sodium']] as [IntakeKey, string][]).filter(([k]) => d.top[k] === i && meals.length > 1);
          const parts = ([['P', m.p, 'g'], ['C', m.c, 'g'], ['F', m.f, 'g'], ['Fibre', m.n?.fib, 'g'], ['Na', m.n?.na, 'mg']] as const)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v, u]) => `${k} ${k === 'Na' ? Math.round(v as number) : +(v as number).toFixed(1)} ${u}`);
          return (
            <View key={`${m.time}-${i}`} accessible accessibilityLabel={`${m.time}, ${m.name}, ${fmt(m.kcal)} kcal. ${parts.join(', ')}${wins.length ? `. ${wins.map(w => w[1]).join(', ')}` : ''}`} style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.lg, gap: SP.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
                <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} style={{ minWidth: 40 }}>{m.time}</Txt>
                <Txt size={15} w={500} lh={1.4} style={{ flex: 1 }} numberOfLines={2}>{m.name}</Txt>
                <Txt face="num" raw size={16} lh={1.3} color={accent}>{fmt(m.kcal)}</Txt>
              </View>
              <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{parts.join(' · ')}</Txt>
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
