// The front door: log in or create an account, then prove the email. New accounts go on to the
// chapters; everyone else lands in the app. A fight poster: REI's name, the two corner lights,
// one cut slab to step in.
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { Core } from '../components/Core';
import { CutButton, RoundStamp, Slash } from '../components/fight';
import { Icon, type IconKey } from '../components/icons';
import { Tap, Txt } from '../components/ui';
import { C, cutDx, fontFamily, HIT, SP, THEMES } from '../lib/theme';
import { authMessage } from '../state/account';
import { useStore } from '../state/store';

const EMAIL = /^\S+@\S+\.\S+$/;
const RESEND_WAIT = 30;

/** The arena behind the door: your corner's light from the left, the far corner's from the right. Flat, cut at the one angle. */
function Arena({ acc }: { acc: string }) {
  const { width: W, height: H } = useWindowDimensions();
  const h = Math.min(H * 0.62, 520), dx = cutDx(h);
  const beam = (x: number, w: number) => `${x},0 ${x + w},0 ${x + w - dx},${h} ${x - dx},${h}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: C.arena }]}>
      <Svg width={W} height={H}>
        <Polygon points={beam(W * 0.2, W * 0.3)} fill={acc} opacity={0.06} />
        <Polygon points={beam(W * 0.08, W * 0.07)} fill={acc} opacity={0.08} />
        <Polygon points={beam(W * 1.08, W * 0.16)} fill={C.rival} opacity={0.06} />
        <Polygon points={beam(W * 1.3, W * 0.05)} fill={C.rival} opacity={0.08} />
      </Svg>
    </View>
  );
}

export default function SignIn() {
  const s = useStore();
  const { account } = s;
  const insets = useSafeAreaInsets();
  // Before onboarding there's no chosen world yet: the front door wears REI Zero.
  const { acc } = THEMES[0];

  return (
    <View style={{ flex: 1, backgroundColor: C.arena }}>
      <Arena acc={acc} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: SP.lg, paddingTop: insets.top + SP.xxl, paddingBottom: insets.bottom + SP.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg }}>
            <Core size={88} color={acc} />
            <View style={{ flex: 1, alignItems: 'flex-start', gap: SP.xs }}>
              <View accessibilityRole="header">
                <Txt face="display" size={72} lh={1.05} ls={0.01}>REI</Txt>
              </View>
              <Txt face="labelItalic" w={600} size={14} ls={0.12} lh={1.2} color={acc}>EVERY DAY IS A MATCH.</Txt>
              <Txt face="labelItalic" w={600} size={14} ls={0.12} lh={1.2}>YOU VS. YOUR EXCUSES.</Txt>
            </View>
          </View>
          <RoundStamp label="Zero excuses · tester access" tone="outline" size="sm" accent={acc} style={{ marginTop: SP.lg }} />
          <Slash accent={acc} style={{ marginTop: SP.lg }} />

          <View style={{ marginTop: SP.xl }}>
            {account.status === 'unverified' ? <Verify acc={acc} /> : account.status === 'denied' ? <Denied acc={acc} /> : <Form acc={acc} />}
          </View>

          <Tap onPress={() => s.setDemo(true)} accessibilityLabel="Try the demo without an account" style={{ marginTop: SP.xl, alignSelf: 'center', minHeight: HIT, justifyContent: 'center', paddingHorizontal: SP.md }}>
            <Txt face="label" w={600} size={15} ls={0.08} color={C.smoke}>Try the demo without an account →</Txt>
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A quiet text button under the main action. */
function Link({ label, onPress, color, disabled }: { label: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <Tap onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ minHeight: HIT, justifyContent: 'center' }}>
      <Txt face="label" w={600} size={15} ls={0.08} color={color}>{label.toUpperCase()}</Txt>
    </Tap>
  );
}

/** What just happened, under the fields: an error or a confirmation. */
function Note({ note, acc }: { note: { text: string; error: boolean }; acc: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'flex-start' }}>
      <Icon name={note.error ? 'close' : 'check'} size={16} color={note.error ? C.alertSoft : acc} strokeWidth={2.4} />
      <Txt size={14} w={500} lh={1.4} color={note.error ? C.alertSoft : acc} style={{ flex: 1 }}>{note.text}</Txt>
    </View>
  );
}

/** Log in, or create an account. */
function Form({ acc }: { acc: string }) {
  const s = useStore();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const emailOk = EMAIL.test(email.trim());
  const valid = emailOk && password.length >= 6;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await (mode === 'in' ? s.signIn(email, password) : s.signUp(email, password));
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!emailOk) {
      setNote({ text: 'Enter your email first, then tap “Forgot password”.', error: true });
      return;
    }
    try {
      await s.resetPassword(email);
      setNote({ text: 'Reset link sent. Check your inbox.', error: false });
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    }
  };

  const switchTo = (m: 'in' | 'up') => {
    setMode(m);
    setNote(null);
  };

  return (
    <View style={{ gap: SP.md }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderWidth: 2, borderColor: C.smoke, backgroundColor: C.arena }}>
        {([['in', 'Log in'], ['up', 'Create account']] as const).map(([m, label]) => {
          const on = m === mode;
          return (
            <Tap key={m} onPress={() => switchTo(m)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.chalk : 'transparent' }}>
              <Txt face="label" w={600} size={15} ls={0.08} color={on ? C.ink : C.smoke}>{label.toUpperCase()}</Txt>
            </Tap>
          );
        })}
      </View>
      <View style={{ backgroundColor: C.canvas, borderWidth: 3, borderColor: C.chalk, boxShadow: `4px 4px 0px ${acc}`, padding: SP.lg, gap: SP.md }}>
        <Txt face="labelItalic" w={600} size={13} ls={0.14} color={C.smoke}>{mode === 'in' ? 'WELCOME BACK' : 'NEW HERE · WE’LL EMAIL A LINK'}</Txt>
        <Input icon="mail" value={email} onChange={setEmail} placeholder="Email" acc={acc} kind="email" onSubmit={() => undefined} />
        <Input
          icon="key" value={password} onChange={setPassword} placeholder={mode === 'up' ? 'Password · 6+ characters' : 'Password'} acc={acc}
          kind={mode === 'in' ? 'password' : 'new-password'} secure={!show} onSubmit={submit}
          right={
            <Tap onPress={() => setShow(v => !v)} haptic={false} accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="eye" size={20} color={show ? acc : C.smoke} tint={show ? 0.3 : 0} />
            </Tap>
          }
        />
        {mode === 'up' && password.length > 0 && password.length < 6 ? <Txt size={13} w={500} color={C.warn}>{`${6 - password.length} more character${6 - password.length === 1 ? '' : 's'}.`}</Txt> : null}
        {note ? <Note note={note} acc={acc} /> : null}
      </View>
      <CutButton label={busy ? (mode === 'in' ? 'Logging in…' : 'Creating…') : mode === 'in' ? 'Log in' : 'Create my account'} icon={mode === 'in' ? 'door' : 'scroll'} accent={acc} disabled={!valid || busy} onPress={submit} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Link label={mode === 'in' ? 'New here? Create an account' : 'I have an account'} onPress={() => switchTo(mode === 'in' ? 'up' : 'in')} color={acc} />
        {mode === 'in' ? <Link label="Forgot password" onPress={reset} color={C.smoke} /> : null}
      </View>
    </View>
  );
}

/** A new account waits here until the link in the email is opened; it checks by itself every few seconds. */
function Verify({ acc }: { acc: string }) {
  const s = useStore();
  const { checkVerified } = s;
  const [wait, setWait] = useState(RESEND_WAIT);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  // Count down to the next resend.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Check every 4 s, and straight away when they come back from their mail app.
  useEffect(() => {
    const check = () => void checkVerified().catch(() => {});
    const timer = setInterval(check, 4000);
    const sub = AppState.addEventListener('change', st => st === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [checkVerified]);

  const confirm = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (!(await checkVerified())) setNote({ text: 'Not confirmed yet. Open the link in the email, then come back.', error: true });
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (wait > 0) return;
    setNote(null);
    try {
      await s.resendVerification();
      setWait(RESEND_WAIT);
      setNote({ text: 'Sent again. Check spam if it isn’t there.', error: false });
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    }
  };

  return (
    <View style={{ gap: SP.md }}>
      <View style={{ backgroundColor: C.canvas, borderWidth: 3, borderColor: C.chalk, boxShadow: `4px 4px 0px ${acc}`, padding: SP.lg, gap: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: C.arena, borderWidth: 2, borderColor: acc }}>
            <Icon name="mail" size={26} color={acc} tint={0.3} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Txt face="labelItalic" w={600} size={13} ls={0.14} color={C.smoke}>ONE LAST CHECK</Txt>
            <Txt face="display" size={26} lh={1.2}>CONFIRM YOUR EMAIL</Txt>
          </View>
        </View>
        <Txt size={15} w={500} lh={1.45} color={C.body}>
          {'I sent a link to '}
          <Txt size={15} w={600}>{s.account.email ?? 'your email'}</Txt>
          {'. Open it, and I’ll carry on here by myself.'}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
          <View style={{ width: 8, height: 8, backgroundColor: acc }} />
          <Txt face="label" w={600} size={13} ls={0.12} color={C.smoke}>WAITING FOR THE LINK…</Txt>
        </View>
        {note ? <Note note={note} acc={acc} /> : null}
      </View>
      <CutButton label={busy ? 'Checking…' : 'I’ve confirmed it'} icon="check" accent={acc} disabled={busy} onPress={confirm} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Link label={wait > 0 ? `Resend in ${wait}s` : 'Resend the link'} onPress={resend} disabled={wait > 0} color={wait > 0 ? C.dim : acc} />
        <Link label="Use another email" onPress={() => void s.signOut()} color={C.smoke} />
      </View>
    </View>
  );
}

/** Signed in, but the email isn't on the tester list. */
function Denied({ acc }: { acc: string }) {
  const s = useStore();
  return (
    <View style={{ gap: SP.md }}>
      <View style={{ backgroundColor: C.canvas, borderWidth: 3, borderColor: C.chalk, boxShadow: `4px 4px 0px ${C.rival}`, padding: SP.lg, gap: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <Icon name="lock" size={26} color={C.alertSoft} tint={0.3} />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Txt face="display" size={26} lh={1.2}>NOT ON THE LIST YET</Txt>
          </View>
        </View>
        <Txt size={15} w={500} lh={1.45} color={C.body}>{`${s.account.email ?? 'This email'} isn’t on the REI tester list. Ask Hemprasad to add it, then log in again.`}</Txt>
      </View>
      <CutButton label="Use another email" icon="door" accent={acc} onPress={() => void s.signOut()} />
    </View>
  );
}

function Input({ icon, value, onChange, placeholder, acc, kind, secure, onSubmit, right }: { icon: IconKey; value: string; onChange: (v: string) => void; placeholder: string; acc: string; kind: 'email' | 'password' | 'new-password'; secure?: boolean; onSubmit: () => void; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  const email = kind === 'email';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, height: 52, paddingLeft: SP.md, paddingRight: right ? 2 : SP.md, borderWidth: 2, borderColor: focus ? acc : C.smoke, backgroundColor: C.arena }}>
      <Icon name={icon} size={20} color={focus || value ? acc : C.smoke} tint={0.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={email ? 'email' : kind === 'password' ? 'current-password' : 'new-password'}
        textContentType={email ? 'emailAddress' : kind === 'password' ? 'password' : 'newPassword'}
        keyboardType={email ? 'email-address' : 'default'}
        secureTextEntry={secure}
        keyboardAppearance="dark"
        returnKeyType={email ? 'next' : 'go'}
        onSubmitEditing={onSubmit}
        style={{ flex: 1, minWidth: 0, height: 48, fontFamily: fontFamily('body', 500), fontSize: 16, color: C.chalk }}
      />
      {right}
    </View>
  );
}
