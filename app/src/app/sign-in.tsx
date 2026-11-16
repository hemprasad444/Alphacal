// The front door: log in or create an account, then prove the email. New accounts go on to the
// chapters; everyone else lands in the app. Calm and spare: REI's red seal, the name in Mincho,
// quiet fields and one rice-paper button.
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CutButton } from '../components/fight';
import { Icon, type IconKey } from '../components/icons';
import { BrushRule, ReiSeal } from '../components/ink';
import { Atmosphere } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { C, F, fontFamily, HIT, RADIUS, SP, THEMES, warnColor } from '../lib/theme';
import { authMessage } from '../state/account';
import { useStore } from '../state/store';

const EMAIL = /^\S+@\S+\.\S+$/;
const RESEND_WAIT = 30;
/** A card: sumi fill in a quiet line. */
const CARD = { backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.xl, gap: SP.lg } as const;

export default function SignIn() {
  const s = useStore();
  const { account } = s;
  const insets = useSafeAreaInsets();
  // Before onboarding there's no chosen world yet: the front door wears REI Zero.
  const { acc } = THEMES[0];

  return (
    <View style={{ flex: 1, backgroundColor: F.arena }}>
      <Atmosphere acc={acc} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: SP.xxl, paddingTop: insets.top + SP.huge, paddingBottom: insets.bottom + SP.xxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center' }}>
            <ReiSeal size={72} ground={F.arena} />
            <View accessibilityRole="header" style={{ marginTop: SP.xl }}>
              <Txt face="display" exact size={44} lh={1.15} align="center">REI</Txt>
            </View>
            <Txt face="voice" size={17} lh={1.5} color={F.smoke} align="center" style={{ marginTop: SP.xs }}>Your coach. Every day.</Txt>
            <BrushRule long height={6} style={{ width: 160, marginTop: SP.xl }} />
          </View>

          <View style={{ marginTop: SP.huge }}>
            {account.status === 'unverified' ? <Verify acc={acc} /> : account.status === 'denied' ? <Denied acc={acc} /> : <Form acc={acc} />}
          </View>

          <Tap onPress={() => s.setDemo(true)} accessibilityLabel="Try the demo without an account" style={{ marginTop: SP.xxl, alignSelf: 'center', minHeight: HIT, justifyContent: 'center', paddingHorizontal: SP.md }}>
            <Txt size={15} w={500} lh={1.4} color={F.smoke}>Try the demo without an account</Txt>
          </Tap>
          <Txt face="mono" raw size={12} lh={1.35} color={C.faint} align="center" style={{ marginTop: SP.sm }}>Tester access</Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A quiet text button under the main action. */
function Link({ label, onPress, color, disabled }: { label: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <Tap onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ minHeight: HIT, justifyContent: 'center', flexShrink: 1 }}>
      <Txt size={15} w={500} lh={1.4} color={color}>{label}</Txt>
    </Tap>
  );
}

