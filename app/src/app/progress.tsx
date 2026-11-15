// Progress: REI's weekly report, streaks as combos, badges as special moves, body measurements and private photos.
import { daySummary, isoDate, isoWeek, MEASURES, type Measure, measureChanges, parseIsoDate, type ProgressPhoto, streaks as calcStreaks, type WeeklyReport } from '@rei/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, ScrollView, View } from 'react-native';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { CutShape } from '../components/cut';
import { BadgeGrid, Field, QuietButton } from '../components/dojo';
import { Combo, CutButton, RoundStamp, SectionHeader, useWarn } from '../components/fight';
import { Sheet } from '../components/FoodSheet';
import { LineChart } from '../components/LineChart';
import { Screen, SubHeader } from '../components/Screen';
import { Segmented, Tap, Txt } from '../components/ui';
import { photoUrl } from '../lib/photos';
import { C, F, HIT, RADIUS, SP } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

const short = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Smaller is progress for these; bigger for the rest (muscle).
const SHRINK: Measure[] = ['waist', 'hips'];

export default function Progress() {
  const s = useStore();
  // The store's day, which rolls over at midnight with today's meals: a screen left open stays current.
  const today = s.day;
  const days = useMemo(() => [...s.pastDays, daySummary(today, { meals: s.meals, sessionDone: s.sessionDone })], [s.pastDays, s.meals, s.sessionDone, today]);
  const st = useMemo(() => calcStreaks(days, s.profile, today), [days, s.profile, today]);
  // The same badges as the Dojo and the Badges page, so the counts agree.
  const g = useGame();
  const changes = useMemo(() => measureChanges(s.measurements), [s.measurements]);
  const [measuring, setMeasuring] = useState(false);
  const [open, setOpen] = useState<Measure | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const { earned, locked } = g;
  // The latest few you've landed, then the three you're closest to. The Badges page has them all.
  const landed = [...earned].sort((a, b) => (a.earned! < b.earned! ? 1 : -1)).slice(0, 5);
  const closest = [...locked].sort((a, b) => b.progress - a.progress).slice(0, 3);
  const allMoves = earned.length + locked.length;

  return (
    <Screen tabs={false}>
      <SubHeader title="Progress" onBack={() => router.back()} />

      <ReportCard />

      <SectionHeader title="Combos" meta="Streaks" style={{ marginTop: SP.xxl }} />
      <View style={{ flexDirection: 'row', backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, marginTop: SP.md }}>
        {([['Food', 'logged', st.logging, 'days'], ['Protein', 'hit', st.protein, 'days'], ['Weeks', 'on target', st.weeks, 'wks']] as const).map(([top, bottom, v, unit], i) => (
          <View key={top} style={{ flex: 1, paddingVertical: SP.md, paddingHorizontal: SP.sm, gap: SP.xs, borderLeftWidth: i ? 2 : 0, borderLeftColor: F.arena }}>
            <Combo count={v.current} top={top} bottom={bottom} size="sm" />
            <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke} numberOfLines={1}>{`${unit.toUpperCase()} · BEST ${v.best}`}</Txt>
          </View>
        ))}
      </View>

      <SectionHeader title="Special moves" meta={`${earned.length} of ${allMoves} unlocked`} onMeta={() => router.push('/badges')} style={{ marginTop: SP.xxl }} />
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ marginTop: SP.md }}>{earned.length ? `${earned.length > landed.length ? 'LATEST ' : ''}LANDED · NEXT ${closest.length} CLOSEST` : `YOUR ${closest.length} CLOSEST`}</Txt>
      <BadgeGrid badges={[...landed, ...closest]} open={badge} onOpen={setBadge} style={{ marginTop: SP.md }} />
      <QuietButton label={`All ${allMoves} special moves`} accessibilityLabel={`See all ${allMoves} special moves`} onPress={() => router.push('/badges')} style={{ marginTop: SP.lg }} />

      <SectionHeader title="Body · cm" meta="+ Log" onMeta={() => setMeasuring(true)} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {!changes.length ? <Txt size={14} w={500} lh={1.4} color={F.smoke}>No measurements yet. Waist is the one that matters most.</Txt> : null}
        {changes.map(c => {
          const good = c.change === 0 ? null : SHRINK.includes(c.measure) ? c.change < 0 : c.change > 0;
          const delta = c.change ? `${c.change > 0 ? '+' : ''}${c.change}` : '—';
          const expanded = open === c.measure;
          return (
            <Tap key={c.measure} haptic={false} onPress={() => setOpen(o => (o === c.measure ? null : c.measure))} accessibilityState={{ expanded }} accessibilityLabel={`${cap(c.measure)} ${c.latest} centimetres${c.change ? `, change ${delta}` : ''}`} style={{ backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: SP.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT - SP.sm * 2 }}>
                <Txt size={15} w={600} style={{ flex: 1 }}>{cap(c.measure)}</Txt>
                <Txt face="label" w={600} size={14} ls={0.07} color={good == null ? F.smoke : good ? s.accent : C.alertSoft} align="right" style={{ minWidth: 48 }}>{delta}</Txt>
                <Txt face="display" size={22} lh={1.15} align="right" style={{ minWidth: 56 }}>{`${c.latest}`}</Txt>
              </View>
              {expanded && c.points.length > 1 ? <LineChart values={c.points.map(p => p.v)} labels={c.points.map(p => short(p.date))} color={s.accent} height={110} unit=" cm" /> : null}
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
  const warn = useWarn();
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
  const line = (tag: string, text: string, color: string, key?: number) => (
    <View key={key} style={{ flexDirection: 'row', gap: SP.sm }}>
      <View style={{ width: 44, paddingTop: 3 }}>
        <Txt face="label" w={600} size={12} ls={0.12} color={color}>{tag}</Txt>
      </View>
      <Txt size={14} w={500} lh={1.4} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
  return (
    <View style={{ marginTop: SP.lg, gap: SP.md }}>
      <SectionHeader title={report ? `Weekly report · ${report.week.split('-')[1]}` : 'Weekly report'} meta={report ? (report.ai ? 'By REI' : 'From your numbers') : undefined} />
      <View style={{ backgroundColor: F.canvas, borderWidth: 3, borderColor: F.chalk, boxShadow: `4px 4px 0px ${report ? s.accent : F.rope}`, padding: SP.lg, gap: SP.md }}>
        {report ? (
          <>
            <View style={{ alignItems: 'flex-start' }}>
              <Txt face="display" size={26} lh={1.2}>{report.headline.toUpperCase()}</Txt>
            </View>
            <Txt size={14} w={500} lh={1.5} color={C.body}>{report.summary}</Txt>
            <View style={{ gap: SP.sm }}>
              {report.wins.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: SP.sm }}>
                  <View accessible accessibilityLabel="Win" style={{ width: 44, paddingTop: 5 }}>
                    <CutShape width={14} height={10} fill={s.accent} />
                  </View>
                  <Txt size={14} w={500} lh={1.4} style={{ flex: 1 }}>{w}</Txt>
                </View>
              ))}
              {line('FIX', report.fix, warn)}
              {line('NEXT', report.focus, s.accent)}
            </View>
            <View style={{ flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' }}>
              {[
                `${report.stats.sessions.done}/${report.stats.sessions.planned} SESSIONS`,
                report.stats.food.avgProtein != null ? `${report.stats.food.avgProtein} G PROTEIN AVG` : null,
                report.stats.weight.change != null ? `${report.stats.weight.change > 0 ? '+' : ''}${report.stats.weight.change} KG` : null,
                report.stats.prs.length ? `${report.stats.prs.length} PR` : null,
              ].filter((t): t is string => !!t).map(t => <RoundStamp key={t} label={t} tone="outline" size="sm" />)}
            </View>
          </>
        ) : (
          <Txt size={14} w={500} lh={1.45} color={C.body}>REI writes your week up every Sunday evening, before planning the next one.</Txt>
        )}
        <QuietButton lit={!busy} icon="rei" disabled={busy} onPress={write} label={busy ? 'REI is reading your week…' : report?.week === week ? 'Rewrite this week’s report' : 'Write this week so far'} />
      </View>
    </View>
  );
}

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const last = useMemo(() => [...s.measurements].sort((a, b) => (a.date < b.date ? 1 : -1))[0], [s.measurements]);
  const [v, setV] = useState<Partial<Record<Measure, string>>>({});
  const entries = MEASURES.map(k => [k, parseFloat((v[k] ?? '').replace(',', '.'))] as const).filter(([, n]) => n > 0 && n < 300);
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: SP.md }}>
        <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
          <Txt face="display" size={26} lh={1.2}>MEASUREMENTS</Txt>
        </View>
        <Txt size={14} w={500} lh={1.4} color={F.smoke}>Centimetres, relaxed, same time of day. Leave blank what you don’t measure.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md }}>
          {MEASURES.map(k => (
            <Field key={k} label={k} value={v[k] ?? ''} onChangeText={t => setV(cur => ({ ...cur, [k]: t }))} placeholder={last?.[k] ? String(last[k]) : '—'} accessibilityLabel={`${cap(k)} in centimetres`} keyboardType="decimal-pad" style={{ width: '30%', flexGrow: 1 }} />
          ))}
        </View>
        <View style={{ gap: SP.sm, marginTop: SP.xs }}>
          <CutButton
            size="md"
            label="Save"
            disabled={!entries.length}
            onPress={() => {
              s.saveMeasurement({ date: isoDate(), ...Object.fromEntries(entries) });
              setV({});
              onClose();
            }}
          />
          <QuietButton label="Cancel" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}

