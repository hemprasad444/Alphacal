// Live voice: one continuous conversation with REI through the ElevenLabs agent (WebRTC).
// REI hears you while you talk, answers in about a second, and can be interrupted.
// Native module: only loaded in a development build (see app/live.tsx).
import { ConversationProvider, useConversationControls, useConversationMode, useConversationStatus } from '@elevenlabs/react-native';
import { AudioSession } from '@livekit/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hhmm, memoryKind, type Message, splitLead, stripTags, vowChange } from '@rei/shared';
import { Backdrop } from './Backdrop';
import { Core } from './Core';
import { IconButton, Label, Tap, Txt } from './ui';
import { takeVoiceSession } from '../lib/live';
import { newId } from '../lib/sync';
import { alpha, C, mix } from '../lib/theme';
import { type Store, useStore } from '../state/store';

type Params = Record<string, unknown>;

const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/** What REI can do mid-conversation. Each returns a line the agent hears back. */
function tools(store: RefObject<Store>) {
  return {
    log_meal: (p: Params) => {
      const name = String(p.name ?? '').trim().slice(0, 60);
      if (!name || !n(p.kcal)) return 'Not logged: need a meal name and calories.';
      store.current.repeatMeal({ time: hhmm(), name, kcal: n(p.kcal), p: n(p.protein), c: n(p.carbs), f: n(p.fat), src: 'ai' });
      return `Logged ${name}, ${n(p.kcal)} kcal.`;
    },
    update_vow: (p: Params) => {
      const change = vowChange(p.field, p.value);
      if (!change) return 'Not changed: that value isn’t valid.';
      store.current.setProfileField(change[0], change[1]);
      return `Updated ${change[0]} to ${change[1]}.`;
    },
    remember: (p: Params) => {
      const fact = String(p.fact ?? '').trim().slice(0, 160);
      if (fact.length < 3) return 'Nothing to remember.';
      store.current.remember(fact, memoryKind(p.kind));
      return 'Remembered.';
    },
    rebuild_program: (p: Params) => {
      store.current.rebuildProgram(typeof p.focus === 'string' ? p.focus.slice(0, 200) : undefined).catch(() => {});
      return 'Rebuilding this week now; it lands in under a minute.';
    },
  };
}

export default function LiveVoice() {
  return (
    <ConversationProvider>
      <Live />
    </ConversationProvider>
  );
}

