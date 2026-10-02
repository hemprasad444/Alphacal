import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// getReactNativePersistence's types come from the React Native build (see tsconfig paths).
import { Platform } from 'react-native';
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

// Values from Firebase console → Project settings → Your apps → Web app. They identify
// the project and are safe to ship; access is enforced by auth and security rules.
// To use the local emulators instead, set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST to the
// LAN IP of the machine running `npm run emulators` (the phone must reach it).
// Expo inlines EXPO_PUBLIC_* only when written out as process.env.EXPO_PUBLIC_NAME.
const EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

const config = EMULATOR_HOST
  ? { apiKey: 'demo-key', projectId: 'demo-rei', storageBucket: 'demo-rei.appspot.com', appId: 'demo' }
  : {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    };

/** Region the Cloud Functions are deployed to. */
export const REGION = 'asia-south1';

/** True when a Firebase project (or the emulators) is configured; otherwise the app runs on-device only. */
export const firebaseEnabled = !!(config.apiKey && config.projectId);
export const usingEmulators = !!EMULATOR_HOST;

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let services: Services | null = null;

/** Firebase services, created on first use. Only call when `firebaseEnabled`. */
export function fb(): Services {
  if (services) return services;
  const existing = getApps().length > 0;
  const app = existing ? getApp() : initializeApp(config);
  // On web (used for previews), getAuth already persists to the browser.
  const auth = Platform.OS === 'web' ? getAuth(app) : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  // Optional fields (a meal's items, a food's brand) are simply left out when unset.
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const functions = getFunctions(app, REGION);
  const storage = getStorage(app);
  if (EMULATOR_HOST && !existing) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  }
  services = { app, auth, db, functions, storage };
  return services;
}

/** Base URL for HTTP functions (streaming endpoints that callables can't serve). */
export function functionsUrl(name: string): string {
  const project = config.projectId;
  return EMULATOR_HOST ? `http://${EMULATOR_HOST}:5001/${project}/${REGION}/${name}` : `https://${REGION}-${project}.cloudfunctions.net/${name}`;
}
