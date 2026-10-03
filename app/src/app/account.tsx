// Account and data: who's signed in, the demo story, clearing things, and where the numbers come from.
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Icon } from '../components/icons';
import { Heading, Panel } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Row, Segmented, Tap, Txt } from '../components/ui';
import { firebaseEnabled, usingEmulators } from '../lib/firebase';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

export default function Account() {
  const s = useStore();
  const { settings, accent } = s;
  return (
    <Screen tabs={false}>
      <SubHeader title="ACCOUNT" onBack={() => router.back()} />

      <Heading icon="profile" title="Account" acc={accent} style={{ marginTop: 26 }} />
      <Panel acc={accent} tone={0.2} dots={false} style={{ marginTop: 14 }} pad={16}>
        {s.cloud ? (
          <Row
            title={s.account.email ?? 'Signed in'}
            sub={usingEmulators ? 'Synced to the local emulators' : 'Synced to your REI account'}
            right={<Tap onPress={() => Alert.alert('Sign out?', 'Your data stays in your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void s.signOut() }])}><Txt size={14} color={accent}>Sign out</Txt></Tap>}
            last
          />
        ) : firebaseEnabled ? (
          <Row title="Demo mode" sub="Stored on this phone only" right={<Tap onPress={() => s.setDemo(false)}><Txt size={14} color={accent}>Sign in</Txt></Tap>} last />
        ) : (
          <Row title="On this phone only" sub="Add a Firebase project to sync. See app/README.md." last />
        )}
      </Panel>

      {s.cloud ? null : (
        <>
          <Heading icon="today" title="Demo story" acc={accent} style={{ marginTop: 30 }} />
          <Panel acc={accent} tone={0.2} dots={false} style={{ marginTop: 14 }} pad={16}>
            <Row title="Week scenario" sub="Preview how REI reacts" right={<Segmented value={settings.scenario} options={[['Slipping week', 'Slipping'], ['Strong week', 'Strong']]} onChange={v => s.setOpt('scenario', v)} />} last />
          </Panel>
        </>
      )}

      <Heading icon="log" title="Data" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ gap: 10, marginTop: 14 }}>
        <Tap
          onPress={() => Alert.alert('Clear conversation?', 'REI keeps your goal and today’s log.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: s.clearChat }])}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', paddingHorizontal: 16 }}
        >
          <Icon name="voice" size={20} color={C.body} />
          <Txt size={15} color={C.body}>Clear conversation</Txt>
        </Tap>
        <Tap
          onPress={() => Alert.alert('Reset today’s log?', 'Meals, session and today’s messages go back to the start of the day.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: s.resetDay }])}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,90,60,0.35)', backgroundColor: 'rgba(255,90,60,0.05)', paddingHorizontal: 16 }}
        >
          <Icon name="close" size={20} color={C.alertSoft} />
          <Txt size={15} color={C.alertSoft}>Reset today’s log</Txt>
        </Tap>
      </View>

      <Heading icon="vow" title="Data credits" acc={accent} style={{ marginTop: 30 }} />
      <Txt size={12} lh={1.5} color={C.dim} style={{ marginTop: 12 }}>
        Indian Food Composition Tables 2017, National Institute of Nutrition (ICMR-NIN). Food nutrition data from TempoLife (tempolife.app), CC-BY-4.0, based on USDA FoodData Central. Packaged foods from Open Food Facts (ODbL). Exercises from free-exercise-db (public domain). Activity estimates from the Compendium of Physical Activities. Dish values are typical estimates.
      </Txt>
    </Screen>
  );
}