function Live() {
  const s = useStore();
  const { accent } = s;
  const insets = useSafeAreaInsets();
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [lines, setLines] = useState<Message[]>([]);
  const [error, setError] = useState('');
  /** Bumped by "Try again" to start a fresh session. */
  const [attempt, setAttempt] = useState(0);
  // Tools, callbacks and the watchdog outlive renders, so they read through refs.
  const store = useRef<Store>(s);
  const statusNow = useRef(status);
  useEffect(() => {
    store.current = s;
    statusNow.current = status;
  });
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    const t0 = Date.now();
    const log = (step: string) => {
      if (__DEV__) console.log(`REI live +${Date.now() - t0}ms ${step}`);
    };
    // Never sit on "Connecting" forever: give up after 20 s and offer Try again.
    const watchdog = setTimeout(() => {
      if (!active || statusNow.current === 'connected') return;
      log(`gave up waiting (status ${statusNow.current})`);
      setError('Couldn’t connect to REI.');
      endSession();
    }, 20_000);
    (async () => {
      try {
        log('start');
        // Usually prepared already on the Talk screen; otherwise it loads alongside the steps below.
        const session = takeVoiceSession();
        session.catch(() => {});
        // Ask first: without the mic, iOS stops the call's audio both ways and nothing says why.
        const mic = await requestRecordingPermissionsAsync();
        log(`mic ${mic.granted ? 'allowed' : 'denied'}`);
        if (!mic.granted) {
          if (active) setError('Microphone access is off. Turn it on in Settings → REI → Microphone.');
          return;
        }
        // Call mode: other screens leave iOS in playback-only audio, which stops a call recording and playing.
        if (Platform.OS === 'ios') {
          await AudioSession.setAppleAudioConfiguration({ audioCategory: 'playAndRecord', audioCategoryOptions: ['allowBluetooth', 'defaultToSpeaker'], audioMode: 'voiceChat' });
          log('audio in call mode');
        }
        const data = await session;
        log('session ready');
        if (!active) return;
        startSession({
          conversationToken: data.token,
          connectionType: 'webrtc',
          overrides: { agent: { prompt: { prompt: data.prompt }, firstMessage: data.firstMessage }, tts: { voiceId: data.voiceId } },
          clientTools: tools(store),
          onMessage: ({ message, role }) => {
            const text = role === 'agent' ? stripTags(message) : message.trim();
            // A silent turn arrives as "..." from the user: nothing was said, so nothing to show or keep.
            if (/^[\s.…]*$/.test(text)) return;
            const m: Message = { id: newId(), role: role === 'agent' ? 'rei' : 'user', text, time: hhmm(), createdAt: Date.now() };
            setLines(l => [...l, m]);
            // Into the chat history too, like any other conversation.
            store.current.appendMessages([m]);
          },
          onStatusChange: ({ status: st }) => log(`status ${st}`),
          onConnect: () => log('connected'),
          onDisconnect: details => log(`disconnected ${JSON.stringify(details).slice(0, 200)}`),
          onError: message => {
            log(`error ${message}`);
            if (active) setError(String(message));
          },
        });
        log('connecting to ElevenLabs');
      } catch (e) {
        log(`failed ${e instanceof Error ? e.message : String(e)}`);
        if (active) setError(e instanceof Error ? e.message : 'Couldn’t start live voice.');
      }
    })();
    return () => {
      active = false;
      clearTimeout(watchdog);
      endSession();
    };
    // One session per attempt; the controls are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = () => {
    setError('');
    setAttempt(a => a + 1);
  };

  const connected = status === 'connected';
  const waking = !error && !connected;
  const label = error ? 'ERROR' : connected ? (isSpeaking ? 'SPEAKING' : 'LISTENING') : 'WAKING UP';

  return (
    <View style={{ flex: 1 }}>
      <Backdrop glow="bottom" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={14} w={600}>Live</Txt>
          <Txt face="jp" size={11} color={C.label}>声</Txt>
          <Label size={9} ls={0.14} color={accent}>{`· ${label}`}</Label>
        </View>
        <IconButton size={30} onPress={() => router.back()}>✕</IconButton>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 22, paddingBottom: 16, gap: 24 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {!lines.length ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            {waking ? (
              <View style={{ marginBottom: 18 }}>
                <Core size={120} speaking />
              </View>
            ) : null}
            <Txt size={24} ls={-0.025} align="center">{error ? 'Live voice didn’t start' : connected ? 'Just talk.' : 'REI is waking up…'}</Txt>
            <Txt size={15} lh={1.45} color={C.label} align="center">{error || (connected ? 'No tapping. Talk like you would to a friend, and cut in whenever you want.' : 'Getting your coach on the line.')}</Txt>
            {error ? (
              <Tap onPress={retry} style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 22, backgroundColor: accent }}>
                <Txt size={15} w={600} color={C.ink}>Try again</Txt>
              </Tap>
            ) : null}
          </View>
        ) : null}
        {lines.map(t => {
          if (t.role === 'user') {
            return (
              <View key={t.id} style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '82%', gap: 6 }}>
                <Label size={10} ls={0.14} color={C.faint}>{`YOU · ${t.time}`}</Label>
                <View style={{ paddingVertical: 11, paddingHorizontal: 15, borderRadius: 18, borderBottomRightRadius: 4, backgroundColor: mix(accent, '#0A0C0F', 0.14), borderWidth: 1, borderColor: alpha(accent, 0.28) }}>
                  <Txt size={16} lh={1.45}>{t.text}</Txt>
                </View>
              </View>
            );
          }
          const { lead, rest } = splitLead(t.text);
          return (
            <View key={t.id} style={{ maxWidth: '94%', gap: 8 }}>
              <Label size={10} ls={0.14}>{`REI · ${t.time}`}</Label>
              <Txt size={20} w={500} lh={1.3} ls={-0.02}>{lead}</Txt>
              {rest ? <Txt size={16} lh={1.55} color="#AEB4BC">{rest}</Txt> : null}
            </View>
          );
        })}
        {error && lines.length ? (
          <Tap onPress={retry}>
            <Label size={10} ls={0.12} color={accent}>{`ERROR · ${error} · TAP TO TRY AGAIN`}</Label>
          </Tap>
        ) : null}
      </ScrollView>

      <View style={{ alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>
        {/* While waking with nothing said yet, the big orb above is REI; don't show two. */}
        {waking && !lines.length ? null : <Core size={isSpeaking ? 76 : 64} speaking={connected} />}
        <Label size={9} color={isSpeaking ? accent : C.label}>{connected ? (isSpeaking ? 'TALK TO CUT IN' : 'I’M LISTENING') : label}</Label>
      </View>
    </View>
  );
}
