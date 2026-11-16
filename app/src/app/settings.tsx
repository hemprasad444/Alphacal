// Settings: who you are at the top, then the rooms as a list. Each opens its own page, so
// nothing here is a wall of switches.
import { characterOf, programWeek, trajectory, week } from '@rei/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { RoundStamp, SectionHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Tap, Txt } from '../components/ui';
import { C, RADIUS, SP } from '../lib/theme';
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
    { title: 'Seals', sub: `${g.earned.length} of ${g.earned.length + g.locked.length} earned`, to: () => router.push('/badges') },
  ];
  // Development builds only: every Sumi & Hanko part, in every world.
  if (__DEV__) rooms.push({ title: 'Gallery', sub: 'Sumi & Hanko parts, all six worlds', to: () => router.push('/gallery') });

  return (
    <Screen tabs={false}>
      <SubHeader title="Settings" onBack={() => router.back()} />

      {/* Who you are and where you stand. Opens the Vow. */}
      <Tap onPress={() => router.navigate('/vow')} accessibilityLabel={`${name}. Week ${programWeek(s.startedOn)}, ${daysLeft} days to the vow. ${g.rank.name}, ${g.xp.toLocaleString('en-US')} XP. Opens the Vow.`} style={{ marginTop: SP.xxl }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg, padding: SP.xl }}>
          <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: C.arena, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm }}>
            <Txt face="display" exact raw size={28} lh={1.2} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-start' }}>
            <Txt face="display" exact raw size={24} lh={1.25} fit>{name}</Txt>
            <Txt face="mono" raw size={12} lh={1.35} color={C.smoke} numberOfLines={1}>{`Week ${programWeek(s.startedOn)} · ${daysLeft} days to go`}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.xs }}>
              <RoundStamp label={g.rank.name} tone="accent" size="sm" />
              <RoundStamp label={`${g.xp.toLocaleString('en-US')} XP`} tone="outline" size="sm" />
            </View>
          </View>
          <Icon name="chevron" size={18} color={C.smoke} tint={0} strokeWidth={1.7} />
        </Card>
      </Tap>

      <SectionHeader title="Preferences" style={{ marginTop: SP.huge }} />
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        {rooms.map((r, i) => (
          <Tap key={r.title} onPress={r.to} accessibilityLabel={`${r.title}. ${r.sub}`}>
            <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ flex: 1, gap: 2, alignItems: 'flex-start' }}>
                <Txt face="heading" size={17} lh={1.4}>{r.title}</Txt>
                <Txt size={13} lh={1.4} color={C.smoke} numberOfLines={2}>{r.sub}</Txt>
              </View>
              <Icon name="chevron" size={18} color={C.smoke} tint={0} strokeWidth={1.7} />
            </View>
          </Tap>
        ))}
      </Card>

      <Txt face="mono" raw size={12} lh={1.35} color={C.faint} align="center" style={{ marginTop: SP.huge }}>
        {`REI · build 0.8 · ${s.cloud ? 'cloud' : 'on device'}`}
      </Txt>
    </Screen>
  );
}
