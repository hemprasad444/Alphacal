// REI: personality, whose voice REI speaks with, and how conversations work.
import { CHARACTERS, characterOf, hasVoice, type Tone } from '@rei/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from '../components/icons';
import { Heading, Panel, Stamp } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Row, Segmented, Tap, Toggle, Txt } from '../components/ui';
import { alpha, C } from '../lib/theme';
import { playGreeting, prefetchGreetings } from '../lib/greetings';
import { useStore } from '../state/store';

const TONES: { id: Tone; icon: IconKey; title: string; sub: string }[] = [
  { id: 'Tough love', icon: 'strength', title: 'Tough love', sub: '10/10. Calls you out. No negotiating.' },
  { id: 'Coach', icon: 'train', title: 'Coach', sub: 'Firm, measured, technical.' },
  { id: 'Bro', icon: 'fist', title: 'Bro', sub: 'Your gym bro. Swears back, hypes you up.' },
];

export default function ReiSettings() {
  const s = useStore();
  const { settings, accent } = s;
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

      <Heading icon="rei" title="Personality" acc={accent} style={{ marginTop: 26 }} />
      <View style={{ gap: 10, marginTop: 14 }}>
        {TONES.map(t => {
          const on = settings.tone === t.id;
          return (
            <Tap key={t.id} onPress={() => s.setOpt('tone', t.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: on ? alpha(accent, 0.1) : '#0D0F13' }}>
                <Icon name={t.icon} size={26} color={on ? accent : C.muted} />
                <View style={{ flex: 1 }}>
                  <Txt size={16} w={600}>{t.title}</Txt>
                  <Txt size={13} color={C.sub}>{t.sub}</Txt>
                </View>
                {on ? <Icon name="check" size={20} color={accent} strokeWidth={2.2} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <Heading icon="voice" title="Voice" acc={accent} right={playing ? 'PLAYING…' : undefined} style={{ marginTop: 32 }} />
      <Txt size={13} color={C.sub} style={{ marginTop: 8 }}>Who REI sounds like, on calls and spoken replies. Separate from your theme.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {CHARACTERS.map(c => {
          const on = (settings.character || 'rei') === c.id;
          return (
            <Tap key={c.id} onPress={() => void pick(c.id)} style={{ width: '48%', flexGrow: 1 }}>
              <View style={{ height: 150, borderRadius: 12, borderWidth: 1.5, borderColor: on ? c.acc : C.line3, backgroundColor: on ? alpha(c.acc, 0.1) : '#0D0F13', padding: 14, justifyContent: 'space-between', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -18, bottom: -18, opacity: on ? 0.35 : 0.12 }}>
                  <Icon name={c.icon} size={100} color={c.acc} tint={0.2} strokeWidth={1.1} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.acc }} />
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.acc2 }} />
                  </View>
                  {hasVoice(c) ? (on ? <Icon name="voice" size={16} color={c.acc} /> : null) : <Stamp text="Soon" color={C.muted} tilt={0} size={8.5} />}
                </View>
                <View style={{ gap: 2 }}>
                  <Txt size={18} w={600}>{c.name}</Txt>
                  <Txt face="mono" size={9.5} ls={0.12} color={on ? c.acc : C.muted}>{c.series.toUpperCase()}</Txt>
                  <Txt size={12} color={C.sub} numberOfLines={2} style={{ marginTop: 4 }}>{c.line}</Txt>
                </View>
              </View>
            </Tap>
          );
        })}
      </View>
      <Txt size={12} color={note ? C.warn : C.faint} style={{ marginTop: 10 }}>{note || 'Tap a partner to hear them say hello; tap again to stop.'}</Txt>

      <Heading icon="voice" title="Conversation" acc={accent} style={{ marginTop: 32 }} />
      <Panel acc={accent} tone={0.2} dots={false} style={{ marginTop: 14 }} pad={16}>
        <Row title="Speak replies aloud" sub="In voice mode" right={<Toggle on={settings.speak} onPress={() => s.setOpt('speak', !settings.speak)} />} />
        <Row title="In the chat header" sub="Your character crest or REI’s core" right={<Segmented value={settings.avatar} options={[['Character in chat', 'Crest'], ['Core only', 'Core']]} onChange={v => s.setOpt('avatar', v)} />} />
        <Row title="Live calls run on" sub={settings.liveEngine === 'livekit' ? 'REI’s own engine · Fish voices' : 'ElevenLabs agent'} right={<Segmented value={settings.liveEngine} options={[['livekit', 'REI'], ['elevenlabs', 'ElevenLabs']]} onChange={v => s.setOpt('liveEngine', v)} />} />
        <Row title="Check-ins" sub="REI messages you when you slip" right={<Toggle on={settings.nudge} onPress={() => s.setOpt('nudge', !settings.nudge)} />} last />
      </Panel>
    </Screen>
  );
}
