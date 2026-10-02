import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { Label, Tap, Txt } from '../components/ui';
import { C, fontFamily } from '../lib/theme';
import { authMessage } from '../state/account';
import { useStore } from '../state/store';

export default function SignIn() {
  const s = useStore();
  const { accent, settings, account } = s;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const denied = account.status === 'denied';
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

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
    if (!/\S+@\S+\.\S+/.test(email)) {
      setNote({ text: 'Enter your email first, then tap reset.', error: true });
      return;
    }
    try {
      await s.resetPassword(email);
      setNote({ text: 'Reset link sent. Check your inbox.', error: false });
    } catch (e) {
      setNote({ text: authMessage(e), error: true });
    }
  };

  const input = { fontFamily: fontFamily(settings.font, 400), fontSize: 16, color: C.text };
  const field = { height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center' as const, paddingHorizontal: 20 };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 18 }}>
            <Core size={104} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Txt size={34} w={500} ls={-0.03}>REI</Txt>
                <Txt face="jp" size={20} color={C.label}>零</Txt>
              </View>
              <Label color={C.dim}>ZERO EXCUSES · TESTER ACCESS</Label>
            </View>
          </View>

          {denied ? (
            <View style={{ marginTop: 36, gap: 14 }}>
              <Txt size={20} lh={1.35} align="center">{`${account.email ?? 'This email'} isn’t on the tester list yet.`}</Txt>
              <Txt size={15} lh={1.45} color={C.sub} align="center">Ask Hemprasad to add it, then sign in again.</Txt>
              <Tap onPress={s.signOut} style={{ marginTop: 8, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={16} color={C.body}>Use another email</Txt>
              </Tap>
            </View>
          ) : (
            <View style={{ marginTop: 36, gap: 10 }}>
              <View style={field}>
                <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.dim} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" keyboardAppearance="dark" returnKeyType="next" style={input} />
              </View>
              <View style={field}>
                <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={C.dim} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} textContentType={mode === 'in' ? 'password' : 'newPassword'} keyboardAppearance="dark" returnKeyType="go" onSubmitEditing={submit} style={input} />
              </View>
              {note ? <Txt size={14} lh={1.4} color={note.error ? C.alertSoft : accent} align="center" style={{ marginTop: 4 }}>{note.text}</Txt> : null}
              <Tap onPress={submit} disabled={!valid || busy} style={{ marginTop: 8, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: valid ? accent : 'rgba(255,255,255,0.06)' }}>
                <Txt size={17} w={600} color={valid ? C.ink : C.dim}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}</Txt>
              </Tap>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 6 }}>
                <Tap onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setNote(null); }}>
                  <Txt size={14} color={accent}>{mode === 'in' ? 'Create an account' : 'I have an account'}</Txt>
                </Tap>
                {mode === 'in' ? (
                  <Tap onPress={reset}>
                    <Txt size={14} color={C.muted}>Forgot password</Txt>
                  </Tap>
                ) : null}
              </View>
            </View>
          )}

          <Tap onPress={() => s.setDemo(true)} style={{ marginTop: 36, alignSelf: 'center', padding: 8 }}>
            <Txt size={14} color={C.muted}>Try the demo without an account →</Txt>
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
