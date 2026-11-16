// Look: your world (it sets your colour; paper, ink and the seal red never change), an accent
// override, the paper texture, text size and the emblem behind your screens.
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { RoundStamp, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { ACCENT_EXTRAS, C, emblemIdFor, EMBLEMS, HIT, onColor, RADIUS, SP, THEMES } from '../lib/theme';
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
      <SubHeader title="Look" onBack={() => router.back()} />

      <SectionHeader title="World" meta="Sets your colour" style={{ marginTop: SP.xxl }} />
      <View accessibilityRole="radiogroup" style={{ marginTop: SP.md, gap: SP.sm }}>
        {THEMES.map(t => {
          const on = theme.id === t.id;
          return (
            <Tap key={t.id} onPress={() => s.pickTheme(t.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${t.name} world. ${t.vibe}`}>
              <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.sm, backgroundColor: C.canvas, borderWidth: 1, borderColor: on ? t.acc : C.line2, borderRadius: RADIUS.card }}>
                <View style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', backgroundColor: C.arena, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm }}>
                  <Icon name={t.icon} size={22} color={t.acc} tint={0} strokeWidth={1.7} />
                </View>
                <View style={{ flex: 1, gap: 2, alignItems: 'flex-start' }}>
                  <Txt face="heading" raw size={17} lh={1.4}>{t.name}</Txt>
                  <Txt face="mono" raw size={12} lh={1.35} color={C.smoke}>{t.vibe}</Txt>
                </View>
                {on ? <RoundStamp label="Your world" tone="accent" size="sm" accent={t.acc} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Accent override" meta="Optional" style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {accents.map((c, i) => {
          const on = accent.toLowerCase() === c.toLowerCase();
          return (
            <Tap key={c} onPress={() => s.setOpt('accent', c)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={i === 0 ? `${theme.name} colour` : `Accent ${c}`} style={{ padding: 3, borderWidth: 1, borderColor: on ? C.chalk : 'transparent', borderRadius: RADIUS.card }}>
              <View style={{ width: HIT, height: HIT, backgroundColor: c, borderRadius: RADIUS.tag, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Icon name="check" size={20} color={onColor(c)} tint={0} strokeWidth={2} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Paper" style={{ marginTop: SP.huge }} />
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        <Row title="Paper texture" sub="A faint paper grain behind every page" right={<Toggle on={settings.fx} onPress={() => s.setOpt('fx', !settings.fx)} accessibilityLabel="Paper texture" />} last />
      </Card>

      <SectionHeader title="Text size" style={{ marginTop: SP.huge }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', marginTop: SP.md, padding: 3, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas }}>
        {TEXT_SIZES.map(([v, name, px]) => {
          const on = settings.textSize === v;
          return (
            <Tap key={v} onPress={() => s.setOpt('textSize', v)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${name} text`} style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.tag, backgroundColor: on ? C.chalk : 'transparent' }}>
              {/* Each sample is drawn at its own size, whatever the current setting is. */}
              <Txt size={px / settings.textSize} w={600} lh={1.25} color={on ? C.ink : C.smoke}>Aa</Txt>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Emblem" meta={`${theme.name} collection`} style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', gap: SP.md, marginTop: SP.md }}>
        <Tap onPress={() => s.setEmblem(null)} accessibilityRole="radio" accessibilityState={{ selected: !selected, checked: !selected }} accessibilityLabel="No emblem" style={{ flex: 1, gap: SP.sm }}>
          <View style={{ aspectRatio: 1, borderWidth: 1, borderColor: !selected ? accent : C.line2, borderRadius: RADIUS.card, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={22} color={C.smoke} tint={0} strokeWidth={1.7} />
          </View>
          <Txt face="mono" raw size={12} lh={1.35} color={!selected ? accent : C.smoke} align="center">{!selected ? 'In use' : 'None'}</Txt>
        </Tap>
        {emblems.length === 0 ? (
          <View style={{ flex: 2, aspectRatio: 2, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', padding: SP.md }}>
            <Txt size={13} lh={1.4} color={C.smoke} align="center">Emblems for this world are coming soon.</Txt>
          </View>
        ) : null}
        {emblems.map((e, i) => {
          const on = selected === e.id;
          return (
            <Tap key={e.id} onPress={() => s.setEmblem(e.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`Emblem ${i + 1}`} style={{ flex: 1, gap: SP.sm }}>
              <View style={{ aspectRatio: 1, borderWidth: 1, borderColor: on ? accent : C.line2, borderRadius: RADIUS.card, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Image source={e.source} style={{ width: '78%', height: '78%' }} resizeMode="contain" accessibilityIgnoresInvertColors />
              </View>
              <Txt face="mono" raw size={12} lh={1.35} color={on ? accent : C.smoke} align="center">{on ? 'In use' : `No. ${String(i + 1).padStart(2, '0')}`}</Txt>
            </Tap>
          );
        })}
        {emblems.length === 1 ? <View style={{ flex: 1 }} /> : null}
      </View>
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        <Row title="Strength" sub="Faint art behind your pages" right={<Segmented value={settings.bgStrength} options={[['Subtle', 'Subtle'], ['Medium', 'Medium'], ['Bold', 'Bold']]} onChange={v => s.setOpt('bgStrength', v)} />} />
        <Row title="Size" sub="Small, medium, large" right={<Segmented value={settings.emblemSize} options={[['S', 'S'], ['M', 'M'], ['L', 'L']]} onChange={v => s.setOpt('emblemSize', v)} />} />
        <Row title="Position" sub="Where it sits" right={<Segmented value={settings.emblemPos} options={[['Top', 'Top'], ['Center', 'Center'], ['Bottom', 'Bottom']]} onChange={v => s.setOpt('emblemPos', v)} />} last />
      </Card>
    </Screen>
  );
}
