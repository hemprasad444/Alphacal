// Look: text size, your world (it sets your corner colour; the far corner never changes), an
// accent override, the arena lights and the emblem behind your screens.
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { CutShape } from '../components/cut';
import { RoundStamp, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { ACCENT_EXTRAS, C, emblemIdFor, EMBLEMS, hard, HIT, onColor, SHADOW, SP, THEMES } from '../lib/theme';
import { useStore } from '../state/store';

const TEXT_SIZES: [number, string, number][] = [[0.82, 'Smallest', 12], [0.9, 'Small', 14], [1, 'Default', 16], [1.08, 'Large', 18]];

export default function Appearance() {
  const s = useStore();
  const { settings, theme, accent } = s;
  const emblems = EMBLEMS[theme.id] ?? [];
  const selected = emblemIdFor(theme.id, settings.bgByTheme);
  const accents = [theme.acc, ...ACCENT_EXTRAS].filter((c, i, a) => a.indexOf(c) === i);

  return (
    <Screen tabs={false}>
      <SubHeader title="LOOK" onBack={() => router.back()} />

      <SectionHeader title="World" meta="Sets your corner colour" style={{ marginTop: SP.xl }} />
      <View accessibilityRole="radiogroup" style={{ marginTop: SP.md, gap: SP.sm, paddingRight: 4 }}>
        {THEMES.map(t => {
          const on = theme.id === t.id;
          return (
            <Tap key={t.id} onPress={() => s.pickTheme(t.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${t.name} world. ${t.vibe}`}>
              <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas, borderWidth: on ? 3 : 2, borderColor: on ? C.chalk : C.smoke, boxShadow: on ? `4px 4px 0px ${t.acc}` : undefined }}>
                <View style={{ width: 52, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <CutShape width={52} height={36} fill={t.acc} style={{ position: 'absolute', left: 0, top: 0 }} />
                  <View><Icon name={t.icon} size={22} color={onColor(t.acc)} tint={0.2} strokeWidth={2} /></View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Txt face="display" size={22} lh={1.2} color={on ? t.acc : C.chalk}>{t.name.toUpperCase()}</Txt>
                  <Txt face="label" w={600} size={12} ls={0.1} color={C.smoke}>{t.vibe.toUpperCase()}</Txt>
                </View>
                {on ? <RoundStamp label="Your corner" tone="accent" size="sm" accent={t.acc} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Accent override" meta="Optional" style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, marginTop: SP.md }}>
        {accents.map((c, i) => {
          const on = accent.toLowerCase() === c.toLowerCase();
          return (
            <Tap key={c} onPress={() => s.setOpt('accent', c)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={i === 0 ? `${theme.name} colour` : `Accent ${c}`} style={{ paddingRight: SHADOW, paddingBottom: SHADOW }}>
              <View style={[{ width: HIT, height: HIT, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }, on ? hard(C.chalk) : null]}>
                {on ? <Icon name="check" size={22} color={onColor(c)} strokeWidth={2.6} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        <Row title="Arena lights" sub="Your colour and the far corner's, across the background" right={<Toggle on={settings.fx} onPress={() => s.setOpt('fx', !settings.fx)} accessibilityLabel="Arena lights" />} last />
      </Card>

      <SectionHeader title="Text size" style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', marginTop: SP.md, borderWidth: 2, borderColor: C.smoke, backgroundColor: C.canvas }}>
        {TEXT_SIZES.map(([v, name, px]) => {
          const on = settings.textSize === v;
          return (
            <Tap key={v} onPress={() => s.setOpt('textSize', v)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${name} text`} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.chalk : 'transparent' }}>
              {/* Each sample is drawn at its own size, whatever the current setting is. */}
              <Txt size={px / settings.textSize} w={600} color={on ? C.ink : C.smoke}>Aa</Txt>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Emblem" meta={`${theme.name} collection`} style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        <Tap onPress={() => s.setEmblem(null)} accessibilityRole="radio" accessibilityState={{ selected: !selected, checked: !selected }} accessibilityLabel="No emblem" style={{ flex: 1, gap: SP.xs }}>
          <View style={{ aspectRatio: 1, borderWidth: 2, borderColor: !selected ? accent : C.smoke, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={24} color={C.smoke} />
          </View>
          <Txt face="label" w={600} size={12} ls={0.12} color={!selected ? accent : C.smoke} align="center">{!selected ? 'IN USE' : 'NONE'}</Txt>
        </Tap>
        {emblems.length === 0 ? (
          <View style={{ flex: 2, aspectRatio: 2, borderWidth: 2, borderColor: C.smoke, alignItems: 'center', justifyContent: 'center', padding: SP.md }}>
            <Txt size={13} w={500} lh={1.4} color={C.smoke} align="center">Emblems for this world are coming soon.</Txt>
          </View>
        ) : null}
        {emblems.map((e, i) => {
          const on = selected === e.id;
          return (
            <Tap key={e.id} onPress={() => s.setEmblem(e.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`Emblem ${i + 1}`} style={{ flex: 1, gap: SP.xs }}>
              <View style={{ aspectRatio: 1, borderWidth: 2, borderColor: on ? accent : C.smoke, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Image source={e.source} style={{ width: '78%', height: '78%' }} resizeMode="contain" accessibilityIgnoresInvertColors />
              </View>
              <Txt face="label" w={600} size={12} ls={0.12} color={on ? accent : C.smoke} align="center">{on ? 'IN USE' : `NO. ${String(i + 1).padStart(2, '0')}`}</Txt>
            </Tap>
          );
        })}
        {emblems.length === 1 ? <View style={{ flex: 1 }} /> : null}
      </View>
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        <Row title="Strength" sub="Faint art behind your screens" right={<Segmented value={settings.bgStrength} options={[['Subtle', 'Subtle'], ['Medium', 'Medium'], ['Bold', 'Bold']]} onChange={v => s.setOpt('bgStrength', v)} />} />
        <Row title="Size" sub="Small, medium, large" right={<Segmented value={settings.emblemSize} options={[['S', 'S'], ['M', 'M'], ['L', 'L']]} onChange={v => s.setOpt('emblemSize', v)} />} />
        <Row title="Position" sub="Where it sits" right={<Segmented value={settings.emblemPos} options={[['Top', 'Top'], ['Center', 'Center'], ['Bottom', 'Bottom']]} onChange={v => s.setOpt('emblemPos', v)} />} last />
      </Card>
    </Screen>
  );
}
