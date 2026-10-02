import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { Dots, IconButton, Label, Tap, Txt, VoiceGlyph } from '../components/ui';
import { integrity, nutrition, todaysPlan, trajectory, week } from '@rei/shared';
import { alpha, C, fontFamily, mix } from '../lib/theme';
import { useStore } from '../state/store';

const QUICK = ["I'm too tired today", 'Log a meal', "What's left today?", 'Change my goal'];

export default function Talk() {
  const s = useStore();
  const { settings, accent, profile } = s;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ draft?: string }>();
  const [draft, setDraft] = useState(params.draft ?? '');
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const tough = settings.tone === 'Tough love';
  const strong = settings.scenario === 'Strong week';
  const wk = week(s.history, s.sessionDone);
  const nu = nutrition(s.meals, s.activity);
  const slipping = !!todaysPlan() && !s.sessionDone && wk.missed > 0;
  const chips = [
    { t: `INTEGRITY ${integrity(wk)}%`, color: slipping ? C.alert : accent },
    { t: wk.missed ? `${wk.missed} MISSED` : `STREAK ${wk.done}`, color: wk.missed ? C.alert : accent },
    { t: `PROTEIN ${nu.protein}/${profile.protein}`, color: C.body },
    { t: `KCAL ${nu.kcal}/${profile.kcal}`, color: C.body },
    { t: `${trajectory(profile, wk.missed, new Date(), s.weighInsOrDemo).daysLeft} DAYS LEFT`, color: C.body },
  ];

  useEffect(() => {
    if (params.draft) setTimeout(() => input.current?.focus(), 350);
  }, [params.draft]);

  const send = (t: string) => {
    if (!t.trim()) return;
    setDraft('');
    s.send(t);
  };
  const quick = (t: string) => {
    if (t === 'Log a meal' || t === 'Change my goal') {
      setDraft(t === 'Log a meal' ? 'Just ate: ' : 'Change my goal: ');
      input.current?.focus();
    } else send(t);
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: alpha(s.theme.bg, 0.85) }}>
        <IconButton size={40} onPress={() => router.back()}>‹</IconButton>
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          {settings.avatar === 'Character in chat' ? (
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: accent, alignItems: 'center', justifyContent: 'center', shadowColor: accent, shadowOpacity: 0.4, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: mix(accent, '#0A0C0F', 0.16), alignItems: 'center', justifyContent: 'center' }}>
                <Txt face="jp" size={18} color={accent}>{s.theme.kanji}</Txt>
              </View>
            </View>
          ) : (
            <Core size={44} speaking={s.thinking} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt size={18} w={600} ls={-0.01}>REI</Txt>
            <Txt face="jp" size={13} color={C.label}>零</Txt>
          </View>
          <Label size={10} ls={0.14} color={accent} style={{ marginTop: 3 }}>{s.thinking ? 'READING YOU…' : tough ? 'TOUGH LOVE · 10/10' : 'COACH · 6/10'}</Label>
        </View>
        <IconButton size={40} onPress={() => router.push('/voice')}><VoiceGlyph color={C.body} /></IconButton>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }} contentContainerStyle={{ gap: 6, paddingVertical: 10, paddingHorizontal: 16 }}>
        {chips.map(c => (
          <View key={c.t} style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2 }}>
            <Label size={10} ls={0.12} color={c.color}>{c.t}</Label>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, paddingBottom: 12, gap: 16 }}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardDismissMode="interactive"
        >
          {s.messages.map((m, i) => {
            if (m.role === 'sys') {
              return (
                <View key={i} style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(accent, 0.45) }}>
                  <Label size={10} ls={0.14} color={accent}>{m.text}</Label>
                </View>
              );
            }
            if (m.role === 'user') {
              return (
                <View key={i} style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '80%', gap: 6 }}>
                  <Label size={10} ls={0.14} color={C.faint}>{`YOU · ${m.time}`}</Label>
                  <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderBottomRightRadius: 4, backgroundColor: mix(accent, '#0A0C0F', 0.14), borderWidth: 1, borderColor: alpha(accent, 0.28) }}>
                    <Txt size={16} lh={1.45}>{m.text}</Txt>
                  </View>
                </View>
              );
            }
            return (
              <View key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', gap: 6 }}>
                <Label size={10} ls={0.14} color={m.alert && !strong ? C.alert : C.label}>{m.alert && !strong ? `REI · CALL-OUT · ${m.time}` : `REI · ${m.time}`}</Label>
                <View style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 20, borderTopLeftRadius: 4, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: m.alert && !strong ? 'rgba(255,90,60,0.4)' : C.line2 }}>
                  <Txt size={16} lh={1.45} color={C.textSoft}>{m.text}</Txt>
                </View>
              </View>
            );
          })}
          {s.thinking ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Label size={10} ls={0.14}>REI IS READING YOU</Label>
              <Dots />
            </View>
          ) : null}
        </ScrollView>

        <View style={{ paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            {QUICK.map(t => (
              <Tap key={t} onPress={() => quick(t)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', backgroundColor: C.card }}>
                <Txt size={14} color={C.body}>{t}</Txt>
              </Tap>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
            <View style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 18 }}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => send(draft)}
                placeholder="Talk to REI…"
                placeholderTextColor={C.dim}
                returnKeyType="send"
                keyboardAppearance="dark"
                style={{ fontFamily: fontFamily(settings.font, 400), fontSize: 16, color: C.text }}
              />
            </View>
            {draft.trim() ? (
              <Tap onPress={() => send(draft)} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={20} w={600} color={C.ink}>↑</Txt>
              </Tap>
            ) : (
              <Tap onPress={() => router.push('/voice')} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } }}>
                <VoiceGlyph color={C.ink} big />
              </Tap>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
