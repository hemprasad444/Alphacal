// This week, Monday first: kept, missed, rest, today and still to come. Seven quiet marks on a line.
import { programWeek, week as calcWeek, weekNote, type DayStatus } from '@rei/shared';
import { View } from 'react-native';
import { SectionHeader, useWarn } from './fight';
import { Txt } from './ui';
import { F, SP } from '../lib/theme';
import { useStore } from '../state/store';

const SAY: Record<DayStatus, string> = { done: 'kept', missed: 'missed', rest: 'rest day', today: 'today', future: 'to come', none: 'before you started' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MARK = 14;

/** The mark for one day. Kept: a dab of your colour. Missed: an open ring in the warning tone. Today: a rice-paper ring around a dot. Rest: a short dash. To come: a faint ring. */
function DayMark({ status, accent, warn }: { status: DayStatus; accent: string; warn: string }) {
  const ring = (color: string, width = 1) => ({ width: MARK, height: MARK, borderRadius: MARK / 2, borderWidth: width, borderColor: color, alignItems: 'center' as const, justifyContent: 'center' as const });
  if (status === 'done') return <View style={{ width: MARK, height: MARK, borderRadius: MARK / 2, backgroundColor: accent }} />;
  if (status === 'missed') return <View style={ring(warn, 1.5)} />;
  if (status === 'today') return <View style={ring(F.chalk, 1.5)}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} /></View>;
  if (status === 'future') return <View style={ring(F.rule)} />;
  return <View style={{ width: 10, height: 1.5, borderRadius: 1, backgroundColor: status === 'rest' ? F.rule : F.rope }} />;
}

export function WeekStrip({ now }: { now: Date }) {
  const s = useStore();
  const { accent, sessionDone } = s;
  const warn = useWarn();
  const wk = calcWeek(s.history, sessionDone, now, s.program);
  return (
    <View>
      <SectionHeader title={`Week ${programWeek(s.startedOn, now)}`} meta={`${wk.done} kept · ${wk.missed} missed`} />
      <View style={{ flexDirection: 'row', marginTop: SP.md }}>
        {wk.days.map((d, i) => {
          const today = d.status === 'today';
          const quiet = d.status === 'rest' || d.status === 'future' || d.status === 'none';
          return (
            <View key={i} accessible accessibilityLabel={`${DAYS[i]}, ${d.type.toLowerCase()}, ${SAY[d.status]}`} style={{ flex: 1, alignItems: 'center', gap: SP.xs }}>
              <Txt face="mono" size={12} lh={1.35} color={today ? F.chalk : F.smoke}>{d.day}</Txt>
              <View style={{ alignSelf: 'stretch', height: 28, alignItems: 'center', justifyContent: 'center' }}>
                {/* The week's line runs behind the marks; each mark sits on a patch of the ground. */}
                <View pointerEvents="none" style={{ position: 'absolute', left: i === 0 ? '50%' : 0, right: i === wk.days.length - 1 ? '50%' : 0, top: 13.5, height: 1, backgroundColor: F.line }} />
                <View style={{ paddingHorizontal: 5, backgroundColor: F.arena }}>
                  <DayMark status={d.status} accent={accent} warn={warn} />
                </View>
              </View>
              <Txt face="label" w={today ? 600 : 400} size={12} lh={1.35} color={quiet ? F.smoke : F.chalk} numberOfLines={1}>{d.type}</Txt>
            </View>
          );
        })}
      </View>
      <Txt size={15} lh={1.45} color={F.smoke} style={{ marginTop: SP.md }}>{weekNote(wk, sessionDone)}</Txt>
    </View>
  );
}
