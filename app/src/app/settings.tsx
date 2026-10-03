// Settings: who you are at the top, then four rooms. Each opens its own page, so nothing here is
// a wall of switches.
import { characterOf, programWeek, trajectory, week } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon, type IconKey } from '../components/icons';
import { Panel, Stamp } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { alpha, C } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

export default function Settings() {
  const s = useStore();
  const g = useGame();
  const { settings, accent, theme, profile } = s;
  const daysLeft = trajectory(profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo).daysLeft;
  const name = profile.name || (s.account.email ? s.account.email.split('@')[0] : 'You');
  const character = characterOf(settings.character);
  const rooms: { icon: IconKey; title: string; sub: string; to: () => void }[] = [
    { icon: 'rei', title: 'REI', sub: `${settings.tone} · voice of ${character.name}`, to: () => router.push('/rei-settings') },
    { icon: 'look', title: 'Look', sub: `${theme.name} · ${settings.font}`, to: () => router.push('/appearance') },
    { icon: 'memory', title: 'Memory', sub: s.memory.length ? `${s.memory.length} things REI knows` : 'What REI knows about you', to: () => router.push('/memory') },
    { icon: 'door', title: 'Account', sub: s.cloud ? 'Signed in · data · credits' : 'Demo · data · credits', to: () => router.push('/account') },
  ];

  return (
    <Screen tabs={false}>
      <SubHeader title="SETTINGS" onBack={() => router.back()} />

      <Panel acc={accent} style={{ marginTop: 22 }} onPress={() => router.navigate('/vow')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(accent, 0.14), borderWidth: 2, borderColor: accent }}>
            <Txt size={26} w={600} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={22} w={600} ls={-0.01}>{name}</Txt>
            <Txt size={13} color={C.muted}>{`Week ${programWeek(s.startedOn)} · ${daysLeft} days to the vow`}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Stamp text={g.rank.name} color={accent} tilt={0} />
              <Stamp text={`${g.xp.toLocaleString('en-US')} XP`} color={C.warn} tilt={0} />
            </View>
          </View>
          <Icon name="chevron" size={18} color={C.dim} />
        </View>
      </Panel>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
        {rooms.map(r => (
          <Tap key={r.title} onPress={r.to} style={{ width: '47.5%', flexGrow: 1 }}>
            <View style={{ height: 132, borderRadius: 14, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', padding: 16, justifyContent: 'space-between' }}>
              <Icon name={r.icon} size={30} color={accent} tint={0.24} />
              <View style={{ gap: 3 }}>
                <Txt size={18} w={600}>{r.title}</Txt>
                <Txt size={12} color={C.muted} numberOfLines={2}>{r.sub}</Txt>
              </View>
            </View>
          </Tap>
        ))}
      </View>

      <Tap onPress={() => router.push('/badges')} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13' }}>
        <Icon name="badge" size={24} color={C.warn} />
        <View style={{ flex: 1 }}>
          <Txt size={16} w={500}>Badges</Txt>
          <Txt size={12} color={C.muted}>{`${g.earned.length} of ${g.earned.length + g.locked.length} earned`}</Txt>
        </View>
        <Icon name="chevron" size={16} color={C.dim} />
      </Tap>

      <Txt face="mono" size={10} ls={0.14} color={C.ghost} style={{ textAlign: 'center', marginTop: 30 }}>
        {`REI · BUILD 0.8 · ${s.cloud ? 'CLOUD' : 'ON DEVICE'}`}
      </Txt>
    </Screen>
  );
}
