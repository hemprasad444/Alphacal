// Settings: your fighter card at the top, then the rooms as a list. Each opens its own page, so
// nothing here is a wall of switches.
import { characterOf, programWeek, trajectory, week } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { RoundStamp, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C, hard, HIT, SHADOW, SP } from '../lib/theme';
import { useGame } from '../state/game';
import { useStore } from '../state/store';

export default function Settings() {
  const s = useStore();
  const g = useGame();
  const { settings, accent, theme, profile } = s;
  const daysLeft = trajectory(profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo).daysLeft;
  const name = profile.name || (s.account.email ? s.account.email.split('@')[0] : 'You');
  const character = characterOf(settings.character);
  const rooms: { title: string; sub: string; to: () => void }[] = [
    { title: 'REI', sub: `${settings.tone} · voice of ${character.name}`, to: () => router.push('/rei-settings') },
    { title: 'Look', sub: `${theme.name} world`, to: () => router.push('/appearance') },
    { title: 'Memory', sub: s.memory.length ? `${s.memory.length} things REI knows` : 'What REI knows about you', to: () => router.push('/memory') },
    { title: 'Account', sub: s.cloud ? 'Signed in · data · credits' : 'Demo · data · credits', to: () => router.push('/account') },
    { title: 'Badges', sub: `${g.earned.length} of ${g.earned.length + g.locked.length} earned`, to: () => router.push('/badges') },
  ];
  // Development builds only: every Fight Night part, in every world.
  if (__DEV__) rooms.push({ title: 'Gallery', sub: 'Fight Night parts, all six worlds', to: () => router.push('/gallery') });

  return (
    <Screen tabs={false}>
      <SubHeader title="SETTINGS" onBack={() => router.back()} />

      {/* The fighter card: who's in your corner. Opens the Vow. */}
      <Tap onPress={() => router.navigate('/vow')} accessibilityLabel={`${name}. Week ${programWeek(s.startedOn)}, ${daysLeft} days to the vow. ${g.rank.name}, ${g.xp.toLocaleString('en-US')} XP. Opens the Vow.`} style={{ marginTop: SP.xl, paddingRight: SHADOW, paddingBottom: SHADOW }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.lg, backgroundColor: C.canvas, padding: SP.lg }, hard(accent)]}>
          <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: C.arena, borderWidth: 2, borderColor: accent }}>
            <Txt face="display" lean={false} size={34} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-start' }}>
            <Txt face="display" size={30} lh={1.15} fit>{name.toUpperCase()}</Txt>
            <Txt face="label" w={600} size={13} ls={0.1} color={C.smoke}>{`WEEK ${programWeek(s.startedOn)} · ${daysLeft} DAYS TO THE VOW`}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.xs }}>
              <RoundStamp label={g.rank.name} tone="accent" size="sm" />
              <RoundStamp label={`${g.xp.toLocaleString('en-US')} XP`} tone="outline" size="sm" />
            </View>
          </View>
          <Icon name="chevron" size={20} color={C.smoke} strokeWidth={2.2} />
        </View>
      </Tap>

      <SectionHeader title="Your corner" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {rooms.map((r, i) => (
          <Tap key={r.title} onPress={r.to} accessibilityLabel={`${r.title}. ${r.sub}`}>
            <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas }}>
              <Txt face="label" w={600} size={14} ls={0.07} color={C.smoke} style={{ minWidth: 22 }}>{String(i + 1).padStart(2, '0')}</Txt>
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Txt face="display" size={22} lh={1.2}>{r.title.toUpperCase()}</Txt>
                <Txt size={13} w={500} color={C.smoke} numberOfLines={2}>{r.sub}</Txt>
              </View>
              <View style={{ width: HIT / 2, alignItems: 'flex-end' }}>
                <Icon name="chevron" size={18} color={accent} strokeWidth={2.2} />
              </View>
            </View>
          </Tap>
        ))}
      </View>

      <Txt face="label" w={600} size={12} ls={0.14} color={C.faint} style={{ textAlign: 'center', marginTop: SP.huge }}>
        {`REI · BUILD 0.8 · ${s.cloud ? 'CLOUD' : 'ON DEVICE'}`}
      </Txt>
    </Screen>
  );
}
