// REI: personality, whose voice REI speaks with (the corner team), and how conversations work.
import { CHARACTERS, characterOf, hasVoice, type Tone } from '@rei/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { LevelBars, readable } from '../components/corner';
import { CutShape } from '../components/cut';
import { RoundStamp, SectionHeader, useWarn } from '../components/fight';
import { Icon } from '../components/icons';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { C, onColor, SP } from '../lib/theme';
import { playGreeting, prefetchGreetings } from '../lib/greetings';
import { useStore } from '../state/store';

const TONES: { id: Tone; title: string; sub: string; level: string }[] = [
  { id: 'Tough love', title: 'Tough love', sub: 'Calls you out. No negotiating.', level: '10/10' },
  { id: 'Coach', title: 'Coach', sub: 'Firm, measured, technical.', level: '6/10' },
  { id: 'Bro', title: 'Bro', sub: 'Your gym bro. Swears back, hypes you up.', level: 'Hype' },
];

export default function ReiSettings() {
  const s = useStore();
  const { settings, accent } = s;
  const warn = useWarn();
  const [playing, setPlaying] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const preview = useRef<{ stop: () => void } | null>(null);
  /** Each tap gets a number; a preview that finishes loading after a newer tap is dropped. */
  const seq = useRef(0);
  useEffect(() => () => preview.current?.stop(), []);
  // Each partner's hello with your name, ready before you tap.
  const name = s.profile.name.trim();
  useEffect(() => {
    void prefetchGreetings(name);
  }, [name]);

  const stop = () => {
    seq.current++;
    preview.current?.stop();
    preview.current = null;
    setPlaying(null);
  };

  const pick = async (id: string) => {
    // Tapping the one that's talking just stops it.
    if (playing === id) return stop();
    stop();
    s.setOpt('character', id);
    const c = characterOf(id);
    if (!hasVoice(c)) {
      setNote(`${c.name}’s voice is on its way. REI speaks in its own voice until then.`);
      return;
    }
    setNote('');
    const mine = seq.current;
    setPlaying(id);
    try {
      const speaker = await playGreeting(id, s.profile.name, settings.voice, () => mine === seq.current && setPlaying(null));
      if (mine !== seq.current) {
        speaker.stop();
        return;
      }
      preview.current = speaker;
      if (!speaker.premium) setNote('Premium voice is off right now, so this preview used the iPhone’s voice.');
    } catch {
      if (mine === seq.current) setPlaying(null);
    }
  };

  return (
    <Screen tabs={false}>
      <SubHeader title="REI" onBack={() => router.back()} />

      <SectionHeader title="Personality" meta="How hard REI pushes" style={{ marginTop: SP.xl }} />
      <View accessibilityRole="radiogroup" style={{ gap: SP.xs, marginTop: SP.md }}>
        {TONES.map(t => {
          const on = settings.tone === t.id;
          return (
            <Tap key={t.id} onPress={() => s.setOpt('tone', t.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${t.title}. ${t.sub}`}>
              <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas, borderWidth: 2, borderColor: on ? accent : C.canvas }}>
                <Txt face="display" lean={false} size={20} lh={1.2} color={on ? accent : C.smoke} style={{ minWidth: 48 }}>{t.level.toUpperCase()}</Txt>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Txt face="display" size={22} lh={1.2}>{t.title.toUpperCase()}</Txt>
                  <Txt size={13} w={500} color={C.smoke}>{t.sub}</Txt>
                </View>
                {on ? <RoundStamp label="On" tone="accent" size="sm" /> : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <SectionHeader title="Voice" meta={playing ? 'Playing…' : 'Corner team'} style={{ marginTop: SP.huge }} />
      <Txt size={13} w={500} lh={1.4} color={C.smoke} style={{ marginTop: SP.sm }}>Who REI sounds like, on calls and spoken replies. Separate from your world.</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: SP.xs, marginTop: SP.md }}>
        {CHARACTERS.map(c => {
          const on = (settings.character || 'rei') === c.id;
          const voiced = hasVoice(c);
          return (
            <Tap key={c.id} onPress={() => void pick(c.id)} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={`${c.name}, ${c.series}. ${c.line}${voiced ? '' : ' Voice coming soon.'}${playing === c.id ? ' Playing.' : ''}`}>
              <View style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, backgroundColor: C.canvas, borderWidth: 2, borderColor: on ? accent : C.canvas }}>
                <View style={{ width: 52, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <CutShape width={52} height={40} fill={c.acc} style={{ position: 'absolute', left: 0, top: 0 }} />
                  <View><Icon name={c.icon} size={24} color={onColor(c.acc)} tint={0.2} strokeWidth={2} /></View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
                    <Txt face="display" size={22} lh={1.2}>{c.name.toUpperCase()}</Txt>
                    <Txt face="label" w={600} size={12} ls={0.12} color={readable(c.acc)} numberOfLines={1} style={{ flexShrink: 1 }}>{c.series.toUpperCase()}</Txt>
                  </View>
                  <Txt size={13} w={500} lh={1.35} color={C.smoke} numberOfLines={2}>{c.line}</Txt>
                </View>
                {playing === c.id ? <LevelBars active color={readable(c.acc)} height={24} /> : !voiced ? <RoundStamp label="Soon" tone="outline" size="sm" /> : on ? <RoundStamp label="On" tone="accent" size="sm" /> : null}
              </View>
            </Tap>
          );
        })}
      </View>
      <View accessibilityLiveRegion="polite">
        <Txt size={13} w={500} lh={1.4} color={note ? warn : C.smoke} style={{ marginTop: SP.sm }}>{note || 'Tap a partner to hear them say hello; tap again to stop.'}</Txt>
      </View>

      <SectionHeader title="Conversation" style={{ marginTop: SP.huge }} />
      <Card style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
        <Row title="Speak replies aloud" sub="In voice mode" right={<Toggle on={settings.speak} onPress={() => s.setOpt('speak', !settings.speak)} accessibilityLabel="Speak replies aloud" />} />
        <Row title="In the chat header" sub="Your character crest or REI’s core" right={<Segmented value={settings.avatar} options={[['Character in chat', 'Crest'], ['Core only', 'Core']]} onChange={v => s.setOpt('avatar', v)} />} />
        <Row title="Check-ins" sub="REI messages you when you slip" right={<Toggle on={settings.nudge} onPress={() => s.setOpt('nudge', !settings.nudge)} accessibilityLabel="Check-ins" />} last />
      </Card>
    </Screen>
  );
}
