import { Text, View } from 'react-native';

// S1 placeholder so the app boots. A0.3 replaces this.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Sunny Side Up</Text>
    </View>
  );
}
