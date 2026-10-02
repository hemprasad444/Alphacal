import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Label, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { firebaseEnabled, usingEmulators } from '../lib/firebase';
import { programWeek, trajectory, week } from '@rei/shared';
import { alpha, C, mix } from '../lib/theme';
import { useStore } from '../state/store';

const TEXT_SIZES: [number, string, number][] = [[0.82, 'SMALLEST', 11], [0.9, 'SMALL', 13], [1, 'DEFAULT', 15], [1.08, 'LARGE', 17]];

export default function Settings() {
  const s = useStore();
  const { settings, accent, theme } = s;
  const tough = settings.tone === 'Tough love';
  const daysLeft = trajectory(s.profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo).daysLeft;

  return (
    <Screen tabs={false}>
      <SubHeader title={settings.hud ? 'SETTINGS · 設定' : 'SETTINGS'} onBack={() => router.back()} />

      <Tap onPress={() => router.navigate('/vow')} style={{ marginTop: 24, padding: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.line3, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: mix(accent, '#0A0C0F', 0.16), borderWidth: 1, borderColor: alpha(accent, 0.45) }}>
          <Txt size={22} w={500} color={accent}>H</Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={18} w={500} ls={-0.01}>{s.cloud && s.account.email ? s.account.email.split('@')[0] : 'Hemprasad'}</Txt>
          <Txt size={13} color={C.muted}>{`Week ${programWeek(s.startedOn)} · ${daysLeft} days to the vow`}</Txt>
        </View>
        <Txt size={13} color={accent}>Vow ›</Txt>
      </Tap>

      <Label style={{ marginTop: 30 }}>DISPLAY</Label>
      <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
        <Row
          title="Appearance"
          sub={`${theme.name} · ${settings.font}`}
          onPress={() => router.push('/appearance')}
          right={<Txt size={18} color={C.faint}>›</Txt>}
        />
        <View style={{ paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Txt size={16}>Text size</Txt>
            <Label size={11} ls={0} color={accent}>{TEXT_SIZES.find(t => t[0] === settings.textSize)?.[1] ?? 'DEFAULT'}</Label>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Txt size={12} color={C.muted}>A</Txt>
            <View style={{ flex: 1, flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line3 }}>
              {TEXT_SIZES.map(([v, , px]) => {
                const on = settings.textSize === v;
                return (
                  <Tap key={v} onPress={() => s.setOpt('textSize', v)} style={{ flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
                    <Txt size={px / settings.textSize} color={on ? C.text : C.label}>Aa</Txt>
                  </Tap>
                );
              })}
            </View>
            <Txt size={18} color={C.muted}>A</Txt>
          </View>
        </View>
      </Card>

      <Label style={{ marginTop: 30 }}>REI</Label>
      <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
        <Row title="Intensity" sub={tough ? '10 / 10 · no excuses accepted' : '6 / 10 · firm, warmer'} right={<Segmented value={settings.tone} options={[['Tough love', 'Tough'], ['Coach', 'Coach']]} onChange={v => s.setOpt('tone', v)} />} />
        <Row title="In conversation" sub="Show her portrait or the core" right={<Segmented value={settings.avatar} options={[['Character in chat', 'Portrait'], ['Core only', 'Core']]} onChange={v => s.setOpt('avatar', v)} />} />
        <Row title="Speak replies aloud" sub="In voice mode" right={<Toggle on={settings.speak} onPress={() => s.setOpt('speak', !settings.speak)} />} />
        <Row title="Proactive check-ins" sub="REI messages you when you slip" right={<Toggle on={settings.nudge} onPress={() => s.setOpt('nudge', !settings.nudge)} />} />
        <Row title="What REI remembers" sub={s.memory.length ? `${s.memory.length} fact${s.memory.length > 1 ? 's' : ''}: diet, health, schedule…` : 'Diet, injuries, schedule, equipment'} onPress={() => router.push('/memory')} right={<Txt size={18} color={C.dim}>›</Txt>} last />
      </Card>

      <Label style={{ marginTop: 30 }}>ACCOUNT</Label>
      <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
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
      </Card>

      {s.cloud ? null : (
        <>
          <Label style={{ marginTop: 30 }}>DEMO</Label>
          <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
            <Row title="Week scenario" sub="Preview how REI reacts" right={<Segmented value={settings.scenario} options={[['Slipping week', 'Slipping'], ['Strong week', 'Strong']]} onChange={v => s.setOpt('scenario', v)} />} last />
          </Card>
        </>
      )}

      <Label style={{ marginTop: 30 }}>DATA</Label>
      <View style={{ gap: 8, marginTop: 10 }}>
        <Tap
          onPress={() => Alert.alert('Clear conversation?', 'REI keeps your goal and today’s log.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: s.clearChat }])}
          style={{ height: 50, borderRadius: 16, borderWidth: 1, borderColor: C.line3, backgroundColor: C.card2, justifyContent: 'center', paddingHorizontal: 16 }}
        >
          <Txt size={15} color={C.body}>Clear conversation</Txt>
        </Tap>
        <Tap
          onPress={() => Alert.alert('Reset today’s log?', 'Meals, session and today’s messages go back to the start of the day.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: s.resetDay }])}
          style={{ height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,90,60,0.3)', backgroundColor: 'rgba(255,90,60,0.05)', justifyContent: 'center', paddingHorizontal: 16 }}
        >
          <Txt size={15} color={C.alertSoft}>{"Reset today's log"}</Txt>
        </Tap>
      </View>
      <Label size={10} ls={0.14} color={C.ghost} style={{ textAlign: 'center', marginTop: 26 }}>
        {`REI · 零 · BUILD 0.6 · ${s.cloud ? 'CLOUD' : 'ON DEVICE'}`}
      </Label>
    </Screen>
  );
}
