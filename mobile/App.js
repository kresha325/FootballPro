import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import XPNotificationManager from './src/components/XPNotificationManager';
import PushNotificationManager from './src/components/PushNotificationManager';
import SplashIntro from './src/components/SplashIntro';
import { configurePlaybackAudio } from './src/utils/playbackAudio';

export default function App() {
  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <AppNavigator />
              <XPNotificationManager />
              <PushNotificationManager />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      <SplashIntro />
    </View>
  );
}
