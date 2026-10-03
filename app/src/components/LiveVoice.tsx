// Live voice: one continuous conversation with REI over WebRTC, on one of two engines:
// the ElevenLabs agent, or our own LiveKit agent (voice-agent/: Deepgram, OpenRouter, Fish voice).
// REI hears you while you talk, answers in about a second, and can be interrupted.
// Native module: only loaded in a development build (see app/live.tsx).
// Importing the ElevenLabs SDK also registers LiveKit's WebRTC globals, which the LiveKit engine relies on.
import { ConversationProvider, useConversationControls, useConversationMode, useConversationStatus } from '@elevenlabs/react-native';
import { AudioSession } from '@livekit/react-native';
import { Room, RoomEvent, type Participant } from 'livekit-client';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hhmm, mealIndex, memoryKind, type Message, parseWorkout, splitLead, stripTags, todayLine, vowChange } from '@rei/shared';
import { Backdrop } from './Backdrop';
import { Core, Wave } from './Core';
import { Icon } from './icons';
import { IconButton, Label, Tap, Txt } from './ui';
import { takeVoiceSession, type VoiceSession } from '../lib/live';
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
      const meal = { time: hhmm(), name, kcal: n(p.kcal), p: n(p.protein), c: n(p.carbs), f: n(p.fat), src: 'ai' as const };
      store.current.repeatMeal(meal);
      // The agent's prompt was written at the start; hand it the new totals so it never works from stale numbers.
      return `Logged ${name}, ${meal.kcal} kcal. ${todayLine(store.current.profile, [...store.current.meals, meal])}`;
    },
    remove_meal: (p: Params) => {
      const meals = store.current.meals;
      const i = mealIndex(meals, String(p.name ?? ''));
      if (i < 0) return `No meal like that today. Today's meals: ${meals.map(m => m.name).join(', ') || 'none'}.`;
      const gone = meals[i];
      store.current.removeMeal(i);
      return `Removed ${gone.name}. ${todayLine(store.current.profile, meals.filter((_, k) => k !== i))}`;
    },
    log_workout: (p: Params) => {
      const w = parseWorkout(p);
      if (!w) return 'Not logged: need what they did and for how long.';
      store.current.logWorkout(w);
      return `Logged ${w.name || w.kind}, ${w.minutes} min${w.km ? `, ${w.km} km` : ''}. Today counts as trained.`;
    },
    update_vow: (p: Params) => {
      const change = vowChange(p.field, p.value);
      if (!change) return 'Not changed: that value isn’t valid.';
      store.current.setProfileField(change[0], change[1]);
      return `Updated ${change[0]} to ${change[1]}. ${todayLine({ ...store.current.profile, [change[0]]: change[1] }, store.current.meals)}`;
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

type LiveKitSession = Extract<VoiceSession, { engine: 'livekit' }>;

interface Call {
  log: (step: string) => void;
  /**
   * Text from either side as it arrives, so it shows live: `key` ties the drafts of one line together,
   * and `final` marks the finished line, the one that's kept in the chat.
   */
  onText: (role: 'user' | 'agent', key: string, text: string, final: boolean) => void;
  /** REI's state: on the line yet, and talking right now. */
  onState: (connected: boolean, speaking: boolean) => void;
  onError: (message: string) => void;
}

/**
 * Joins the LiveKit room; the token dispatches the REI agent into it. REI's tools reach the phone as
 * RPCs, transcripts arrive as text streams, and REI's state rides on the agent's attributes.
 * Returns the hang-up.
 */
async function startLiveKit(session: LiveKitSession, tools: Record<string, (p: Params) => string>, call: Call): Promise<() => void> {
  const room = new Room();
  for (const [name, run] of Object.entries(tools)) {
    room.registerRpcMethod(name, async ({ payload }) => {
      let p: Params = {};
      try {
        p = JSON.parse(payload || '{}') as Params;
      } catch {
        // Bad arguments: the tool says what it needed.
      }
      call.log(`tool ${name}`);
      return run(p);
    });
  }
  room.registerTextStreamHandler('lk.transcription', async (reader, from) => {
    const attrs = reader.info.attributes ?? {};
    const key = attrs['lk.segment_id'] || reader.info.id;
    if (from.identity === room.localParticipant.identity) {
      // What you're saying: each draft is its own short stream holding the whole line so far.
      call.onText('user', key, await reader.readAll(), attrs['lk.transcription_final'] === 'true');
      return;
    }
    // REI's reply streams word by word, in step with the audio.
    let text = '';
    for await (const chunk of reader) {
      text += chunk;
      call.onText('agent', key, text, false);
    }
    call.onText('agent', key, text, true);
  });
  const agentState = (p: Participant) => {
    const st = p.attributes['lk.agent.state'];
    if (!st) return;
    call.log(`agent ${st}`);
    call.onState(st === 'listening' || st === 'thinking' || st === 'speaking', st === 'speaking');
  };
  room.on(RoomEvent.ParticipantAttributesChanged, (_changed, p) => {
    if (p !== room.localParticipant) agentState(p);
  });
  let leaving = false;
  room.on(RoomEvent.Disconnected, reason => {
    call.log(`disconnected ${String(reason)}`);
    call.onState(false, false);
    // Hung up from REI's side (time limit, or the agent fell over), not by leaving this screen.
    if (!leaving) call.onError('Call ended.');
  });
  await AudioSession.startAudioSession();
  await room.connect(session.url, session.token);
  call.log('in the room');
  await room.localParticipant.setMicrophoneEnabled(true);
  call.log('mic live');
  return () => {
    leaving = true;
    room.disconnect().catch(() => {});
    AudioSession.stopAudioSession().catch(() => {});
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
  const { isSpeaking: elevenSpeaking } = useConversationMode();
  /** The LiveKit engine's state; the ElevenLabs engine's comes from its hooks. */
  const [lk, setLk] = useState<{ on: boolean; connected: boolean; speaking: boolean }>({ on: false, connected: false, speaking: false });
  const connected = lk.on ? lk.connected : status === 'connected';
  const isSpeaking = lk.on ? lk.speaking : elevenSpeaking;
  const [lines, setLines] = useState<Message[]>([]);
  const [error, setError] = useState('');
  /** Bumped by "Try again" to start a fresh session. */
  const [attempt, setAttempt] = useState(0);
  // Tools, callbacks and the watchdog outlive renders, so they read through refs.
  const store = useRef<Store>(s);
  const connectedNow = useRef(connected);
  useEffect(() => {
    store.current = s;
    connectedNow.current = connected;
  });
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    let hangUp: (() => void) | null = null;
    const t0 = Date.now();
    const log = (step: string) => {
      if (__DEV__) console.log(`REI live +${Date.now() - t0}ms ${step}`);
    };
    // Never sit on "Connecting" forever: give up after 20 s and offer Try again.
    const watchdog = setTimeout(() => {
      if (!active || connectedNow.current) return;
      log('gave up waiting');
      setError('Couldn’t connect to REI.');
      hangUp?.();
      hangUp = null;
      endSession();
    }, 20_000);
    (async () => {
      try {
        log('start');
        // Usually prepared already on the Talk screen; otherwise it loads alongside the steps below.
        const session = takeVoiceSession(store.current.settings.liveEngine);
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
        log(`session ready (${data.engine ?? 'elevenlabs'})`);
        if (!active) return;
        const done = new Set<string>();
        const addText = (role: 'user' | 'agent', key: string, message: string, final: boolean) => {
          const id = `live-${key}`;
          // A late draft can land after its line is finished; the finished text wins.
          if (done.has(id)) return;
          if (final) done.add(id);
          const text = role === 'agent' ? stripTags(message) : message.trim();
          // A silent turn arrives as "..." from the user: nothing was said, so nothing to show or keep.
          if (/^[\s.…]*$/.test(text)) {
            if (final) setLines(l => l.filter(m => m.id !== id));
            return;
          }
          const who = role === 'agent' ? 'rei' : 'user';
          setLines(l => {
            const i = l.findIndex(m => m.id === id);
            if (i < 0) return [...l, { id, role: who, text, time: hhmm(), createdAt: Date.now() }];
            const next = [...l];
            next[i] = { ...l[i], text };
            return next;
          });
          // Finished lines go into the chat history too, like any other conversation.
          if (final) store.current.appendMessages([{ id: newId(), role: who, text, time: hhmm(), createdAt: Date.now() }]);
        };
        if (data.engine === 'livekit') {
          setLk({ on: true, connected: false, speaking: false });
          const stop = await startLiveKit(data, tools(store), {
            log,
            onText: addText,
            onState: (c, sp) => {
              if (active) setLk({ on: true, connected: c, speaking: sp });
            },
            onError: message => {
              if (active) setError(message);
            },
          });
          if (active) hangUp = stop;
          else stop();
          return;
        }
        startSession({
          conversationToken: data.token,
          connectionType: 'webrtc',
          overrides: { agent: { prompt: { prompt: data.prompt }, firstMessage: data.firstMessage }, tts: { voiceId: data.voiceId } },
          clientTools: tools(store),
          onMessage: ({ message, role }) => addText(role === 'agent' ? 'agent' : 'user', newId(), message, true),
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
      hangUp?.();
      endSession();
    };
    // One session per attempt; the controls are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const retry = () => {
    setError('');
    setLk({ on: false, connected: false, speaking: false });
    setAttempt(a => a + 1);
  };

  const waking = !error && !connected;
  const label = error ? 'ERROR' : connected ? (isSpeaking ? 'SPEAKING' : 'LISTENING') : 'WAKING UP';

  return (
    <View style={{ flex: 1 }}>
      <Backdrop glow="bottom" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={14} w={600}>Live</Txt>
          <Icon name="voice" size={14} color={C.label} />
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
        {waking && !lines.length ? null : <Wave size={isSpeaking ? 76 : 64} active={connected} />}
        <Label size={9} color={isSpeaking ? accent : C.label}>{connected ? (isSpeaking ? 'TALK TO CUT IN' : 'I’M LISTENING') : label}</Label>
      </View>
    </View>
  );
}
