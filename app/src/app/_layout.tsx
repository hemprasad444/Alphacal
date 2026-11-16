// Sumi & Hanko's three faces. The Mincho and the gothic are Latin subsets cut from the
// @expo-google-fonts packages by scripts/subset-fonts.py (the full Japanese files are 15 MB a weight).
import { configureExerciseImages } from '@rei/shared';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useWarmup } from '../components/hooks';
import { StoreProvider, useStore } from '../state/store';

// Straight to the two weights used, so the bundle doesn't carry every IBM Plex Mono file.
const IBMPlexMono_400Regular = require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf');
const IBMPlexMono_500Medium = require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf');

SplashScreen.preventAutoHideAsync().catch(() => {});
// Exercise thumbnails from your Firebase Hosting when set (see app/.env.example).
configureExerciseImages(process.env.EXPO_PUBLIC_IMAGES_BASE_URL);

/** Headings (Shippori Mincho B1), body and labels (Zen Kaku Gothic New) and numbers (IBM Plex Mono): the whole type system, loaded before the splash lifts. */
const FONTS = {
  ShipporiMinchoB1_500Medium: require('../../assets/fonts/ShipporiMinchoB1_500Medium.ttf'),
  ShipporiMinchoB1_700Bold: require('../../assets/fonts/ShipporiMinchoB1_700Bold.ttf'),
  ShipporiMinchoB1_800ExtraBold: require('../../assets/fonts/ShipporiMinchoB1_800ExtraBold.ttf'),
  ZenKakuGothicNew_400Regular: require('../../assets/fonts/ZenKakuGothicNew_400Regular.ttf'),
  ZenKakuGothicNew_500Medium: require('../../assets/fonts/ZenKakuGothicNew_500Medium.ttf'),
  ZenKakuGothicNew_700Bold: require('../../assets/fonts/ZenKakuGothicNew_700Bold.ttf'),
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};

function Root() {
  const ready = useStore(s => s.ready), theme = useStore(s => s.theme), account = useStore(s => s.account), program = useStore(s => s.program);
  const userLoaded = useStore(s => s.userLoaded), onboarded = useStore(s => s.onboarded), obActive = useStore(s => s.obActive);
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const done = ready && (fontsLoaded || !!fontError);
  useWarmup(done, program);

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  if (!done) return null;
  // Sign in (or create an account) first; a new account then plays the chapters once; everyone
  // else lands in the app. "Try the demo" skips both. The chapters stay up until their dive ends.
  const needsAuth = (account.status === 'signedOut' || account.status === 'unverified' || account.status === 'denied') && !account.demo;
  const needsOnboarding = account.status === 'signedIn' && userLoaded && !onboarded;
  const onboarding = !needsAuth && (needsOnboarding || obActive);
  // Just signed in on a phone with nothing saved: wait for the account before choosing chapters or app.
  if (account.status === 'signedIn' && !userLoaded && !onboarded && !obActive) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={needsAuth}>
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={onboarding}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!needsAuth && !onboarding}>
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
          <Stack.Screen name="badges" />
          <Stack.Screen name="nutrition" />
          <Stack.Screen name="rei-settings" />
          <Stack.Screen name="account" />
          <Stack.Screen name="board" />
          <Stack.Screen name="log-training" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* Development only: release builds have no /gallery route at all (the screen also sends you home). */}
        <Stack.Protected guard={__DEV__ && !needsAuth && !onboarding}>
          <Stack.Screen name="gallery" />
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
