import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import io from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const BACKEND_URL = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.BACKEND_URL) || 'https://footballpro.onrender.com';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('feed'); // feed | profile | golive
  const socketRef = useRef(null);

  useEffect(() => {
    // Try to load token from secure storage on mount
    (async () => {
      try {
        const t = await SecureStore.getItemAsync('token');
        const u = await SecureStore.getItemAsync('user');
        if (t) {
          setToken(t);
          setUser(u ? JSON.parse(u) : null);
          connectSocket(t, u ? JSON.parse(u) : null);
        }
      } catch (e) {
        console.warn('SecureStore load failed', e.message);
      }
    })();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const login = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
      const t = res.data.token || res.data.accessToken || null;
      if (!t) {
        Alert.alert('Login failed', 'No token returned');
        return;
      }
      setToken(t);
      setUser(res.data.user || null);
      // store token + user
      await SecureStore.setItemAsync('token', t);
      if (res.data.user) await SecureStore.setItemAsync('user', JSON.stringify(res.data.user));
      Alert.alert('Login', 'Success');
      connectSocket(t, res.data.user || null);
    } catch (err) {
      console.error('Login error', err?.response?.data || err.message);
      Alert.alert('Login error', err?.response?.data?.msg || err.message || 'Unknown');
    }
  };

  const connectSocket = (t, userObj) => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io(BACKEND_URL.replace(/\/$/, ''), {
      auth: { token: t, userId: userObj?.id },
      transports: ['polling','websocket'],
      path: '/socket.io',
      withCredentials: true,
    });
    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
      socket.emit('join', userObj?.id ? String(userObj.id) : 'mobile-' + socket.id);
    });
    socket.on('connect_error', (err) => {
      console.warn('Socket error', err.message);
    });
    socketRef.current = socket;
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    } catch (e) {
      console.warn('SecureStore delete failed', e.message);
    }
    if (socketRef.current) socketRef.current.disconnect();
    setToken(null);
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FootballPro Mobile</Text>
      <Text style={{ marginBottom: 8 }}>Backend: {BACKEND_URL}</Text>

      {!token ? (
        <View style={styles.form}>
          <TextInput placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
          <Button title="Login" onPress={login} />
        </View>
      ) : (
        <View style={{ flex: 1, width: '100%' }}>
          {/* Simple screen container */}
          <View style={{ flex: 1 }}>
            {screen === 'feed' && (
              <View style={styles.screen}><Text style={{ fontWeight: '700' }}>Feed (placeholder)</Text></View>
            )}
            {screen === 'profile' && (
              <View style={styles.screen}>
                <Text style={{ fontWeight: '700' }}>Profile</Text>
                <Text>{user ? `${user.firstName} ${user.lastName}` : 'No user info'}</Text>
              </View>
            )}
            {screen === 'golive' && (
              <View style={styles.screen}>
                <Text style={{ fontWeight: '700' }}>Go Live</Text>
                <Text>Start a live stream from mobile (placeholder)</Text>
              </View>
            )}
          </View>

          {/* Bottom nav */}
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setScreen('feed')}><Text>Feed</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setScreen('golive')}><Text style={{ color: 'red' }}>🔴 Go Live</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setScreen('profile')}><Text>Profile</Text></TouchableOpacity>
          </View>

          <View style={{ paddingVertical: 8 }}>
            <Button title="Logout" onPress={logout} color="#c62828" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  form: { width: '100%', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 10, borderRadius: 6 }
});
