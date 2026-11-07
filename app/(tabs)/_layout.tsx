import { Tabs } from 'expo-router';

// A0.3 tab bar. No icons until the Phase 5 design pass.
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="circles" options={{ title: 'Circles' }} />
      <Tabs.Screen name="nudges" options={{ title: 'Nudges' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
