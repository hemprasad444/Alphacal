import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { BadgeUnlock } from '../../components/BadgeUnlock';
import { TabBar } from '../../components/TabBar';
import { Arrival } from '../../components/onboarding/fx';
import { useBoardSync, useGame } from '../../state/game';
import { useStore } from '../../state/store';

export default function TabsLayout() {
  const theme = useStore(s => s.theme);
  return (
    <>
      <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.bg }, animation: 'fade' }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="fuel" />
        <Tabs.Screen name="dojo" />
        <Tabs.Screen name="vow" />
      </Tabs>
      <Arrival bg={theme.bg} />
      <GameLayer />
    </>
  );
}

/** Posts the week's XP to the board and plays badge unlocks (after the app has settled in). */
function GameLayer() {
  const g = useGame();
  useBoardSync(g);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 2500);
    return () => clearTimeout(t);
  }, []);
  return settled && g.fresh.length ? <BadgeUnlock badges={g.fresh} onDone={g.markSeen} /> : null;
}
