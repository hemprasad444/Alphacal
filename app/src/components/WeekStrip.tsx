// This week, Monday first: kept, missed, rest, today and still to come.
import { programWeek, week as calcWeek, weekNote } from '@rei/shared';
import { View } from 'react-native';
import { Icon } from './icons';
import { Panel, Heading } from './manga';
import { Txt } from './ui';
import { alpha, C } from '../lib/theme';
import { useStore } from '../state/store';

export function WeekStrip({ now }: { now: Date }) {
  const s = useStore();
  const { accent, sessionDone } = s;
  const wk = calcWeek(s.history, sessionDone, now, s.program);
  return (
    <Panel acc={wk.missed ? C.alert : accent} tone={0.3}>
      <Heading icon="today" title={`Week ${programWeek(s.startedOn, now)}`} acc={accent} right={`${wk.done} DONE · ${wk.missed} MISSED`} />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
        {wk.days.map((d, i) => {
          const look = {
            done: { icon: 'check' as const, bg: alpha(accent, 0.18), border: accent, fg: accent, label: C.sub },
            missed: { icon: 'close' as const, bg: 'rgba(255,90,60,0.12)', border: C.alert, fg: C.alert, label: C.alert },
            rest: { icon: 'sleep' as const, bg: 'transparent', border: C.line3, fg: C.faint, label: C.faint },
            today: { icon: null, bg: alpha(accent, 0.06), border: accent, fg: accent, label: accent },
            future: { icon: null, bg: 'rgba(255,255,255,0.02)', border: C.line3, fg: C.muted, label: C.faint },
            none: { icon: null, bg: 'transparent', border: C.line, fg: C.ghost, label: C.ghost },
          }[d.status];
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
              <Txt face="mono" size={10} color={d.status === 'today' ? accent : C.dim}>{d.day}</Txt>
              <View style={{ width: '100%', maxWidth: 40, aspectRatio: 0.82, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: look.bg, borderWidth: 1.5, borderColor: look.border, transform: [{ skewX: '-6deg' }] }}>
                {look.icon ? <Icon name={look.icon} size={16} color={look.fg} strokeWidth={2} /> : d.status === 'today' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} /> : null}
              </View>
              <Txt face="mono" size={8.5} ls={0.08} color={look.label}>{d.type}</Txt>
            </View>
          );
        })}
      </View>
      <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 16 }}>{weekNote(wk, sessionDone)}</Txt>
    </Panel>
  );
}
