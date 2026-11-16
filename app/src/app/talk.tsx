// Talk: the chat with REI. REI's lines are set in Mincho beside the red seal; yours sit in a quiet
// card on the right. The strip under the header is the day REI is reading from.
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { memo, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { CoachLine, CornerLine, inputType, RingNote, SendArrow, SlabButton } from '../components/corner';
import { useWarn } from '../components/fight';
import { Icon } from '../components/icons';
import { Dots, IconButton, Tap, Txt, VoiceGlyph } from '../components/ui';
import { characterOf, integrity, type Message, nutrition, todaysPlan, trajectory, week } from '@rei/shared';
import { liveVoiceAvailable, prepareVoiceSession } from '../lib/live';
import { C, HIT, RADIUS, SP } from '../lib/theme';
import { useLiveReply, useStore } from '../state/store';

const QUICK = ["I'm too tired today", 'Log a meal', "What's left today?", 'Change my goal'];

export default function Talk() {
  const s = useStore();
  const { settings, accent, profile } = s;
  const live = useLiveReply();
  const messages = live && live.text && !s.messages.some(m => m.id === live.id) ? [...s.messages, live] : s.messages;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ draft?: string }>();
  const [draft, setDraft] = useState(params.draft ?? '');
  const input = useRef<TextInput>(null);
  // Get a live voice session ready now, so tapping the voice button connects straight away.
  useEffect(() => {
    if (s.cloud && liveVoiceAvailable) prepareVoiceSession();
  }, [s.cloud]);
  const list = useRef<FlashListRef<Message>>(null);

  const tough = settings.tone !== 'Coach';
  const strong = settings.scenario === 'Strong week';
  const wk = week(s.history, s.sessionDone, new Date(), s.program);
  const nu = nutrition(s.meals, s.activity);
  const slipping = !!todaysPlan(new Date(), s.program) && !s.sessionDone && wk.missed > 0;
  const warn = useWarn();
  const chips = [
    { t: `Integrity ${integrity(wk)}%`, color: slipping ? warn : accent },
    // Sessions done this week ("streak" means days logged in a row elsewhere in the app).
    { t: wk.missed ? `${wk.missed} missed` : `${wk.done} done this week`, color: wk.missed ? warn : accent },
    { t: `Protein ${nu.protein}/${profile.protein} g`, color: C.smoke },
    { t: `${nu.kcal}/${profile.kcal} kcal`, color: C.smoke },
    { t: `${trajectory(profile, wk.missed, new Date(), s.weighInsOrDemo).daysLeft} days left`, color: C.smoke },
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
  const toVoice = () => router.push(s.cloud && liveVoiceAvailable ? '/live' : '/voice');
  const typed = !!draft.trim();

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: SP.xxl, paddingBottom: SP.sm, flexDirection: 'row', alignItems: 'center', gap: SP.md, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.arena }}>
        <IconButton size={HIT} onPress={() => router.back()} accessibilityLabel="Back">‹</IconButton>
        <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
          {settings.avatar === 'Character in chat' ? (
            <View style={{ width: HIT, height: HIT, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={characterOf(settings.character).icon} size={24} color={accent} tint={0} strokeWidth={1.7} />
            </View>
          ) : (
            <Core size={44} speaking={s.thinking} />
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View accessibilityRole="header">
            <Txt face="display" exact size={24} lh={1.25}>REI</Txt>
          </View>
          <Txt face="mono" size={12} lh={1.35} color={s.thinking ? accent : C.smoke} numberOfLines={1}>{s.thinking ? 'Reading…' : settings.tone === 'Bro' ? 'Bro · on your side' : tough ? 'Tough love · 10/10' : 'Coach · 6/10'}</Txt>
        </View>
        <IconButton size={HIT} onPress={toVoice} accessibilityLabel="Talk to REI out loud"><VoiceGlyph color={C.chalk} /></IconButton>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.line }} contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.sm, paddingHorizontal: SP.xxl }}>
        {chips.map(c => (
          <View key={c.t} style={{ minHeight: 28, paddingHorizontal: SP.sm, justifyContent: 'center', backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.tag }}>
            <Txt face="mono" raw size={12} lh={1.35} color={c.color}>{c.t}</Txt>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Virtualised, newest at the bottom; only the streaming bubble redraws as REI types. */}
        <FlashList
          ref={list}
          data={messages}
          keyExtractor={(m, i) => m.id ?? `i${i}`}
          renderItem={({ item }) => <Bubble m={item} strong={strong} />}
          contentContainerStyle={{ paddingHorizontal: SP.xxl, paddingTop: SP.xl, paddingBottom: SP.lg }}
          ItemSeparatorComponent={Gap}
          // Keep the newest message in view as replies stream in.
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: !s.thinking })}
          onLoad={() => list.current?.scrollToEnd({ animated: false })}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            // Dots until REI's streamed reply starts showing.
            s.thinking && messages[messages.length - 1]?.role !== 'rei' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, marginTop: SP.xl }}>
                <Txt face="mono" size={12} lh={1.35} color={C.smoke}>REI is reading</Txt>
                <Dots />
              </View>
            ) : null
          }
        />

        <View style={{ paddingTop: SP.sm, paddingBottom: Math.max(insets.bottom, SP.md), borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.arena }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: SP.sm, paddingHorizontal: SP.xxl, paddingBottom: SP.sm }}>
            {QUICK.map(t => (
              <Tap key={t} onPress={() => quick(t)} accessibilityLabel={t} style={{ minHeight: HIT, paddingHorizontal: SP.lg, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: C.canvas }}>
                <Txt face="label" size={14} lh={1.35} color={C.chalk}>{t}</Txt>
              </Tap>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: SP.xxl }}>
            <View style={{ flex: 1, height: 48, backgroundColor: C.canvas, borderWidth: 1, borderColor: typed ? C.smoke : C.rule, borderRadius: RADIUS.sm, justifyContent: 'center', paddingHorizontal: SP.lg }}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => send(draft)}
                placeholder="Talk to REI…"
                placeholderTextColor={C.faint}
                returnKeyType="send"
                keyboardAppearance="dark"
                accessibilityLabel="Message to REI"
                style={inputType(settings.textSize)}
              />
            </View>
            {/* The one main control: send what you typed, or talk out loud when the box is empty. */}
            <SlabButton onPress={typed ? () => send(draft) : toVoice} accessibilityLabel={typed ? 'Send' : 'Talk to REI out loud'}>
              {ink => (typed ? <SendArrow color={ink} /> : <VoiceGlyph color={ink} big />)}
            </SlabButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const Gap = () => <View style={{ height: SP.xl }} />;

/** One chat message. Memoised, so typing in the box doesn't redraw the conversation. */
const Bubble = memo(function Bubble({ m, strong }: { m: Message; strong: boolean }) {
  if (m.role === 'sys') return <RingNote text={m.text} />;
  if (m.role === 'user') return <CornerLine text={m.text} time={m.time} />;
  return <CoachLine text={m.text} time={m.time} callout={m.alert && !strong} />;
});
