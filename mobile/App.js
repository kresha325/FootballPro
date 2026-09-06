import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
import XPNotificationManager from './src/components/XPNotificationManager';
import PushNotificationManager from './src/components/PushNotificationManager';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <AppNavigator />
          <XPNotificationManager />
          <PushNotificationManager />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
