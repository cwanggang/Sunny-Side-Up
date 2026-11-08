import type { ExpoConfig } from 'expo/config';

// S3. Owned by Developer A. Any change here (or a new native package) needs a
// new dev build: announce it to the team (plan.md §3.4).
//
// Permission strings must match what this build actually does (plan.md §9).
//
// Built locally with Xcode and a FREE Apple ID (plan.md §3.0): no remote push,
// no Sign in with Apple. Don't add capabilities that need a paid account.

const BUNDLE_ID = 'com.cwanggang.sunnysideup';

// HealthKit: S4 confirmed it signs and installs on our free Personal Team (2026-11-08).
// Turning it off again needs a reinstall on every phone.
const ENABLE_HEALTHKIT = true;

const config: ExpoConfig = {
  name: 'Sunny Side Up',
  slug: 'sunny-side-up',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'sunnysideup', // invite links: sunnysideup://join/<code>
  userInterfaceStyle: 'automatic',

  ios: {
    bundleIdentifier: BUNDLE_ID,
    icon: './assets/expo.icon',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },

  web: {
    favicon: './assets/images/favicon.png',
  },

  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-asset',
    'expo-secure-store',
    'expo-image',
    'expo-dev-client',

    // Local notifications only. Remote push (aps-environment) needs a paid
    // account; the server writes `notifications` rows instead (plan.md §4).
    [
      'expo-notifications',
      {
        enableRemoteNotifications: false,
      },
    ],

    // Media
    [
      'expo-camera',
      {
        cameraPermission: 'Sunny Side Up uses the camera so you can send photos to your circle.',
        microphonePermission: 'Sunny Side Up uses the microphone so you can send voice memos to your circle.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Sunny Side Up lets you pick photos to share with your circle.',
        cameraPermission: 'Sunny Side Up uses the camera so you can send photos to your circle.',
        microphonePermission: 'Sunny Side Up uses the microphone so you can send voice memos to your circle.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Sunny Side Up uses the microphone so you can send voice memos to your circle.',
        enableBackgroundPlayback: false, // voice memos only play in the foreground
      },
    ],

    // Signals: `location` background mode for the home geofence (A4.2) and
    // significant location changes (A4.3).
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Sunny Side Up uses your location to mark where home is. Your actual location never leaves your phone.',
        locationAlwaysAndWhenInUsePermission:
          'Sunny Side Up counts hours away from home and places visited each day. Only those two daily numbers are uploaded; your actual location never leaves your phone.',
        locationAlwaysPermission:
          'Sunny Side Up counts hours away from home and places visited each day. Only those two daily numbers are uploaded; your actual location never leaves your phone.',
        isIosBackgroundLocationEnabled: true,
        motionUsagePermission: false, // Core Motion is out of scope for this build
        locationFullAccuracyPermission: false,
      },
    ],
    // `fetch` background mode.
    'expo-task-manager',
    // `processing` background mode + BGTaskScheduler id, for the daily upload (A4.5).
    'expo-background-task',
    // HealthKit entitlement + read-only usage string (A4.4), only when enabled.
    ...(ENABLE_HEALTHKIT
      ? ([
          [
            '@kingstinct/react-native-healthkit',
            {
              NSHealthShareUsageDescription:
                "Sunny Side Up reads last night's sleep and yesterday's steps. Only those two daily numbers are uploaded; other health data never leaves your phone.",
              NSHealthUpdateUsageDescription: false, // read-only: never writes health data
              background: false, // reads once a day, no background delivery
            },
          ],
        ] as NonNullable<ExpoConfig['plugins']>)
      : []),
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  owner: 'cadenwang',
  extra: {
    // EAS project (from `eas init`). Unused while we build locally; kept so
    // remote push can be re-enabled if a paid account appears (plan.md §11).
    eas: { projectId: '037fe85b-a9f7-4155-81cc-d047c312947d' },
    healthkitEnabled: ENABLE_HEALTHKIT, // read at runtime via expo-constants
  },
};

export default config;
