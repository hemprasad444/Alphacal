// This week, Monday first: kept, missed, rest, today and still to come. Seven cut cells.
import { programWeek, week as calcWeek, weekNote, type DayStatus } from '@rei/shared';
import { View } from 'react-native';
import { CutBox } from './cut';
import { SectionHeader } from './fight';
import { Icon } from './icons';
import { Txt } from './ui';
import { F, onColor, SP } from '../lib/theme';
import { useStore } from '../state/store';

const SAY: Record<DayStatus, string> = { done: 'kept', missed: 'missed', rest: 'rest day', today: 'today', future: 'to come', none: 'before you started' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeekStrip({ now }: { now: Date }) {
  const s = useStore();
  const { accent, sessionDone } = s;
  const wk = calcWeek(s.history, sessionDone, now, s.program);
  return (
    <View>
      <SectionHeader title={`Week ${programWeek(s.startedOn, now)}`} meta={`${wk.done} kept · ${wk.missed} missed`} />
      <View style={{ flexDirection: 'row', gap: SP.xs, marginTop: SP.md }}>
        {wk.days.map((d, i) => {
          // Kept: filled in your colour. Missed: the far corner took it. Today: chalk outline. The rest stay quiet.
          const look = {
            done: { icon: 'check' as const, fill: accent, stroke: undefined, fg: onColor(accent), label: F.chalk },
            missed: { icon: 'close' as const, fill: F.rivalField, stroke: F.rival, fg: F.rival, label: F.rival },
            rest: { icon: 'sleep' as const, fill: F.arena, stroke: F.rope, fg: F.smoke, label: F.smoke },
            today: { icon: null, fill: F.canvas, stroke: F.chalk, fg: F.chalk, label: F.chalk },
            future: { icon: null, fill: F.canvas, stroke: F.rope, fg: F.smoke, label: F.smoke },
            none: { icon: null, fill: F.arena, stroke: F.rope, fg: F.smoke, label: F.smoke },
          }[d.status];
          return (
            <View key={i} accessible accessibilityLabel={`${DAYS[i]}, ${d.type.toLowerCase()}, ${SAY[d.status]}`} style={{ flex: 1, alignItems: 'center', gap: SP.xs }}>
              <Txt face="label" w={600} size={12} ls={0.12} color={d.status === 'today' ? F.chalk : F.smoke}>{d.day}</Txt>
              <CutBox fill={look.fill} stroke={look.stroke} style={{ alignSelf: 'stretch', height: 40, alignItems: 'center', justifyContent: 'center' }}>
                {/* In a View so it stacks above the cut shape on the web too. */}
                {look.icon ? <View><Icon name={look.icon} size={16} color={look.fg} tint={0} strokeWidth={2.4} /></View> : d.status === 'today' ? <View style={{ width: 8, height: 8, backgroundColor: accent }} /> : null}
              </CutBox>
              <Txt face="label" w={600} size={12} ls={0.06} color={look.label} numberOfLines={1}>{d.type}</Txt>
            </View>
          );
        })}
      </View>
      <Txt size={14} lh={1.45} color={F.smoke} style={{ marginTop: SP.md }}>{weekNote(wk, sessionDone)}</Txt>
    </View>
  );
}
