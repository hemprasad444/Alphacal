import { router } from 'expo-router';
import { Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Screen, SubHeader } from '../components/Screen';
import { Icon } from '../components/icons';
import { Card, Label, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { ACCENT_EXTRAS, alpha, C, DEFAULT_EMBLEM, EMBLEMS, FONT_KEYS, fontFamily, THEMES, type Theme } from '../lib/theme';
import { useStore } from '../state/store';

const TEXT_SIZES: [number, string, number][] = [[0.82, 'SMALLEST', 11], [0.9, 'SMALL', 13], [1, 'DEFAULT', 15], [1.08, 'LARGE', 17]];

/** Diagonal two-tone swatch, like the design's 135° split gradient. */
function Swatch({ t, height, radius = 0 }: { t: Theme; height: number; radius?: number }) {
  return (
    <Svg width="100%" height={height} style={{ position: 'absolute', top: 0, left: 0, borderRadius: radius }}>
      <Defs>
        <LinearGradient id={`sw${t.id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.48" stopColor={t.acc} />
          <Stop offset="0.52" stopColor={t.acc2} />
        </LinearGradient>
        <LinearGradient id={`shade${t.id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#sw${t.id})`} />
      <Rect width="100%" height="100%" fill={`url(#shade${t.id})`} />
    </Svg>
  );
}

export default function Appearance() {
  const s = useStore();
  const { settings, theme, accent } = s;
  const emblems = EMBLEMS[theme.id] ?? [];
  const selected = theme.id in settings.bgByTheme ? settings.bgByTheme[theme.id] : DEFAULT_EMBLEM[theme.id] ?? null;
  const accents = [theme.acc, ...ACCENT_EXTRAS].filter((c, i, a) => a.indexOf(c) === i);

  return (
    <Screen tabs={false}>
      <SubHeader title="LOOK" onBack={() => router.back()} />

      <Label style={{ marginTop: 26 }}>TEXT SIZE</Label>
      <Card style={{ marginTop: 10, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt size={12} color={C.muted}>A</Txt>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line3 }}>
            {TEXT_SIZES.map(([v, , px]) => {
              const on = settings.textSize === v;
              return (
                <Tap key={v} onPress={() => s.setOpt('textSize', v)} style={{ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
                  <Txt size={px / settings.textSize} color={on ? C.text : C.label}>Aa</Txt>
                </Tap>
              );
            })}
          </View>
          <Txt size={18} color={C.muted}>A</Txt>
        </View>
      </Card>

      <Label style={{ marginTop: 30 }}>THEME</Label>
      <Card style={{ marginTop: 10, padding: 16 }}>
        <Txt size={16}>Theme</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {THEMES.map(t => {
            const on = theme.id === t.id;
            return (
              <Tap key={t.id} onPress={() => s.pickTheme(t.id)} style={{ width: '48.5%', flexGrow: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: on ? t.acc : C.line3, backgroundColor: on ? 'rgba(255,255,255,0.05)' : C.card2 }}>
                <View style={{ height: 64, alignItems: 'center', justifyContent: 'center' }}>
                  <Swatch t={t} height={64} />
                  <Icon name={t.icon} size={34} color="#fff" tint={0.35} strokeWidth={1.6} />
                </View>
                <View style={{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <Txt size={15} w={500} numberOfLines={1} style={{ flexShrink: 1 }}>{t.name}</Txt>
                    {on ? <Label size={10} ls={0} color={t.acc}>● ON</Label> : null}
                  </View>
                  <Txt size={12} color={C.label}>{t.vibe}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>

        <Txt size={16} style={{ marginTop: 22 }}>Accent override</Txt>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          {accents.map(c => {
            const on = accent.toLowerCase() === c.toLowerCase();
            return (
              <Tap key={c} onPress={() => s.setOpt('accent', c)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? c : 'transparent' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, shadowColor: c, shadowOpacity: on ? 0.55 : 0, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } }} />
              </Tap>
            );
          })}
        </View>

        <Txt size={16} style={{ marginTop: 22 }}>Typeface</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {FONT_KEYS.map(k => {
            const on = settings.font === k;
            return (
              <Tap key={k} onPress={() => s.setOpt('font', k)} style={{ width: '48.5%', flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, gap: 6, backgroundColor: on ? alpha(accent, 0.12) : C.card2, borderWidth: 1, borderColor: on ? alpha(accent, 0.5) : C.line3 }}>
                <Txt size={26} ls={-0.03} style={{ fontFamily: fontFamily(k, 400) }}>Aa 01</Txt>
                <Txt size={13} color={on ? C.text : C.muted} style={{ fontFamily: fontFamily(k, 400) }}>{k}</Txt>
              </Tap>
            );
          })}
        </View>
      </Card>

      <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
        <Row title="Japanese accents" sub="Kanji labels and side text" right={<Toggle on={settings.hud} onPress={() => s.setOpt('hud', !settings.hud)} />} />
        <Row title="HUD texture" sub="Background grid and scanlines" right={<Toggle on={settings.fx} onPress={() => s.setOpt('fx', !settings.fx)} />} last />
      </Card>

      <Label style={{ marginTop: 30 }}>REI BACKGROUND</Label>
      <Card style={{ marginTop: 10, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <Txt size={16}>{`${theme.name} collection`}</Txt>
          <Txt size={12} color={C.dim}>Tap to use</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Tap onPress={() => s.setEmblem(null)} style={{ flex: 1, gap: 6 }}>
            <View style={{ aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderColor: !selected ? accent : 'rgba(255,255,255,0.1)', backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={22} color={C.ghost} />
            </View>
            <Label size={10} ls={0.12} color={!selected ? accent : C.label} style={{ textAlign: 'center' }}>{!selected ? 'IN USE' : 'NONE'}</Label>
          </Tap>
          {emblems.length === 0 ? (
            <View style={{ flex: 2, aspectRatio: 2, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
              <Txt size={12} lh={1.4} color={C.dim} align="center">Emblems for this theme are coming soon.</Txt>
            </View>
          ) : null}
          {emblems.map((e, i) => {
            const on = selected === e.id;
            return (
              <Tap key={e.id} onPress={() => s.setEmblem(e.id)} style={{ flex: 1, gap: 6 }}>
                <View style={{ aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: '#111317', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: accent, shadowOpacity: on ? 0.35 : 0, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } }}>
                  <Image source={e.source} style={{ width: '78%', height: '78%' }} resizeMode="contain" />
                </View>
                <Label size={10} ls={0.12} color={on ? accent : C.label} style={{ textAlign: 'center' }}>{on ? 'IN USE' : `NO. ${String(i + 1).padStart(2, '0')}`}</Label>
              </Tap>
            );
          })}
          {emblems.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
        <View style={{ marginTop: 6 }}>
          <Row title="Emblem strength" sub="Watermark behind your screens" right={<Segmented value={settings.bgStrength} options={[['Subtle', 'Subtle'], ['Medium', 'Medium'], ['Bold', 'Bold']]} onChange={v => s.setOpt('bgStrength', v)} />} />
          <Row title="Emblem size" sub="Small, medium, large" right={<Segmented value={settings.emblemSize} options={[['S', 'S'], ['M', 'M'], ['L', 'L']]} onChange={v => s.setOpt('emblemSize', v)} />} />
          <Row title="Position" sub="Where it sits" right={<Segmented value={settings.emblemPos} options={[['Top', 'Top'], ['Center', 'Center'], ['Bottom', 'Bottom']]} onChange={v => s.setOpt('emblemPos', v)} />} last />
        </View>
      </Card>
    </Screen>
  );
}
