// The title block at the top of each tab: crest icon, big title, mono subtitle, profile button.
import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { alpha, C } from '../lib/theme';
import { useStore } from '../state/store';

export function PageTitle({ icon, title, sub }: { icon: IconKey; title: string; sub: string }) {
  const accent = useStore(s => s.accent), name = useStore(s => s.profile.name);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 }}>
      <View style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(accent, 0.1), borderWidth: 1.5, borderColor: alpha(accent, 0.45), transform: [{ rotate: '-4deg' }] }}>
        <Icon name={icon} size={26} color={accent} tint={0.3} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={28} w={600} ls={-0.02} lh={1.05}>{title}</Txt>
        <Txt face="mono" size={10} ls={0.16} color={C.muted}>{sub.toUpperCase()}</Txt>
      </View>
      <Tap onPress={() => router.push('/settings')} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: alpha(accent, 0.4), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
        {name ? <Txt size={15} w={600} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={20} color={accent} />}
      </Tap>
    </View>
  );
}
