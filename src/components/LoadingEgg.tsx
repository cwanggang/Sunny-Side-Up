import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import SplashEgg from '@/dom/SplashEgg';
import { colors } from '@/theme';

let shownThisLaunch = false;
let finished = false;
const waiting = new Set<() => void>();

/** Has the loading egg gone? Home starts its entrance (and lets the chick out) only then. */
export function useLoadingEggDone(): boolean {
  const [done, setDone] = useState(finished);
  useEffect(() => {
    if (finished) return;
    const f = () => setDone(true);
    waiting.add(f);
    return () => {
      waiting.delete(f);
    };
  }, []);
  return done;
}

/**
 * A5: the prototype's loading egg over the app on launch (once per launch). Tap or wait 4.3s;
 * it then fades into the app like the prototype's `go('home', { anim: 'fade', dur: 600 })`.
 */
export function LoadingEgg() {
  const [visible, setVisible] = useState(() => !shownThisLaunch);
  const [opacity] = useState(() => new Animated.Value(1));
  if (!visible) return null;

  async function done() {
    shownThisLaunch = true;
    finished = true;
    waiting.forEach((f) => f());
    Animated.timing(opacity, {
      toValue: 0,
      duration: 600,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start(() => setTimeout(() => setVisible(false), 60));
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]}>
      <SplashEgg onDone={done} dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { backgroundColor: colors.background } }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, zIndex: 100 },
});
