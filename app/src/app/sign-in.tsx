// The front door: log in or create an account, then prove the email. New accounts go on to the
// chapters; everyone else lands in the app. Same look as the Dojo: dark panels with a hard accent
// shadow, icons, mono labels.
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Core } from '../components/Core';
import { Icon, type IconKey } from '../components/icons';
import { Panel, Stamp } from '../components/manga';
import { Atmosphere, Cta, Seg } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { alpha, C, fontFamily, THEMES } from '../lib/theme';
import { authMessage } from '../state/account';
import { useStore } from '../state/store';

const EMAIL = /^\S+@\S+\.\S+$/;
const RESEND_WAIT = 30;

export default function SignIn() {
  const s = useStore();
  const { account } = s;
  const insets = useSafeAreaInsets();
  // Before onboarding there's no chosen world yet: the front door wears REI Zero.
  const { acc, acc2, bg } = THEMES[0];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <Atmosphere acc={acc} acc2={acc2} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 14 }}>
            <Core size={96} color={acc} />
            <Txt size={40} w={600} ls={-0.04}>REI</Txt>
            <View style={{ alignItems: 'center' }}>
              <Stamp text="Zero excuses · tester access" color={acc} tilt={-3} size={9.5} />
            </View>
          </View>

          <View style={{ marginTop: 32 }}>
            {account.status === 'unverified' ? <Verify acc={acc} /> : account.status === 'denied' ? <Denied acc={acc} /> : <Form acc={acc} />}
          </View>

          <Tap onPress={() => s.setDemo(true)} style={{ marginTop: 28, alignSelf: 'center', padding: 8 }}>
            <Txt size={14} color={C.muted}>Try the demo without an account →</Txt>
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
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
    <View style={{ gap: 14 }}>
      <Seg value={mode} opts={[['in', 'Log in'], ['up', 'Create account']]} onPick={switchTo} acc={acc} />
      <Panel acc={acc} tone={0.45} pad={16} style={{ gap: 12 }}>
        <Txt face="mono" size={10} ls={0.16} color={C.muted}>{mode === 'in' ? 'WELCOME BACK' : 'NEW HERE · WE’LL EMAIL A LINK'}</Txt>
        <Input icon="mail" value={email} onChange={setEmail} placeholder="Email" acc={acc} kind="email" onSubmit={() => undefined} />
        <Input
          icon="key" value={password} onChange={setPassword} placeholder={mode === 'up' ? 'Password · 6+ characters' : 'Password'} acc={acc}
          kind={mode === 'in' ? 'password' : 'new-password'} secure={!show} onSubmit={submit}
          right={
            <Tap onPress={() => setShow(v => !v)} haptic={false} style={{ padding: 6 }}>
              <Icon name="eye" size={18} color={show ? acc : C.dim} tint={show ? 0.3 : 0} />
            </Tap>
          }
        />
        {mode === 'up' && password.length > 0 && password.length < 6 ? <Txt size={12.5} color={C.warn}>{`${6 - password.length} more character${6 - password.length === 1 ? '' : 's'}.`}</Txt> : null}
        {note ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Icon name={note.error ? 'close' : 'check'} size={16} color={note.error ? C.alertSoft : acc} strokeWidth={2.2} />
            <Txt size={13.5} lh={1.4} color={note.error ? C.alertSoft : acc} style={{ flex: 1 }}>{note.text}</Txt>
          </View>
        ) : null}
      </Panel>
      <Cta label={busy ? (mode === 'in' ? 'Logging in…' : 'Creating…') : mode === 'in' ? 'Log in' : 'Create my account'} icon={mode === 'in' ? 'door' : 'scroll'} acc={acc} disabled={!valid || busy} onPress={submit} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Tap onPress={() => switchTo(mode === 'in' ? 'up' : 'in')} style={{ paddingVertical: 6 }}>
          <Txt size={14} color={acc}>{mode === 'in' ? 'New here? Create an account' : 'I have an account'}</Txt>
        </Tap>
        {mode === 'in' ? (
          <Tap onPress={reset} style={{ paddingVertical: 6 }}>
            <Txt size={14} color={C.muted}>Forgot password</Txt>
          </Tap>
        ) : null}
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
    <View style={{ gap: 14 }}>
      <Panel acc={acc} tone={0.5} pad={18} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(acc, 0.12), borderWidth: 1.5, borderColor: alpha(acc, 0.5), transform: [{ rotate: '-4deg' }] }}>
            <Icon name="mail" size={28} color={acc} tint={0.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt face="mono" size={10} ls={0.16} color={C.muted}>ONE LAST CHECK</Txt>
            <Txt size={22} w={600} ls={-0.02}>Confirm your email</Txt>
          </View>
        </View>
        <Txt size={15} lh={1.45} color={C.body}>
          {'I sent a link to '}
          <Txt size={15} w={600}>{s.account.email ?? 'your email'}</Txt>
          {'. Open it, and I’ll carry on here by myself.'}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: acc }} />
          <Txt face="mono" size={10.5} ls={0.12} color={C.muted}>WAITING FOR THE LINK…</Txt>
        </View>
        {note ? <Txt size={13.5} lh={1.4} color={note.error ? C.alertSoft : acc}>{note.text}</Txt> : null}
      </Panel>
      <Cta label={busy ? 'Checking…' : 'I’ve confirmed it'} icon="check" acc={acc} disabled={busy} onPress={confirm} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Tap onPress={resend} disabled={wait > 0} style={{ paddingVertical: 6 }}>
          <Txt size={14} color={wait > 0 ? C.dim : acc}>{wait > 0 ? `Resend in ${wait}s` : 'Resend the link'}</Txt>
        </Tap>
        <Tap onPress={() => void s.signOut()} style={{ paddingVertical: 6 }}>
          <Txt size={14} color={C.muted}>Use another email</Txt>
        </Tap>
      </View>
    </View>
  );
}

