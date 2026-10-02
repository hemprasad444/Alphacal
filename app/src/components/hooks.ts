import { exerciseImage, findExercise, todaysPlan, warmExerciseSearch, warmFoodSearch, type WeekProgram } from '@rei/shared';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/** Current time, refreshed every `ms`. */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Once the first screen is up: build the search indexes and fetch the photos for today's
 * exercises, so the first keystroke and the first form guide are instant.
 */
export function useWarmup(ready: boolean, program: WeekProgram | null) {
  useEffect(() => {
    if (!ready) return;
    const task = InteractionManager.runAfterInteractions(() => {
      warmFoodSearch();
      warmExerciseSearch();
      const urls = (todaysPlan(new Date(), program)?.exercises ?? []).flatMap(e => {
        const ex = findExercise(e.name);
        return ex?.images ? [exerciseImage(ex.id, 0)] : [];
      });
      if (urls.length) Image.prefetch(urls, 'memory-disk').catch(() => {});
    });
    return () => task.cancel();
  }, [ready, program]);
}
