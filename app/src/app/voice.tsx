import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { CallHeader, CoachLine, CornerLine, inputType, LevelBars, SendArrow, SlabButton } from '../components/corner';
import { CutButton } from '../components/fight';
import { Dots, IconButton, Txt } from '../components/ui';
import { hhmm, type Message, speakVoice, splitLead, stripTags } from '@rei/shared';
import { C, HIT, SP } from '../lib/theme';
import { newSpeaker, premiumVoice, type Speaker, stopwatch, transcribe, voiceOffReason, warmVoice } from '../lib/voice';
import { useStore } from '../state/store';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * Voice mode. Signed in with the premium voice configured: tap the core, talk, tap
 * again; your words are transcribed and REI answers aloud, starting with its first
 * sentence while the rest is still streaming. Otherwise: type or use the keyboard's
 * dictation mic, and REI answers in the iPhone's voice.
 */
export default function Voice() {
  const s = useStore();
  const { accent, settings } = s;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [turns, setTurns] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  /** REI's reply while it streams in. */
  const [live, setLive] = useState('');
  /** Record-and-transcribe is available (signed in and the backend voice is set up). */
  const [canRecord, setCanRecord] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const speaker = useRef<Speaker | null>(null);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (s.cloud) premiumVoice().then(ok => alive.current && setCanRecord(ok)).catch(() => {});
    return () => {
      alive.current = false;
      speaker.current?.stop();
      Speech.stop();
    };
  }, [s.cloud]);

  const stopSpeaking = () => {
    speaker.current?.stop();
    speaker.current = null;
    Speech.stop();
  };

  const listen = async () => {
    if (phase === 'thinking') return;
    if (phase === 'speaking') {
      stopSpeaking();
      setPhase('idle');
      return;
    }
    if (!canRecord) {
      // Keyboard path: the iOS keyboard's mic does the dictation. Say why, so it isn't a mystery.
      const why = s.cloud ? voiceOffReason() : 'Voice needs a signed-in account.';
      if (why) setNotes(n => (n.some(x => x.text.startsWith('VOICE OFF')) ? n : [...n, { role: 'sys', text: `VOICE OFF · ${why} Using keyboard dictation.`, time: hhmm() }]));
      setTyping(true);
      setPhase('listening');
      setTimeout(() => input.current?.focus(), 50);
      return;
    }
    if (phase === 'listening') {
      setPhase('thinking');
      stopwatch.start();
      try {
        await recorder.stop();
        stopwatch.mark('recording saved');
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const text = recorder.uri ? await transcribe(recorder.uri) : '';
        stopwatch.mark(`transcript (${text.length} chars)`);
        if (text) await sendVoice(text);
        else setPhase('idle');
      } catch (e) {
        console.warn('REI: transcription failed', e);
        setPhase('idle');
        setTyping(true);
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setTyping(true);
      return;
    }
    stopSpeaking();
    void warmVoice();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('listening');
  };

  const sendVoice = async (text: string) => {
    text = text.trim();
    if (!text) return;
    stopSpeaking();
    setDraft('');
    input.current?.blur();
    const next = [...turns, { role: 'user' as const, text, time: hhmm() }];
    setTurns(next);
    setLive('');
    setPhase('thinking');
    const sp = settings.speak ? await newSpeaker(() => alive.current && setPhase(p => (p === 'speaking' ? 'idle' : p)), speakVoice(settings)) : null;
    speaker.current = sp;
    let streamed = false;
    stopwatch.mark('asking REI');
    const r = await s.voiceReply(next, d => {
      if (!alive.current) return;
      if (!streamed) stopwatch.mark('first words from REI');
      if (!streamed) setPhase(sp ? 'speaking' : 'thinking');
      streamed = true;
      setLive(cur => cur + d);
      sp?.push(d);
    });
    stopwatch.mark('REI finished writing');
    if (!alive.current) return;
    setLive('');
    setTurns(t => [...t, { role: 'rei', text: r.text, time: hhmm() }]);
    if (r.note) setNotes(n => [...n, { role: 'sys', text: r.note!, time: hhmm() }]);
    if (sp) {
      // On-device replies arrive whole rather than streamed.
      if (!streamed) sp.push(r.text);
      setPhase('speaking');
      sp.end();
    } else {
      setPhase('idle');
    }
  };

  const close = () => {
    stopSpeaking();
    if (phase === 'listening' && canRecord) recorder.stop().catch(() => {});
    const t = hhmm();
    // Signed in, each turn was already stored as it happened.
    if (turns.length && !s.cloud) s.appendMessages([...turns.map(x => ({ ...x, time: t })), ...notes]);
    // Voice is only opened from Talk, so going back lands on the chat with these turns in it.
    router.back();
  };

  const label = phase === 'listening' ? 'LISTENING' : phase === 'thinking' ? 'THINKING' : phase === 'speaking' ? 'SPEAKING' : 'READY';
  const hint = phase === 'listening'
    ? canRecord ? 'LISTENING · TAP TO SEND' : 'DICTATE OR TYPE · SEND'
    : phase === 'thinking' ? 'THINKING' : phase === 'speaking' ? 'TAP TO INTERRUPT' : 'TAP TO TALK';

  const onAir = phase === 'listening' || phase === 'speaking';
  const toggleTyping = () => {
    if (typing) {
      input.current?.blur();
      setTyping(false);
    } else {
      setTyping(true);
      setTimeout(() => input.current?.focus(), 50);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop glow="bottom" />
      <CallHeader title="Voice" status={label} live={onAir} top={insets.top} onClose={close} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: SP.lg, gap: SP.xl }}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {!turns.length && phase !== 'thinking' ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start', gap: SP.md }}>
              <Txt face="labelItalic" w={600} size={13} ls={0.14} color={accent}>REI · IN YOUR CORNER</Txt>
              <Txt face="display" size={40} lh={1.12}>{"WHAT'S ON YOUR MIND?"}</Txt>
              <Txt size={16} w={500} lh={1.45} color={C.smoke}>{"Hit the button and talk. I'll answer out loud."}</Txt>
            </View>
          ) : null}
          {turns.map((t, i) => {
            if (t.role === 'user') return <CornerLine key={i} text={t.text} time={t.time} />;
            const { lead, rest } = splitLead(t.text);
            return <CoachLine key={i} lead={lead} text={rest || undefined} time={t.time} maxWidth="94%" />;
          })}
          {notes.map((n, i) => (
            <Txt key={`n${i}`} face="label" w={600} size={13} ls={0.1} lh={1.35} color={C.smoke}>{n.text}</Txt>
          ))}
          {live ? <CoachLine text={stripTags(live)} maxWidth="94%" /> : null}
          {phase === 'thinking' && !live ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Txt face="labelItalic" w={600} size={12} ls={0.14} color={accent}>REI</Txt>
              <Dots />
            </View>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: Math.max(insets.bottom, SP.lg), gap: SP.md, borderTopWidth: 2, borderTopColor: C.line, backgroundColor: C.arena }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, display: typing ? 'flex' : 'none' }}>
            <View style={{ flex: 1, height: 52, backgroundColor: C.canvas, borderWidth: 2, borderColor: C.smoke, justifyContent: 'center', paddingHorizontal: SP.md }}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => sendVoice(draft)}
                onBlur={() => {
                  if (draft.trim()) return;
                  setTyping(false);
                  setPhase(p => (p === 'listening' && !canRecord ? 'idle' : p));
                }}
                placeholder="Tap the mic on your keyboard, or type"
                placeholderTextColor={C.dim}
                returnKeyType="send"
                keyboardAppearance="dark"
                accessibilityLabel="Message to REI"
                style={inputType(settings.textSize)}
              />
            </View>
            <SlabButton onPress={() => sendVoice(draft)} accessibilityLabel="Send">
              {ink => <SendArrow color={ink} />}
            </SlabButton>
          </View>
          <View style={{ alignItems: 'center' }}>
            <LevelBars active={onAir} height={28} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <IconButton size={HIT} onPress={toggleTyping} accessibilityLabel={typing ? 'Hide the keyboard' : 'Type instead'}>
              <Txt face="label" w={600} size={16} color={typing ? accent : C.chalk}>Aa</Txt>
            </IconButton>
            {/* The one action: talk, send, or cut REI off. */}
            <CutButton label={hint} icon="voice" disabled={phase === 'thinking'} onPress={() => void listen()} style={{ flex: 1 }} />
            <IconButton size={HIT} onPress={close} accessibilityLabel="Done, back to the chat">✓</IconButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
