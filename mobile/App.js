import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import XPNotificationManager from './src/components/XPNotificationManager';
import PushNotificationManager from './src/components/PushNotificationManager';
import { configurePlaybackAudio } from './src/utils/playbackAudio';

export default function App() {
  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  return (
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
  );
}