/** What just happened, under the fields: an error or a confirmation. */
function Note({ note, acc }: { note: { text: string; error: boolean }; acc: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: SP.sm, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 2 }}><Icon name={note.error ? 'close' : 'check'} size={16} color={note.error ? C.alertSoft : acc} strokeWidth={2} /></View>
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
    <View style={{ gap: SP.lg }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas }}>
        {([['in', 'Log in'], ['up', 'Create account']] as const).map(([m, label]) => {
          const on = m === mode;
          return (
            <Tap key={m} onPress={() => switchTo(m)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.tag, backgroundColor: on ? F.chalk : 'transparent' }}>
              <Txt face="labelItalic" size={14} lh={1.35} color={on ? F.arena : F.smoke}>{label}</Txt>
            </Tap>
          );
        })}
      </View>
      <View style={CARD}>
        <View style={{ gap: 2 }}>
          <Txt face="heading" size={20} lh={1.4}>{mode === 'in' ? 'Welcome back' : 'New here'}</Txt>
          <Txt size={13} lh={1.4} color={F.smoke}>{mode === 'in' ? 'Log in to pick up where you left off.' : 'I’ll email you a link to confirm it’s you.'}</Txt>
        </View>
        <Input icon="mail" value={email} onChange={setEmail} placeholder="Email" acc={acc} kind="email" onSubmit={() => undefined} />
        <Input
          icon="key" value={password} onChange={setPassword} placeholder={mode === 'up' ? 'Password · 6+ characters' : 'Password'} acc={acc}
          kind={mode === 'in' ? 'password' : 'new-password'} secure={!show} onSubmit={submit}
          right={
            <Tap onPress={() => setShow(v => !v)} haptic={false} accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="eye" size={20} color={show ? acc : F.smoke} tint={0} strokeWidth={1.7} />
            </Tap>
          }
        />
        {mode === 'up' && password.length > 0 && password.length < 6 ? <Txt size={13} w={500} lh={1.4} color={warnColor(acc)}>{`${6 - password.length} more character${6 - password.length === 1 ? '' : 's'}.`}</Txt> : null}
        {note ? <Note note={note} acc={acc} /> : null}
      </View>
      <CutButton label={busy ? (mode === 'in' ? 'Logging in…' : 'Creating…') : mode === 'in' ? 'Log in' : 'Create my account'} accent={acc} disabled={!valid || busy} onPress={submit} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Link label={mode === 'in' ? 'New here? Create an account' : 'I have an account'} onPress={() => switchTo(mode === 'in' ? 'up' : 'in')} color={acc} />
        {mode === 'in' ? <Link label="Forgot password" onPress={reset} color={F.smoke} /> : null}
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
    <View style={{ gap: SP.lg }}>
      <View style={CARD}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: F.arena, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm }}>
            <Icon name="mail" size={24} color={acc} tint={0} strokeWidth={1.7} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>One last check</Txt>
            <Txt face="heading" size={20} lh={1.4}>Confirm your email</Txt>
          </View>
        </View>
        <Txt size={15} w={500} lh={1.5} color={C.body}>
          {'I sent a link to '}
          <Txt size={15} w={600} lh={1.5}>{s.account.email ?? 'your email'}</Txt>
          {'. Open it, and I’ll carry on here by myself.'}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: acc }} />
          <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>Waiting for the link…</Txt>
        </View>
        {note ? <Note note={note} acc={acc} /> : null}
      </View>
      <CutButton label={busy ? 'Checking…' : 'I’ve confirmed it'} icon="check" accent={acc} disabled={busy} onPress={confirm} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Link label={wait > 0 ? `Resend in ${wait}s` : 'Resend the link'} onPress={resend} disabled={wait > 0} color={wait > 0 ? C.dim : acc} />
        <Link label="Use another email" onPress={() => void s.signOut()} color={F.smoke} />
      </View>
    </View>
  );
}

/** Signed in, but the email isn't on the tester list. */
function Denied({ acc }: { acc: string }) {
  const s = useStore();
  return (
    <View style={{ gap: SP.lg }}>
      <View style={CARD}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <Icon name="lock" size={24} color={warnColor(acc)} tint={0} strokeWidth={1.7} />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Txt face="heading" size={20} lh={1.4}>Not on the list yet</Txt>
          </View>
        </View>
        <Txt size={15} w={500} lh={1.5} color={C.body}>{`${s.account.email ?? 'This email'} isn’t on the REI tester list. Ask Hemprasad to add it, then log in again.`}</Txt>
      </View>
      <CutButton label="Use another email" accent={acc} onPress={() => void s.signOut()} />
    </View>
  );
}

function Input({ icon, value, onChange, placeholder, acc, kind, secure, onSubmit, right }: { icon: IconKey; value: string; onChange: (v: string) => void; placeholder: string; acc: string; kind: 'email' | 'password' | 'new-password'; secure?: boolean; onSubmit: () => void; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  const email = kind === 'email';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, height: 52, paddingLeft: SP.lg, paddingRight: right ? 2 : SP.lg, borderWidth: 1, borderColor: focus ? acc : F.rule, borderRadius: RADIUS.sm, backgroundColor: F.arena }}>
      <Icon name={icon} size={20} color={focus ? acc : F.smoke} tint={0} strokeWidth={1.7} />
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
        style={{ flex: 1, minWidth: 0, height: 48, fontFamily: fontFamily('body', 500), fontSize: 16, color: F.chalk }}
      />
      {right}
    </View>
  );
}
