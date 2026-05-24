import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
import XPNotificationManager from './src/components/XPNotificationManager';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppNavigator />
        <XPNotificationManager />
      </CartProvider>
    </AuthProvider>
  );
}