/** Signed in, but the email isn't on the tester list. */
function Denied({ acc }: { acc: string }) {
  const s = useStore();
  return (
    <View style={{ gap: 14 }}>
      <Panel acc={C.alertSoft} tone={0.4} pad={18} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="lock" size={26} color={C.alertSoft} tint={0.3} />
          <Txt size={20} w={600} style={{ flex: 1 }}>Not on the list yet</Txt>
        </View>
        <Txt size={15} lh={1.45} color={C.body}>{`${s.account.email ?? 'This email'} isn’t on the REI tester list. Ask Hemprasad to add it, then log in again.`}</Txt>
      </Panel>
      <Cta label="Use another email" icon="door" acc={acc} onPress={() => void s.signOut()} />
    </View>
  );
}

function Input({ icon, value, onChange, placeholder, acc, kind, secure, onSubmit, right }: { icon: IconKey; value: string; onChange: (v: string) => void; placeholder: string; acc: string; kind: 'email' | 'password' | 'new-password'; secure?: boolean; onSubmit: () => void; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  const email = kind === 'email';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingLeft: 14, paddingRight: right ? 6 : 14, borderRadius: 12, borderWidth: 1.5, borderColor: focus ? alpha(acc, 0.7) : 'rgba(255,255,255,0.1)', backgroundColor: '#0A0B0E' }}>
      <Icon name={icon} size={18} color={focus || value ? acc : C.dim} tint={0.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={email ? 'email' : kind === 'password' ? 'current-password' : 'new-password'}
        textContentType={email ? 'emailAddress' : kind === 'password' ? 'password' : 'newPassword'}
        keyboardType={email ? 'email-address' : 'default'}
        secureTextEntry={secure}
        keyboardAppearance="dark"
        returnKeyType={email ? 'next' : 'go'}
        onSubmitEditing={onSubmit}
        style={{ flex: 1, height: 50, fontFamily: fontFamily('Geist', 400), fontSize: 16, color: C.text }}
      />
      {right}
    </View>
  );
}
