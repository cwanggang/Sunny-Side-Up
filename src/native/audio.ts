// Voice memos (A2.4): record m4a with a 60-second cap, and play back a URL.
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 60;

export interface VoiceRecording {
  uri: string;
  durationMs: number;
}

export function useNativeVoiceRecorder() {
  const [result, setResult] = useState<VoiceRecording | null>(null);
  const durationRef = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    // Fires on a manual stop and when the 60-second cap ends the recording.
    if (status.isFinished && status.url) {
      setResult({ uri: status.url, durationMs: durationRef.current });
    }
  });
  const state = useAudioRecorderState(recorder, 200);

  useEffect(() => {
    if (state.isRecording) durationRef.current = state.durationMillis;
  }, [state.isRecording, state.durationMillis]);

  async function start(): Promise<void> {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone access is off. Turn it on in Settings → Sunny Side Up → Microphone.');
    }
    setResult(null);
    durationRef.current = 0;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_VOICE_SECONDS });
  }

  async function stop(): Promise<string | null> {
    if (recorder.getStatus().isRecording) {
      durationRef.current = recorder.getStatus().durationMillis;
      await recorder.stop();
    }
    // Back to playback mode so audio comes out of the speaker, not the earpiece.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (uri) setResult({ uri, durationMs: durationRef.current });
    return uri;
  }

  return {
    start,
    stop,
    reset: () => setResult(null),
    isRecording: state.isRecording,
    durationMs: state.isRecording ? state.durationMillis : (result?.durationMs ?? 0),
    uri: state.isRecording ? null : (result?.uri ?? null),
  };
}

/** Play/pause one audio URL (remote signed URL or local file). */
export function useNativeAudioPlayer(url: string | null) {
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  async function toggle() {
    if (!url) return;
    if (status.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.1)) {
      await player.seekTo(0);
    }
    player.play();
  }

  return {
    ready: !!url && status.isLoaded,
    playing: status.playing,
    durationSec: status.duration,
    positionSec: status.currentTime,
    toggle,
  };
}
