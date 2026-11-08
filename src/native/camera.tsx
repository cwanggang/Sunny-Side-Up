// The live viewfinder (expo-camera, already in the installed build, so no reinstall): the prototype's camera
// chrome draws over it in a web view with a see-through square.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface LiveCameraHandle {
  /** Takes a photo and returns its local file URI. */
  takePhoto: () => Promise<string | null>;
}

interface Props {
  facing: 'front' | 'back';
  mirror: boolean;
  active: boolean;
  style?: StyleProp<ViewStyle>;
  /** Reports whether the camera may be used (false: the prototype's fallback, the phone's camera app). */
  onPermission?: (granted: boolean) => void;
}

export const LiveCamera = forwardRef<LiveCameraHandle, Props>(function LiveCamera({ facing, mirror, active, style, onPermission }, ref) {
  const camera = useRef<CameraView>(null);
  const [permission, request] = useCameraPermissions();

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) void request();
    else onPermission?.(permission.granted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, permission?.canAskAgain]);

  useImperativeHandle(ref, () => ({
    takePhoto: async () => (await camera.current?.takePictureAsync({ quality: 0.6, exif: false }))?.uri ?? null,
  }));

  if (!permission?.granted) return null;
  return <CameraView ref={camera} style={style} facing={facing} mirror={mirror} active={active} mode="picture" />;
});