function PhotoImage({ p, height, label }: { p: ProgressPhoto; height: number; label: string }) {
  const [uri, setUri] = useState<string | null>(p.path.startsWith('users/') ? null : p.path);
  useEffect(() => {
    let live = true;
    photoUrl(p.path).then(u => live && setUri(u), () => {});
    return () => {
      live = false;
    };
  }, [p.path]);
  // Cached on disk by Storage path, so the signed URL changing doesn't refetch the image.
  return <Image source={uri ? { uri, cacheKey: p.path } : undefined} accessibilityLabel={label} cachePolicy="memory-disk" transition={120} contentFit="cover" style={{ width: '100%', height, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: F.smoke, backgroundColor: F.canvas }} />;
}

function Photos() {
  const s = useStore();
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [deleting, setDeleting] = useState<ProgressPhoto | null>(null);
  const mine = useMemo(() => s.photos.filter(p => p.pose === pose).sort((a, b) => a.createdAt - b.createdAt), [s.photos, pose]);
  const first = mine[0], latest = mine.length > 1 ? mine[mine.length - 1] : null;
  const say = (p: ProgressPhoto) => `${cap(p.pose)} photo, ${short(p.date)}${p.kg ? `, ${p.kg} kilograms` : ''}`;

  const add = async (library: boolean) => {
    const useLibrary = library || Platform.OS === 'web';
    if (!useLibrary) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setNotice({ title: 'Camera is off', message: 'Allow camera access in Settings to take progress photos.' });
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
      setNotice({ title: 'Photo not saved', message: 'Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="Photos · private" style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, alignItems: 'flex-start' }}>
        <Segmented value={pose} options={[['front', 'Front'], ['side', 'Side'], ['back', 'Back']]} onChange={setPose} />
      </View>
      {first ? (
        <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
          {[first, latest].map((p, i) =>
            p ? (
              <View key={p.id} style={{ flex: 1, gap: SP.xs }}>
                <PhotoImage p={p} height={220} label={say(p)} />
                <Txt face="label" w={600} size={12} ls={0.1} color={i ? s.accent : F.smoke}>{`${i ? 'NOW' : 'FIRST'} · ${short(p.date).toUpperCase()}${p.kg ? ` · ${p.kg} KG` : ''}`}</Txt>
              </View>
            ) : (
              <View key="none" style={{ flex: 1, height: 220, borderWidth: 2, borderColor: F.smoke, backgroundColor: F.canvas, alignItems: 'center', justifyContent: 'center', padding: SP.lg }}>
                <Txt size={14} w={500} lh={1.4} color={F.smoke} align="center">Take the next one in a few weeks, same spot, same light.</Txt>
              </View>
            ),
          )}
        </View>
      ) : (
        <Txt size={14} w={500} lh={1.45} color={F.smoke} style={{ marginTop: SP.md }}>Photos show what the scale can’t. Only you can see them.</Txt>
      )}
      {mine.length > 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SP.md }} contentContainerStyle={{ gap: SP.sm }}>
          {mine.map(p => (
            <Tap key={p.id} onLongPress={() => setDeleting(p)} accessibilityLabel={say(p)} accessibilityHint="Hold to delete" style={{ width: 72, gap: SP.xs }}>
              <PhotoImage p={p} height={96} label={say(p)} />
              <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke}>{short(p.date).toUpperCase()}</Txt>
            </Tap>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ gap: SP.sm, marginTop: SP.lg }}>
        <CutButton size="md" icon="camera" label={busy ? 'Saving…' : 'Take photo'} disabled={busy} onPress={() => add(false)} />
        <QuietButton label="From library" disabled={busy} onPress={() => add(true)} />
      </View>
      {mine.length > 2 ? <Txt size={13} w={500} color={F.smoke} style={{ marginTop: SP.sm }}>Hold a photo to delete it.</Txt> : null}
      {mine.length && mine.length <= 2 ? (
        <Tap onLongPress={() => setDeleting(mine[mine.length - 1])} accessibilityLabel="Delete the latest photo" accessibilityHint="Hold to delete" style={{ minHeight: HIT, justifyContent: 'center', marginTop: SP.xs }}>
          <Txt size={13} w={500} color={F.smoke}>Hold here to delete the latest photo.</Txt>
        </Tap>
      ) : null}

      <ConfirmSheet
        open={!!deleting}
        title="Delete this photo?"
        message="It’s removed from your account for good."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && s.removePhoto(deleting)}
        onClose={() => setDeleting(null)}
      />
      <ConfirmSheet open={!!notice} title={notice?.title ?? ''} message={notice?.message} cancelLabel={null} onClose={() => setNotice(null)} />
    </>
  );
}
