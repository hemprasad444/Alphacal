// Import each weight from its own path so unused weights stay out of the bundle.
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { IBMPlexSans_300Light } from '@expo-google-fonts/ibm-plex-sans/300Light';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { SpaceGrotesk_300Light } from '@expo-google-fonts/space-grotesk/300Light';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { ZenKakuGothicNew_300Light } from '@expo-google-fonts/zen-kaku-gothic-new/300Light';
import { ZenKakuGothicNew_400Regular } from '@expo-google-fonts/zen-kaku-gothic-new/400Regular';
import { ZenKakuGothicNew_500Medium } from '@expo-google-fonts/zen-kaku-gothic-new/500Medium';
import * as Font from 'expo-font';
import { configureExerciseImages } from '@rei/shared';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useWarmup } from '../components/hooks';
import { StoreProvider, useStore } from '../state/store';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Exercise thumbnails from your Firebase Hosting when set (see app/.env.example).
configureExerciseImages(process.env.EXPO_PUBLIC_IMAGES_BASE_URL);

const BASE_FONTS = {
  Geist_300Light, Geist_400Regular, Geist_500Medium, Geist_600SemiBold,
  GeistMono_400Regular, GeistMono_500Medium,
  ZenKakuGothicNew_300Light, ZenKakuGothicNew_400Regular, ZenKakuGothicNew_500Medium,
};
/** Loaded only when chosen in Appearance. */
const EXTRA_FONTS: Partial<Record<string, Record<string, number>>> = {
  'Space Grotesk': { SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold },
  'IBM Plex': { IBMPlexSans_300Light, IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold },
};

function Root() {
  const ready = useStore(s => s.ready), theme = useStore(s => s.theme), account = useStore(s => s.account), program = useStore(s => s.program);
  // Only the default faces block the splash; another chosen font loads alongside.
  const [fontsLoaded, fontError] = useFonts(BASE_FONTS);
  const font = useStore(s => s.settings.font);
  const [extra, setExtra] = useState<string | null>(null);
  useEffect(() => {
    const files = EXTRA_FONTS[font];
    if (!files) return;
    let live = true;
    Font.loadAsync(files)
      .catch(e => console.warn('REI: font failed to load', e))
      .finally(() => live && setExtra(font));
    return () => {
      live = false;
    };
  }, [font]);
  const extraReady = !EXTRA_FONTS[font] || extra === font;
  const done = ready && (fontsLoaded || !!fontError) && extraReady;
  useWarmup(done, program);

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  if (!done) return null;
  // With a Firebase project configured, testers sign in; "Try the demo" skips it.
  const needsAuth = (account.status === 'signedOut' || account.status === 'denied') && !account.demo;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!needsAuth}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="talk" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="appearance" />
          <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="live" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="history" />
          <Stack.Screen name="lift" />
          <Stack.Screen name="exercises" />
          <Stack.Screen name="progress" />
          <Stack.Screen name="memory" />
        </Stack.Protected>
        <Stack.Protected guard={needsAuth}>
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
