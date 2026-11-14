// Scan a packaged food's barcode, check Open Food Facts, and log a portion. Products are
// saved as your foods, so the next scan is instant. Missing products can be typed in once.
import type { Food } from '@rei/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, FoodSheetBody } from '../components/FoodSheet';
import { Corners, Dots, IconButton, Label, Txt } from '../components/ui';
import { C, F, fontFamily, HIT, SHADOW, SP } from '../lib/theme';
import { useStore } from '../state/store';

type State =
  | { k: 'scan' }
  | { k: 'busy'; code: string }
  | { k: 'found'; food: Food }
  | { k: 'missing'; code: string; why: string };

export default function Scan() {
  const s = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [state, setState] = useState<State>({ k: 'scan' });
  const [typed, setTyped] = useState('');
  const busy = useRef(false);

  const look = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setState({ k: 'busy', code });
    try {
      const food = await s.findBarcode(code);
      setState(food ? { k: 'found', food } : { k: 'missing', code, why: 'Open Food Facts doesn’t have this one yet.' });
    } catch {
      setState({ k: 'missing', code, why: 'Couldn’t reach Open Food Facts. Type the label in, or try again.' });
    } finally {
      busy.current = false;
    }
  };

  const camera = Platform.OS !== 'web' && perm?.granted;
  // A panel over the camera: arena, with your corner colour along the top.
  const panel = { backgroundColor: F.arena, borderWidth: 2, borderColor: F.rope, borderTopColor: s.accent, padding: SP.lg, paddingBottom: SP.lg + SHADOW } as const;

  return (
    <View style={{ flex: 1, backgroundColor: camera && state.k === 'scan' ? '#000' : F.arena }}>
      {camera && state.k === 'scan' ? (
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={({ data }) => look(data)}
        />
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + SP.sm, paddingBottom: insets.bottom + SP.xl, paddingHorizontal: SP.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT }}>
            <IconButton size={40} onPress={() => router.back()} accessibilityLabel="Close">✕</IconButton>
            <View accessibilityRole="header" style={{ flex: 1, alignItems: 'flex-start' }}>
              <Txt face="display" size={26} ls={0.02} fit>SCAN A BARCODE</Txt>
            </View>
          </View>

          {state.k === 'scan' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.lg }}>
              {camera ? (
                <View style={{ width: 260, height: 150 }}>
                  <Corners color={s.accent} />
                </View>
              ) : Platform.OS !== 'web' ? (
                <View style={{ alignItems: 'center', gap: SP.md }}>
                  <Txt size={15} w={500} color={C.body} align="center">REI needs the camera to read barcodes.</Txt>
                  <View style={{ width: 220, flexDirection: 'row' }}>
                    <Button primary onPress={() => requestPerm()}>Allow camera</Button>
                  </View>
                </View>
              ) : null}
              <Txt face="label" w={600} size={13} ls={0.12} color={camera ? F.chalk : F.smoke} align="center">{(camera ? 'Hold the barcode inside the frame.' : 'Or type the number under the barcode.').toUpperCase()}</Txt>
            </View>
          ) : null}

          {state.k === 'busy' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.md }}>
              <Dots />
              <Txt face="label" w={600} size={14} ls={0.12} color={F.chalk}>{`LOOKING UP ${state.code}…`}</Txt>
            </View>
          ) : null}

          {state.k === 'found' ? (
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={panel}>
                <FoodSheetBody
                  pick={{ food: state.food, qty: 1 }}
                  src="barcode"
                  // Keep the product, so the next scan is instant and works offline.
                  beforeLog={() => s.saveFood({ ...state.food, src: 'barcode', usedAt: Date.now() })}
                  onDone={() => router.back()}
                />
              </View>
            </View>
          ) : null}

          {state.k === 'missing' ? <LabelForm code={state.code} why={state.why} panel={panel} onSaved={food => setState({ k: 'found', food })} onRetry={() => setState({ k: 'scan' })} /> : null}

          {state.k === 'scan' ? (
            <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.lg }}>
              <TextInput
                value={typed}
                onChangeText={t => setTyped(t.replace(/\D/g, ''))}
                onSubmitEditing={() => typed.length >= 6 && look(typed)}
                placeholder="Barcode number"
                placeholderTextColor={C.dim}
                keyboardType="number-pad"
                keyboardAppearance="dark"
                accessibilityLabel="Barcode number"
                style={{ flex: 1, height: 48, paddingHorizontal: SP.lg, backgroundColor: F.canvas, borderWidth: 2, borderColor: typed ? s.accent : F.rope, fontFamily: fontFamily(s.settings.font, 500), fontSize: 16 * s.settings.textSize, color: C.text }}
              />
              <View style={{ width: 112, flexDirection: 'row' }}>
                <Button primary disabled={typed.length < 6} onPress={() => look(typed)}>Find</Button>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** For products Open Food Facts lacks: copy the label once, per 100 g. */
function LabelForm({ code, why, panel, onSaved, onRetry }: { code: string; why: string; panel: object; onSaved: (f: Food) => void; onRetry: () => void }) {
  const s = useStore();
  const [v, setV] = useState({ name: '', kcal: '', p: '', c: '', f: '', serving: '' });
  const n = (x: string) => parseFloat(x.replace(',', '.'));
  const ok = v.name.trim() && [v.kcal, v.p, v.c, v.f].every(x => n(x) >= 0);
  const field = (k: keyof typeof v, label: string, numeric = true) => (
    <View style={{ flex: numeric ? 1 : undefined, gap: SP.xs }}>
      <Label size={11}>{label}</Label>
      <TextInput
        value={v[k]}
        onChangeText={t => setV(cur => ({ ...cur, [k]: t }))}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        keyboardAppearance="dark"
        accessibilityLabel={label}
        style={{ height: HIT, borderWidth: 2, borderColor: F.rope, backgroundColor: F.canvas, paddingHorizontal: SP.sm, fontFamily: fontFamily(s.settings.font, 500), fontSize: 16 * s.settings.textSize, color: C.text }}
      />
    </View>
  );
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', marginTop: SP.xl }}>
      <View style={[panel, { gap: SP.md }]}>
        <Label size={11}>{`BARCODE ${code}`}</Label>
        <Txt size={15} color={C.body} lh={1.4}>{`${why} Copy the label once and it’s yours from then on.`}</Txt>
        {field('name', 'NAME', false)}
        <Label size={11} color={C.muted}>PER 100 G (OR 100 ML)</Label>
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          {field('kcal', 'KCAL')}
          {field('p', 'PROTEIN')}
          {field('c', 'CARBS')}
          {field('f', 'FAT')}
        </View>
        {field('serving', 'SERVING SIZE, G (OPTIONAL)')}
        <View style={{ flexDirection: 'row', gap: SP.sm }}>
          <Button onPress={onRetry}>Scan again</Button>
          <Button
            primary
            disabled={!ok}
            onPress={() => {
              const serving = n(v.serving);
              const food: Food = {
                id: `b:${code}`, name: v.name.trim().slice(0, 60), barcode: code, per: 100,
                kcal: Math.round(n(v.kcal)), p: n(v.p), c: n(v.c), f: n(v.f),
                units: [...(serving > 0 ? [{ n: 'serving', g: Math.round(serving) }] : []), { n: '100 g', g: 100 }], src: 'barcode', usedAt: Date.now(),
              };
              s.saveFood(food);
              onSaved(food);
            }}
          >
            Save
          </Button>
        </View>
      </View>
    </View>
  );
}
