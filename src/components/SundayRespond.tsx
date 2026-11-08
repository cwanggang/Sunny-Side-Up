// A sent Sunday egg with its message, on the Sunday screen.
import { StyleSheet, View } from 'react-native';

import { eggStyleOf, isVoicePath, type Share } from '@/api';
import { spacing } from '@/theme';

import { Card } from './Card';
import { Egg } from './Egg';
import { PhotoThumb, VoiceMemo } from './Media';

export function EggMessage({ share }: { share: Share }) {
  const style = eggStyleOf(share);
  return (
    <Card>
      <View style={styles.center}>
        <Egg size={90} swatch={style.swatch} pattern={style.pattern} text={share.body} />
      </View>
      {share.media_path ? (
        isVoicePath(share.media_path) ? (
          <VoiceMemo path={share.media_path} />
        ) : (
          <View style={styles.center}>
            <PhotoThumb path={share.media_path} size={260} />
          </View>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
});
