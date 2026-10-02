// Progress: REI's weekly report, streaks, badges, body measurements and private photos.
import { badges as calcBadges, daySummary, isoDate, isoWeek, MEASURES, type Measure, measureChanges, parseIsoDate, type ProgressPhoto, streaks as calcStreaks, type WeeklyReport } from '@rei/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, ScrollView, TextInput, View } from 'react-native';
import { Button, Sheet } from '../components/FoodSheet';
import { LineChart } from '../components/LineChart';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Label, Segmented, Tap, Txt } from '../components/ui';
import { photoUrl } from '../lib/photos';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

const short = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Smaller is progress for these; bigger for the rest (muscle).
const SHRINK: Measure[] = ['waist', 'hips'];

export default function Progress() {
  const s = useStore();
  const [today] = useState(() => isoDate());
  const days = useMemo(() => [...s.pastDays, daySummary(today, { meals: s.meals, sessionDone: s.sessionDone })], [s.pastDays, s.meals, s.sessionDone, today]);
  const st = useMemo(() => calcStreaks(days, s.profile, today), [days, s.profile, today]);
  const bs = useMemo(() => calcBadges({ days, sessions: s.sessions, weighIns: s.weighIns, profile: s.profile }), [days, s.sessions, s.weighIns, s.profile]);
  const changes = useMemo(() => measureChanges(s.measurements), [s.measurements]);
  const [measuring, setMeasuring] = useState(false);
  const [open, setOpen] = useState<Measure | null>(null);
  const earned = bs.filter(b => b.earned).sort((a, b) => (a.earned! < b.earned! ? 1 : -1));
  const locked = bs.filter(b => !b.earned).sort((a, b) => b.progress - a.progress);

  return (
    <Screen tabs={false}>
      <SubHeader title="PROGRESS" onBack={() => router.back()} />

      <ReportCard />

      <Label style={{ marginTop: 28 }}>STREAKS</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {([['FOOD LOGGED', st.logging, 'days'], ['PROTEIN HIT', st.protein, 'days'], ['ON TARGET', st.weeks, 'weeks']] as const).map(([k, v, unit]) => (
          <Card key={k} style={{ flex: 1, padding: 14, gap: 6 }}>
            <Txt size={30} w={300} color={v.current ? s.accent : C.text}>{v.current}</Txt>
            <Label size={9} ls={0.12}>{k}</Label>
            <Txt face="mono" size={10} color={C.dim}>{`${unit.toUpperCase()} · BEST ${v.best}`}</Txt>
          </Card>
        ))}
      </View>

      <Label style={{ marginTop: 28 }}>{`BADGES · ${earned.length} / ${bs.length}`}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {[...earned, ...locked].map(b => (
          <View key={b.id} style={{ width: '31.5%', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: b.earned ? s.accent : C.line3, backgroundColor: b.earned ? 'rgba(255,255,255,0.05)' : 'transparent', gap: 6, opacity: b.earned ? 1 : 0.65 }}>
            <Txt size={13} w={500} color={b.earned ? C.text : C.body}>{b.title}</Txt>
            <Txt size={11} lh={1.3} color={C.dim}>{b.desc}</Txt>
            {b.earned ? (
              <Txt face="mono" size={9} color={s.accent}>{short(b.earned).toUpperCase()}</Txt>
            ) : (
              <View style={{ height: 2, backgroundColor: C.line, borderRadius: 1 }}>
                <View style={{ height: 2, width: `${Math.round(b.progress * 100)}%`, backgroundColor: C.muted, borderRadius: 1 }} />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <Label>BODY · CM</Label>
        <Tap onPress={() => setMeasuring(true)}>
          <Label color={s.accent}>+ LOG</Label>
        </Tap>
      </View>
      <View style={{ marginTop: 8 }}>
        {!changes.length ? <Txt size={14} color={C.dim} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }}>No measurements yet. Waist is the one that matters most.</Txt> : null}
        {changes.map(c => {
          const good = c.change === 0 ? null : SHRINK.includes(c.measure) ? c.change < 0 : c.change > 0;
          return (
            <Tap key={c.measure} haptic={false} onPress={() => setOpen(o => (o === c.measure ? null : c.measure))} style={{ paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                <Txt size={15} style={{ flex: 1 }}>{cap(c.measure)}</Txt>
                <Txt face="mono" size={15}>{`${c.latest}`}</Txt>
                <Txt face="mono" size={12} color={good == null ? C.dim : good ? s.accent : C.alert} style={{ minWidth: 60, textAlign: 'right' }}>{c.change ? `${c.change > 0 ? '+' : ''}${c.change}` : '—'}</Txt>
              </View>
              {open === c.measure && c.points.length > 1 ? <LineChart values={c.points.map(p => p.v)} labels={c.points.map(p => short(p.date))} color={s.accent} height={110} unit=" cm" /> : null}
            </Tap>
          );
        })}
      </View>

      <Photos />

      <MeasureSheet open={measuring} onClose={() => setMeasuring(false)} />
    </Screen>
  );
}

function ReportCard() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<WeeklyReport | null>(null);
  const week = isoWeek();
  const report = fresh ?? s.reports.find(r => r.week === week) ?? s.reports[0] ?? null;
  const write = async () => {
    setBusy(true);
    try {
      setFresh(await s.writeReport());
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginTop: 22, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Label>{report ? `WEEKLY REPORT · ${report.week.split('-')[1]}` : 'WEEKLY REPORT'}</Label>
        {report ? <Label color={C.dim}>{report.ai ? 'BY REI' : 'FROM YOUR NUMBERS'}</Label> : null}
      </View>
      {report ? (
        <>
          <Txt size={21} w={500} ls={-0.02} lh={1.25}>{report.headline}</Txt>
          <Txt size={14} lh={1.5} color={C.body}>{report.summary}</Txt>
          {report.wins.map((w, i) => (
            <Txt key={i} size={14} lh={1.4} color={C.textSoft}>{`✓  ${w}`}</Txt>
          ))}
          <Txt size={14} lh={1.4} color={C.warn}>{`!  ${report.fix}`}</Txt>
          <Txt size={14} lh={1.4} color={s.accent}>{`→  ${report.focus}`}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[
              `${report.stats.sessions.done}/${report.stats.sessions.planned} SESSIONS`,
              report.stats.food.avgProtein != null ? `${report.stats.food.avgProtein} G PROTEIN AVG` : null,
              report.stats.weight.change != null ? `${report.stats.weight.change > 0 ? '+' : ''}${report.stats.weight.change} KG` : null,
              report.stats.prs.length ? `${report.stats.prs.length} PR` : null,
            ].filter(Boolean).map(t => (
              <View key={t} style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: C.line3 }}>
                <Txt face="mono" size={10} color={C.muted}>{t}</Txt>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Txt size={14} lh={1.45} color={C.body}>REI writes your week up every Sunday evening, before planning the next one.</Txt>
      )}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Button onPress={write} disabled={busy}>{busy ? 'REI is reading your week…' : report?.week === week ? 'Rewrite this week’s report' : 'Write this week so far'}</Button>
      </View>
    </Card>
  );
}

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const last = useMemo(() => [...s.measurements].sort((a, b) => (a.date < b.date ? 1 : -1))[0], [s.measurements]);
  const [v, setV] = useState<Partial<Record<Measure, string>>>({});
  const entries = MEASURES.map(k => [k, parseFloat((v[k] ?? '').replace(',', '.'))] as const).filter(([, n]) => n > 0 && n < 300);
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Txt size={22} w={500}>Measurements</Txt>
        <Txt size={13} color={C.dim}>Centimetres, relaxed, same time of day. Leave blank what you don’t measure.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {MEASURES.map(k => (
            <View key={k} style={{ width: '31%', gap: 6 }}>
              <Label size={10}>{k.toUpperCase()}</Label>
              <TextInput
                value={v[k] ?? ''}
                onChangeText={t => setV(cur => ({ ...cur, [k]: t }))}
                placeholder={last?.[k] ? String(last[k]) : '—'}
                placeholderTextColor={C.faint}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, fontFamily: fontFamily(s.settings.font, 400), fontSize: 17, color: C.text }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            primary
            disabled={!entries.length}
            onPress={() => {
              s.saveMeasurement({ date: isoDate(), ...Object.fromEntries(entries) });
              setV({});
              onClose();
            }}
          >
            Save
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

function PhotoImage({ p, height }: { p: ProgressPhoto; height: number }) {
  const [uri, setUri] = useState<string | null>(p.path.startsWith('users/') ? null : p.path);
  useEffect(() => {
    let live = true;
    photoUrl(p.path).then(u => live && setUri(u), () => {});
    return () => {
      live = false;
    };
  }, [p.path]);
  return <Image source={uri ? { uri } : undefined} style={{ width: '100%', height, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="cover" />;
}

function Photos() {
  const s = useStore();
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [busy, setBusy] = useState(false);
  const mine = useMemo(() => s.photos.filter(p => p.pose === pose).sort((a, b) => a.createdAt - b.createdAt), [s.photos, pose]);
  const first = mine[0], latest = mine.length > 1 ? mine[mine.length - 1] : null;

  const add = async (library: boolean) => {
    const useLibrary = library || Platform.OS === 'web';
    if (!useLibrary) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Camera is off', 'Allow camera access in Settings to take progress photos.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = useLibrary ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      const img = await ImageManipulator.manipulate(asset.uri).resize({ width: 1080 }).renderAsync();
      const out = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
      if (out.base64) await s.addPhoto(out.base64, out.uri, pose);
    } catch (e) {
      console.warn('REI: progress photo failed', e);
      Alert.alert('Photo not saved', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: ProgressPhoto) => {
    const go = () => s.removePhoto(p);
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this photo?', 'It’s removed from your account for good.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <Label>PHOTOS · PRIVATE</Label>
        <Segmented value={pose} options={[['front', 'Front'], ['side', 'Side'], ['back', 'Back']]} onChange={setPose} />
      </View>
      {first ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[first, latest].map((p, i) =>
            p ? (
              <View key={p.id} style={{ flex: 1, gap: 6 }}>
                <PhotoImage p={p} height={220} />
                <Txt face="mono" size={10} color={i ? s.accent : C.dim}>{`${i ? 'NOW' : 'FIRST'} · ${short(p.date).toUpperCase()}${p.kg ? ` · ${p.kg} KG` : ''}`}</Txt>
              </View>
            ) : (
              <View key="none" style={{ flex: 1, height: 220, borderRadius: 14, borderWidth: 1, borderColor: C.line3, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <Txt size={13} color={C.dim} align="center">Take the next one in a few weeks, same spot, same light.</Txt>
              </View>
            ),
          )}
        </View>
      ) : (
        <Txt size={14} color={C.dim} lh={1.45} style={{ marginTop: 10 }}>Photos show what the scale can’t. Only you can see them.</Txt>
      )}
      {mine.length > 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {mine.map(p => (
            <Tap key={p.id} onLongPress={() => remove(p)} style={{ width: 72, gap: 4 }}>
              <PhotoImage p={p} height={96} />
              <Txt face="mono" size={9} color={C.dim}>{short(p.date)}</Txt>
            </Tap>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button primary disabled={busy} onPress={() => add(false)}>{busy ? 'Saving…' : 'Take photo'}</Button>
        <Button disabled={busy} onPress={() => add(true)}>From library</Button>
      </View>
      {mine.length ? <Txt size={11} color={C.faint} style={{ marginTop: 8 }}>{mine.length > 2 ? 'Hold a photo to delete it.' : ''}</Txt> : null}
      {mine.length && mine.length <= 2 ? (
        <Tap onLongPress={() => remove(mine[mine.length - 1])}>
          <Txt size={11} color={C.faint}>Hold here to delete the latest photo.</Txt>
        </Tap>
      ) : null}
    </>
  );
}
