import { useState } from 'react';
import { TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Core } from '../../components/Core';
import { Screen } from '../../components/Screen';
import { Card, Jp, Label, Tap, Txt } from '../../components/ui';
import { nutrition } from '../../lib/derive';
import { fuelLine } from '../../lib/rei';
import { C, fontFamily } from '../../lib/theme';
import { dayStamp } from '../../lib/time';
import { useStore } from '../../state/store';

const QUICK = ['200 g chicken + rice', 'Protein shake', '3 eggs on toast', 'Burger & fries'];
const RING = 2 * Math.PI * 32;

export default function Fuel() {
  const s = useStore();
  const { settings, profile, accent, meals } = s;
  const [draft, setDraft] = useState('');
  const nu = nutrition(meals, settings.scenario, s.sessionDone);
  const n = (k: keyof typeof profile) => parseFloat(profile[k]) || 0;
  const kcalT = n('kcal'), protT = n('protein');
  const kL = kcalT - nu.kcal, pL = protT - nu.protein;
  const MCOL = { p: accent, c: C.carbs, f: C.fat };
  const kDen = Math.max(kcalT, nu.kcal) || 1;
  const fuelTag = kL < 0 ? 'OVER' : pL > 0 && pL * 4 > kL * 0.6 ? 'TIGHT' : 'ON TRACK';
  const fuelTagColor = kL < 0 ? C.alert : fuelTag === 'TIGHT' ? C.warn : accent;
  const has = !!draft.trim() && !s.fuelBusy;
  const fmt = (v: number) => v.toLocaleString('en-US');

  const log = (t: string) => {
    if (!t.trim() || s.fuelBusy) return;
    setDraft('');
    s.logMeal(t);
  };

  const macros = ([['Protein', '蛋白', 'p', nu.protein, protT], ['Carbs', '炭水', 'c', nu.carbs, n('carbs')], ['Fat', '脂質', 'f', nu.fat, n('fat')]] as const).map(([label, jp, k, a, t]) => {
    const left = t - a;
    let status: string, statusColor: string, color: string = MCOL[k];
    if (k === 'p') {
      status = left > 0 ? `${left} G LEFT` : 'HIT';
      statusColor = left > 0 && a / t < 0.7 ? C.alert : accent;
    } else {
      status = left < 0 ? `${-left} G OVER` : `${left} G LEFT`;
      statusColor = left < 0 ? C.alert : C.muted;
      if (left < 0) color = C.alert;
    }
    return { label, jp, eaten: a, target: t, color, frac: Math.min(1, t ? a / t : 0), status, statusColor };
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <Label color={C.muted}>{settings.hud ? 'FUEL · 食' : 'FUEL'}</Label>
        <Label color={C.dim}>{`${dayStamp()} · ${meals.length} MEALS`}</Label>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 28 }}>
        <View>
          <Label>{kL < 0 ? 'KCAL OVER' : 'KCAL LEFT'}</Label>
          <Txt size={64} w={300} ls={-0.05} color={kL < 0 ? C.alert : C.text} style={{ marginTop: 6 }}>{fmt(Math.abs(kL))}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
          <Txt face="mono" size={15} color={C.value}>{fmt(nu.kcal)} <Txt face="mono" size={15} color={C.faint}>{`/ ${fmt(kcalT)}`}</Txt></Txt>
          <Label size={10} ls={0.14} style={{ marginTop: 4 }}>EATEN · TARGET</Label>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: C.line, marginTop: 16 }}>
        {[[nu.protein * 4, MCOL.p], [nu.carbs * 4, MCOL.c], [nu.fat * 9, MCOL.f]].map(([v, color], i) => (
          <View key={i} style={{ height: '100%', width: `${((v as number) / kDen) * 100}%`, backgroundColor: color as string }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {[['PROTEIN', nu.protein * 4, MCOL.p], ['CARBS', nu.carbs * 4, MCOL.c], ['FAT', nu.fat * 9, MCOL.f]].map(([t, v, color]) => (
          <View key={t as string} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color as string }} />
            <Label size={10} ls={0.12} color={C.muted}>{`${t} ${v}`}</Label>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        {macros.map(m => (
          <Card key={m.label} style={{ flex: 1, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 6, alignItems: 'center', gap: 10 }}>
            <View style={{ width: 76, height: 76 }}>
              <Svg width={76} height={76} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={38} cy={38} r={32} fill="none" stroke={C.line2} strokeWidth={4} />
                <Circle cx={38} cy={38} r={32} fill="none" stroke={m.color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(m.frac * RING).toFixed(1)} 999`} />
              </Svg>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={22} ls={-0.03}>{m.eaten}</Txt>
                <Txt face="mono" size={10} color={C.dim} style={{ marginTop: 3 }}>{`/ ${m.target}g`}</Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Txt size={14} w={500}>{m.label}</Txt>
              <Jp size={10}>{m.jp}</Jp>
            </View>
            <Label size={10} ls={0.12} color={m.statusColor}>{m.status}</Label>
          </Card>
        ))}
      </View>

      <View style={{ marginTop: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: kL < 0 ? 'rgba(255,90,60,0.4)' : C.line3, backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          <Core size={28} alert={kL < 0} speaking={s.fuelBusy} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Label size={10} ls={0.14} color={fuelTagColor}>{`REI · ${fuelTag}`}</Label>
          <Txt size={15} lh={1.45} color={C.textSoft}>{s.fuelBusy ? 'Reading the plate…' : s.fuelVerdict || fuelLine(profile, nu)}</Txt>
        </View>
      </View>

      <Label style={{ marginTop: 28 }}>LOG A MEAL</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 18 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => log(draft)}
            placeholder="Describe it. REI does the math"
            placeholderTextColor={C.dim}
            returnKeyType="done"
            keyboardAppearance="dark"
            style={{ fontFamily: fontFamily(settings.font, 400), fontSize: 16, color: C.text }}
          />
        </View>
        <Tap onPress={() => log(draft)} disabled={!has} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: has ? accent : 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={22} w={500} color={has ? C.ink : C.dim}>{s.fuelBusy ? '…' : '+'}</Txt>
        </Tap>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {QUICK.map(t => (
          <Tap key={t} onPress={() => log(t)} style={{ height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', backgroundColor: C.card2 }}>
            <Txt size={13} color={C.body}>{t}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
        <Label>LOGGED TODAY</Label>
        <Label ls={0.12} color={C.muted}>{`${fmt(nu.kcal)} KCAL`}</Label>
      </View>
      <View style={{ marginTop: 8 }}>
        {meals.length === 0 ? (
          <Txt size={14} color={C.dim} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }}>Nothing logged yet. REI is watching.</Txt>
        ) : null}
        {meals.map((m, i) => (
          <View key={`${m.time}-${i}`} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }}>
            <Txt face="mono" size={11} color={C.dim} style={{ width: 38, paddingTop: 4 }}>{m.time}</Txt>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <Txt size={16} w={500} ls={-0.01} style={{ flex: 1 }}>{m.name}</Txt>
                <Txt face="mono" size={13} color={C.value}>{`${fmt(m.kcal)} kcal`}</Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                <Txt face="mono" size={11} color={accent}>{`P ${m.p}`}</Txt>
                <Txt face="mono" size={11} color={C.carbs}>{`C ${m.c}`}</Txt>
                <Txt face="mono" size={11} color={C.fat}>{`F ${m.f}`}</Txt>
              </View>
            </View>
            <Tap onPress={() => s.removeMeal(i)} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={12} color={C.faint}>✕</Txt>
            </Tap>
          </View>
        ))}
      </View>
    </Screen>
  );
}
