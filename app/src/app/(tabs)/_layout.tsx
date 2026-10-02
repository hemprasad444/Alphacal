import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useStore } from '../../state/store';

export default function TabsLayout() {
  const theme = useStore(s => s.theme);
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.bg }, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="fuel" />
      <Tabs.Screen name="vow" />
    </Tabs>
  );
}
