import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { Dots, IconButton, Label, Tap, Txt } from '../components/ui';
import { hhmm, type Message, splitLead } from '@rei/shared';
import { alpha, C, fontFamily, mix } from '../lib/theme';
import { useStore } from '../state/store';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * Voice mode. REI speaks replies aloud with the system voice. Input is typed or
 * dictated with the keyboard mic until on-device speech recognition is added
 * (that needs a development build, not Expo Go).
 */
export default function Voice() {
  const s = useStore();
  const { accent, settings } = s;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [turns, setTurns] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      Speech.stop();
    };
  }, []);

  const listen = () => {
    if (phase === 'thinking') return;
    if (phase === 'speaking') {
      Speech.stop();
      setPhase('idle');
      return;
    }
    setPhase('listening');
    input.current?.focus();
  };

  const sendVoice = async (text: string) => {
    text = text.trim();
    if (!text || phase === 'thinking') return;
    Speech.stop();
    setDraft('');
    input.current?.blur();
    const next = [...turns, { role: 'user' as const, text, time: hhmm() }];
    setTurns(next);
    setPhase('thinking');
    const r = await s.voiceReply(next);
    if (!alive.current) return;
    setTurns(t => [...t, { role: 'rei', text: r.text, time: hhmm() }]);
    if (r.note) setNotes(n => [...n, { role: 'sys', text: r.note!, time: hhmm() }]);
    if (settings.speak) {
      setPhase('speaking');
      const done = () => {
        if (alive.current) setPhase(p => (p === 'speaking' ? 'idle' : p));
      };
      Speech.speak(r.text, { rate: 1.02, pitch: 1.05, onDone: done, onStopped: done, onError: done });
    } else {
      setPhase('idle');
    }
  };

  const close = () => {
    Speech.stop();
    const t = hhmm();
    // Signed in, each turn was already stored as it happened.
    if (turns.length && !s.cloud) s.appendMessages([...turns.map(x => ({ ...x, time: t })), ...notes]);
    // Voice is only opened from Talk, so going back lands on the chat with these turns in it.
    router.back();
  };

  const label = phase === 'listening' ? 'LISTENING' : phase === 'thinking' ? 'THINKING' : phase === 'speaking' ? 'SPEAKING' : 'READY';
  const hint = phase === 'listening' ? 'DICTATE OR TYPE · SEND' : phase === 'thinking' ? 'THINKING' : phase === 'speaking' ? 'TAP TO INTERRUPT' : 'TAP TO TALK';

  return (
    <View style={{ flex: 1 }}>
      <Backdrop glow="bottom" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size={14} w={600}>Voice</Txt>
          <Txt face="jp" size={11} color={C.label}>声</Txt>
          <Label size={9} ls={0.14} color={accent}>{`· ${label}`}</Label>
        </View>
        <IconButton size={30} onPress={close}>✕</IconButton>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 22, paddingBottom: 16, gap: 24 }}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {!turns.length && phase !== 'thinking' ? (
            <View style={{ marginVertical: 'auto', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              <Txt size={24} ls={-0.025} align="center">{"What's on your mind?"}</Txt>
              <Txt size={15} lh={1.45} color={C.label} align="center">{"Tap the core and talk. I'll answer out loud."}</Txt>
            </View>
          ) : null}
          {turns.map((t, i) => {
            if (t.role === 'user') {
              return (
                <View key={i} style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '82%', gap: 6 }}>
                  <Label size={10} ls={0.14} color={C.faint}>{`YOU · ${t.time}`}</Label>
                  <View style={{ paddingVertical: 11, paddingHorizontal: 15, borderRadius: 18, borderBottomRightRadius: 4, backgroundColor: mix(accent, '#0A0C0F', 0.14), borderWidth: 1, borderColor: alpha(accent, 0.28) }}>
                    <Txt size={16} lh={1.45}>{t.text}</Txt>
                  </View>
                </View>
              );
            }
            const { lead, rest } = splitLead(t.text);
            return (
              <View key={i} style={{ maxWidth: '94%', gap: 8 }}>
                <Label size={10} ls={0.14}>{`REI · ${t.time}`}</Label>
                <Txt size={20} w={500} lh={1.3} ls={-0.02}>{lead}</Txt>
                {rest ? <Txt size={16} lh={1.55} color="#AEB4BC">{rest}</Txt> : null}
              </View>
            );
          })}
          {phase === 'thinking' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Label size={10} ls={0.14}>REI</Label>
              <Dots />
            </View>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 16), gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, display: phase === 'listening' ? 'flex' : 'none' }}>
            <View style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', paddingHorizontal: 16 }}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => sendVoice(draft)}
                onBlur={() => !draft.trim() && setPhase(p => (p === 'listening' ? 'idle' : p))}
                placeholder="Tap the mic on your keyboard, or type"
                placeholderTextColor={C.dim}
                returnKeyType="send"
                keyboardAppearance="dark"
                style={{ fontFamily: fontFamily(settings.font, 400), fontSize: 16, color: C.text }}
              />
            </View>
            <Tap onPress={() => sendVoice(draft)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={19} w={600} color={C.ink}>↑</Txt>
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton size={44} onPress={() => (phase === 'listening' ? input.current?.blur() : listen())}>
              <Txt size={13} w={500} color={C.body}>Aa</Txt>
            </IconButton>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Tap onPress={listen} haptic style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
                <Core size={phase === 'listening' ? 68 : 58} speaking={phase === 'speaking' || phase === 'listening'} />
              </Tap>
              <Label size={9} color={phase === 'listening' ? accent : C.label}>{hint}</Label>
            </View>
            <IconButton size={44} onPress={close}>✓</IconButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
