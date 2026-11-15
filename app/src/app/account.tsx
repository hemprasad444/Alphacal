// Account and data: who's signed in, the demo story, clearing things, and where the numbers come from.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Row, Segmented, Tap, Txt } from '../components/ui';
import { firebaseEnabled, usingEmulators } from '../lib/firebase';
import { C, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';

type Ask = 'signOut' | 'clear' | 'reset';

export default function Account() {
  const s = useStore();
  const { settings, accent } = s;
  const [asked, setAsked] = useState<Ask>('clear');
  /** The sheet is up. `asked` stays put while it slides away, so its words don't blank out. */
  const [open, setOpen] = useState(false);
  const setAsk = (a: Ask) => {
    setAsked(a);
    setOpen(true);
  };
  const asks: Record<Ask, { title: string; message: string; confirm: string; run: () => void }> = {
    signOut: { title: 'Sign out?', message: 'Your data stays in your account.', confirm: 'Sign out', run: () => void s.signOut() },
    clear: { title: 'Clear conversation?', message: 'REI keeps your goal and today’s log.', confirm: 'Clear', run: s.clearChat },
    reset: { title: 'Reset today’s log?', message: 'Meals, session and today’s messages go back to the start of the day.', confirm: 'Reset', run: s.resetDay },
  };
  const link = (label: string, onPress: () => void) => (
    <Tap onPress={onPress} accessibilityLabel={label} hitSlop={8} style={{ minHeight: HIT, justifyContent: 'center', paddingLeft: SP.sm }}>
      <Txt face="label" w={600} size={15} ls={0.1} color={accent}>{label.toUpperCase()}</Txt>
    </Tap>
  );
  const action = (label: string, sub: string, onPress: () => void, danger?: boolean) => (
    <Tap onPress={onPress} accessibilityLabel={`${label}. ${sub}`}>
      <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas, borderWidth: 2, borderColor: C.chalk }}>
        {danger ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.rival }} /> : null}
        <View style={{ flex: 1 }}>
          <Txt size={16} w={500}>{label}</Txt>
          <Txt size={13} w={500} color={C.smoke}>{sub}</Txt>
        </View>
        <Icon name="chevron" size={18} color={danger ? C.rival : accent} strokeWidth={2.2} />
      </View>
    </Tap>
  );

  return (
    <Screen tabs={false}>
      <SubHeader title="ACCOUNT" onBack={() => router.back()} />

      <SectionHeader title="Account" style={{ marginTop: SP.xl }} />
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        {s.cloud ? (
          <Row title={s.account.email ?? 'Signed in'} sub={usingEmulators ? 'Synced to the local emulators' : 'Synced to your REI account'} right={link('Sign out', () => setAsk('signOut'))} last />
        ) : firebaseEnabled ? (
          <Row title="Demo mode" sub="Stored on this phone only" right={link('Sign in', () => s.setDemo(false))} last />
        ) : (
          <Row title="On this phone only" sub="Add a Firebase project to sync. See app/README.md." last />
        )}
      </Card>

      {s.cloud ? null : (
        <>
          <SectionHeader title="Demo story" style={{ marginTop: SP.huge }} />
          <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
            <Row title="Week scenario" sub="Preview how REI reacts" right={<Segmented value={settings.scenario} options={[['Slipping week', 'Slipping'], ['Strong week', 'Strong']]} onChange={v => s.setOpt('scenario', v)} />} last />
          </Card>
        </>
      )}

      <SectionHeader title="Data" style={{ marginTop: SP.huge }} />
      <View style={{ gap: SP.xs, marginTop: SP.md }}>
        {action('Clear conversation', 'REI keeps your goal and today’s log', () => setAsk('clear'))}
        {action('Reset today’s log', 'Meals, session and messages back to the start of the day', () => setAsk('reset'), true)}
      </View>

      <SectionHeader title="Data credits" style={{ marginTop: SP.huge }} />
      <Txt size={13} w={500} lh={1.5} color={C.smoke} style={{ marginTop: SP.md }}>
        Indian Food Composition Tables 2017, National Institute of Nutrition (ICMR-NIN). Food nutrition data from TempoLife (tempolife.app), CC-BY-4.0, based on USDA FoodData Central. Packaged foods from Open Food Facts (ODbL). Exercises from free-exercise-db (public domain). Activity estimates from the Compendium of Physical Activities. Dish values are typical estimates.
      </Txt>

      <ConfirmSheet
        visible={open}
        title={asks[asked].title}
        message={asks[asked].message}
        confirmLabel={asks[asked].confirm}
        destructive
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          asks[asked].run();
        }}
      />
    </Screen>
  );
}
