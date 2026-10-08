import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

const VIDEO = require('../../assets/xtalenti-splash.mp4');

export default function SplashIntro() {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const finished = useRef(false);

  const close = () => {
    if (finished.current) return;
    finished.current = true;
    SplashScreen.hideAsync().catch(() => {});
    setVisible(false);
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(close, 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Pressable style={styles.fill} onPress={close} accessibilityLabel="Kaloj hyrjen">
      <Video
        style={[styles.fill, { opacity: ready ? 1 : 0 }]}
        source={VIDEO}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted
        onReadyForDisplay={() => setReady(true)}
        onError={close}
        onPlaybackStatusUpdate={(status) => {
          if (status?.didJustFinish) close();
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
});
