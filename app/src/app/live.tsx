import { Redirect } from 'expo-router';
import { liveVoiceAvailable } from '../lib/live';

export default function Live() {
  if (!liveVoiceAvailable) return <Redirect href="/voice" />;
  // Required here, not imported at the top, so Expo Go never loads the native SDK.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LiveVoice = (require('../components/LiveVoice') as typeof import('../components/LiveVoice')).default;
  return <LiveVoice />;
}
