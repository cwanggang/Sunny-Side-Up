import { View } from 'react-native';

import EggCheck from '@/dom/EggCheck';
import { Body, Screen } from '@/components';

// Temporary (A5): checks that DOM components run in the installed build. Remove after step 2 starts.
export default function DomCheckScreen() {
  return (
    <Screen title="egg check">
      <Body muted>you should see a white egg with a bobbing yolk. if this screen is blank or crashes, tell claude.</Body>
      <View style={{ height: 260 }}>
        <EggCheck label="dom components work" dom={{ scrollEnabled: false, style: { backgroundColor: 'transparent' } }} />
      </View>
    </Screen>
  );
}
