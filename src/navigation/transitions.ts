// A5: screen transitions copied from the v0.5 prototype's `go()` (app.js):
//   push  new screen slides in from the right; the screen below slides 30% left and fades to .5
//   pop   going back: the exact reverse of push (handled automatically by the stack)
//   fade  crossfade
//   rise  new screen fades in from 40px below; the screen below fades out
// All of them: 440ms, cubic-bezier(.32, .72, 0, 1).
//
// These drive Expo Router's JavaScript stack (`expo-router/js-stack`), which, unlike the native
// stack, lets us set the exact curve and motion. It runs on Reanimated/Gesture Handler, which are
// already in the build, so no reinstall.
import type { StackCardStyleInterpolator, StackNavigationOptions } from 'expo-router/js-stack';
import { Animated, Easing } from 'react-native';

const DURATION = 440;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

const timing = {
  animation: 'timing' as const,
  config: { duration: DURATION, easing: EASE },
};
const transitionSpec = { open: timing, close: timing };

/**
 * What the screen *below* does while another one covers it. The stack only lets a screen style
 * itself, so every kind uses the prototype's push behavior here (slide 30% left, fade to .5):
 * exact for push/pop, the prototype's most common transition, and barely visible under an
 * opaque fade/rise.
 */
function coveredStyle(next: Parameters<StackCardStyleInterpolator>[0]['next'], width: number) {
  if (!next) return { translateX: 0, opacity: 1 };
  return {
    translateX: next.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.3], extrapolate: 'clamp' }),
    opacity: next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5], extrapolate: 'clamp' }),
  };
}

const pushInterpolator: StackCardStyleInterpolator = ({ current, next, layouts }) => {
  const width = layouts.screen.width;
  const covered = coveredStyle(next, width);
  return {
    cardStyle: {
      opacity: covered.opacity,
      transform: [
        {
          translateX: Animated.add(
            current.progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0], extrapolate: 'clamp' }),
            covered.translateX,
          ),
        },
      ],
    },
  };
};

const fadeInterpolator: StackCardStyleInterpolator = ({ current, next, layouts }) => {
  const covered = coveredStyle(next, layouts.screen.width);
  return {
    cardStyle: {
      opacity: Animated.multiply(current.progress, covered.opacity),
      transform: [{ translateX: covered.translateX }],
    },
  };
};

const riseInterpolator: StackCardStyleInterpolator = ({ current, next, layouts }) => {
  const covered = coveredStyle(next, layouts.screen.width);
  return {
    cardStyle: {
      opacity: Animated.multiply(current.progress, covered.opacity),
      transform: [
        { translateX: covered.translateX },
        { translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0], extrapolate: 'clamp' }) },
      ],
    },
  };
};

const base: StackNavigationOptions = {
  transitionSpec,
  // No dark scrim between cards: the prototype only moves and fades.
  cardOverlayEnabled: false,
  cardShadowEnabled: false,
};

export const transitions = {
  /** Default: settings, profile, a coop, events, gallery, daily, Sunday, ... (swipe back works). */
  push: { ...base, cardStyleInterpolator: pushInterpolator, gestureEnabled: true, gestureDirection: 'horizontal' },
  /** Crossfade: someone's profile, results screens. */
  fade: { ...base, cardStyleInterpolator: fadeInterpolator, gestureEnabled: false },
  /** From below: new event, new/join coop, the camera. */
  rise: { ...base, cardStyleInterpolator: riseInterpolator, gestureEnabled: false },
  none: { animation: 'none' },
} satisfies Record<string, StackNavigationOptions>;
