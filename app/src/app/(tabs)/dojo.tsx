// The Dojo: everything about training in one place. Rank and XP, today's session, one-tap logging,
// the week, badges, the weekly leaderboard and the training log.
import { clock, RANKS, sessionOrder, todaysPlan } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { Gauge, Heading, Medal, Panel, Stamp, Tile } from '../../components/manga';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { WeekStrip } from '../../components/WeekStrip';
import { Tap, Txt } from '../../components/ui';
import { BoardPreview } from '../../components/Board';
import { alpha, C } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

export default function Dojo() {
  const s = useStore();
  const now = useNow();
  const g = useGame();
  const { accent } = s;
  const plan = todaysPlan(now, s.program);
  const recent = useMemo(() => [...s.sessions].sort(sessionOrder).reverse().slice(0, 3), [s.sessions]);
  const rankNo = RANKS.findIndex(r => r.id === g.rank.id) + 1;
  const showcase = [...g.earned.slice(0, 3), ...g.locked.slice(0, 4 - Math.min(3, g.earned.length))].slice(0, 4);

  return (
    <Screen>
      <PageTitle icon="train" title="Dojo" sub="Train · rank up · collect" />

      <Panel acc={accent} style={{ marginTop: 22 }} pad={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 74, height: 74, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 74, height: 74, borderRadius: 37, backgroundColor: alpha(accent, 0.12), borderWidth: 1.5, borderColor: alpha(accent, 0.5) }} />
            <Icon name="rank" size={44} color={accent} tint={0.3} />
            <View style={{ position: 'absolute', bottom: -6 }}>
              <Stamp text={`R${rankNo}`} color={accent} tilt={0} size={9} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt face="mono" size={10} ls={0.16} color={C.muted}>{`RANK ${rankNo} OF ${RANKS.length}`}</Txt>
            <Txt size={30} w={600} ls={-0.02}>{g.rank.name}</Txt>
            <Txt size={13} color={C.sub} lh={1.35}>{g.rank.line}</Txt>
          </View>
        </View>
        <View style={{ marginTop: 18, gap: 8 }}>
          <Gauge pct={g.progress} acc={accent} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt face="mono" size={11} color={C.body}>{`${g.xp.toLocaleString('en-US')} XP`}</Txt>
            <Txt face="mono" size={11} color={C.muted}>{g.next ? `${(g.next.min - g.xp).toLocaleString('en-US')} TO ${g.next.name.toUpperCase()}` : 'MAX RANK'}</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line2 }}>
          {[
            { icon: 'streak' as const, v: `${g.stats.streak}`, k: 'DAY STREAK', hot: g.stats.streak >= 3 },
            { icon: 'kcal' as const, v: `+${g.today}`, k: 'XP TODAY', hot: g.today > 0 },
            { icon: 'board' as const, v: `${g.weekXp}`, k: 'XP THIS WEEK', hot: false },
          ].map(x => (
            <View key={x.k} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name={x.icon} size={16} color={x.hot ? C.warn : C.muted} />
                <Txt size={20} w={500}>{x.v}</Txt>
              </View>
              <Txt face="mono" size={9} ls={0.12} color={C.dim}>{x.k}</Txt>
            </View>
          ))}
        </View>
      </Panel>

      <Heading icon="gym" title="Today's session" acc={accent} style={{ marginTop: 30 }} />
      <Panel acc={s.sessionDone ? accent : plan ? C.warn : C.muted} tone={0.3} style={{ marginTop: 12 }}>
        {s.sessionDone ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icon name="check" size={30} color={accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Txt size={20} w={600}>Done for today</Txt>
              <Txt size={13} color={C.sub}>{`${s.loggedMin || plan?.minutes || 0} min logged. Eat, then sleep.`}</Txt>
            </View>
          </View>
        ) : plan ? (
          <>
            <Txt face="mono" size={10} ls={0.14} color={C.warn}>{`${(s.profile.sessionTime || '18:30')} · ${plan.minutes} MIN`}</Txt>
            <Txt size={26} w={600} ls={-0.02} style={{ marginTop: 6 }}>{plan.title}</Txt>
            <Txt size={13} color={C.sub} style={{ marginTop: 4 }}>{plan.sub}</Txt>
            <Tap onPress={() => router.push('/session')} style={{ marginTop: 16, height: 50, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <Icon name="train" size={20} color={C.ink} tint={0} strokeWidth={2} />
              <Txt size={16} w={600} color={C.ink}>Begin session</Txt>
            </Tap>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icon name="sleep" size={30} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Txt size={20} w={600}>Rest day</Txt>
              <Txt size={13} color={C.sub}>Walk, stretch, sleep. Played a sport anyway? Log it below.</Txt>
            </View>
          </View>
        )}
      </Panel>

      <Heading icon="plus" title="Log training" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Tile icon="run" label="Run" sub="distance" acc={accent} onPress={() => router.push({ pathname: '/log-training', params: { kind: 'run' } })} />
        <Tile icon="steps" label="Walk" sub="distance" acc={accent} onPress={() => router.push({ pathname: '/log-training', params: { kind: 'walk' } })} />
        <Tile icon="ride" label="Ride" sub="distance" acc={accent} onPress={() => router.push({ pathname: '/log-training', params: { kind: 'cycle' } })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Tile icon="sport" label="Sport" sub="any activity" acc={accent} onPress={() => router.push({ pathname: '/log-training', params: { kind: 'sport' } })} />
        <Tile icon="gym" label="Gym" sub="sets · reps · kg" acc={accent} onPress={() => router.push({ pathname: '/session', params: { mode: 'free' } })} />
        <Tile icon="voice" label="Tell REI" sub="just say it" acc={accent} hot onPress={() => router.push('/talk')} />
      </View>

      <View style={{ marginTop: 30 }}>
        <WeekStrip now={now} />
      </View>

      <Heading icon="badge" title="Badges" acc={accent} right={`${g.earned.length} / ${g.earned.length + g.locked.length} ›`} onRight={() => router.push('/badges')} style={{ marginTop: 30 }} />
      <Tap onPress={() => router.push('/badges')} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 }}>
        {showcase.map(b => (
          <View key={b.id} style={{ alignItems: 'center', gap: 8, width: 72 }}>
            <Medal icon={b.icon} tier={b.tier} earned={!!b.earned} progress={b.progress} />
            <Txt size={11} color={b.earned ? C.body : C.dim} align="center" numberOfLines={2}>{b.title}</Txt>
          </View>
        ))}
      </Tap>

      <Heading icon="board" title="This week's board" acc={accent} right="ALL ›" onRight={() => router.push('/board')} style={{ marginTop: 30 }} />
      <BoardPreview you={g.weekXp} />

      <Heading icon="log" title="Training log" acc={accent} right={`${s.sessions.length} LOGGED ›`} onRight={() => router.push('/history')} style={{ marginTop: 30 }} />
      <View style={{ marginTop: 8 }}>
        {recent.length ? recent.map((l, i) => (
          <Tap key={l.id ?? i} onPress={() => router.push('/history')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Icon name={l.cardio ? (l.cardio.kind === 'cycle' ? 'ride' : l.cardio.kind === 'walk' ? 'steps' : 'run') : l.activity ? 'sport' : 'gym'} size={20} color={C.body} />
            <Txt size={15} w={500} style={{ flex: 1 }}>{l.title ?? l.plan}</Txt>
            <Txt face="mono" size={11} color={C.muted}>{l.cardio ? `${+l.cardio.km.toFixed(1)} KM · ${clock(l.cardio.seconds)}` : l.activity ? `${Math.round(l.activity.minutes)} MIN` : `${l.done}/${l.total} SETS`}</Txt>
          </Tap>
        )) : <Txt size={14} color={C.dim} style={{ paddingVertical: 12 }}>Nothing logged yet. Your first session is worth 60 XP.</Txt>}
      </View>
      <Tap onPress={() => router.push('/progress')} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line3 }}>
        <Icon name="progress" size={20} color={accent} />
        <Txt size={15} style={{ flex: 1 }}>Progress report, measurements, photos</Txt>
        <Icon name="chevron" size={16} color={C.dim} />
      </Tap>
    </Screen>
  );
}
