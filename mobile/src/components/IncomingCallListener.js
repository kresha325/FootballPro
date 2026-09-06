import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { navigateRoot } from '../navigation/navigationRef';
import { setPendingIncomingCall } from '../utils/incomingCallPayload';
import { profileByIdRequest } from '../api/client';

export default function IncomingCallListener() {
  const { user, getSocket, socketConnected } = useAuth();
  const [incoming, setIncoming] = useState(null);
  const vibrateRef = useRef(null);

  const stopVibrate = useCallback(() => {
    if (vibrateRef.current) {
      clearInterval(vibrateRef.current);
      vibrateRef.current = null;
    }
    try {
      Vibration.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  const startVibrate = useCallback(() => {
    stopVibrate();
    try {
      Vibration.vibrate([400, 200, 400, 200], true);
      vibrateRef.current = setInterval(() => {
        Vibration.vibrate([400, 200, 400, 200], true);
      }, 2200);
    } catch {
      /* ignore */
    }
  }, [stopVibrate]);

  useEffect(() => {
    if (!incoming) {
      stopVibrate();
      return undefined;
    }
    startVibrate();
    return () => stopVibrate();
  }, [incoming, startVibrate, stopVibrate]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socketConnected || !user?.id) return undefined;

    const onIncoming = async (data) => {
      const from = data?.from;
      if (!from || String(from) === String(user.id)) return;

      let firstName = '';
      let lastName = '';
      const rawName = String(data?.callerName || '').trim();
      if (rawName) {
        const parts = rawName.split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ');
      } else {
        try {
          const res = await profileByIdRequest(from);
          const p = res.data;
          firstName = p?.firstName || '';
          lastName = p?.lastName || '';
        } catch {
          firstName = `User`;
          lastName = String(from);
        }
      }

      setIncoming({
        from,
        callerName: rawName || `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        offer: data?.offer,
        callId: data?.callId,
        audioOnly: !!data?.audioOnly,
      });
    };

    socket.on('call:incoming', onIncoming);
    const onRemoteEnd = () => {
      setIncoming(null);
      stopVibrate();
    };
    socket.on('call:end', onRemoteEnd);
    socket.on('call:ended', onRemoteEnd);
    socket.on('call:rejected', onRemoteEnd);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:end', onRemoteEnd);
      socket.off('call:ended', onRemoteEnd);
      socket.off('call:rejected', onRemoteEnd);
    };
  }, [getSocket, socketConnected, user?.id, stopVibrate]);

  const reject = useCallback(() => {
    const socket = getSocket();
    if (socket && incoming?.from) {
      socket.emit('call:reject', { to: incoming.from });
    }
    setIncoming(null);
  }, [getSocket, incoming]);

  const accept = useCallback(() => {
    if (!incoming) return;
    setPendingIncomingCall({
      from: incoming.from,
      callerName: incoming.callerName,
      offer: incoming.offer,
      callId: incoming.callId,
      audioOnly: incoming.audioOnly,
    });
    setIncoming(null);
    navigateRoot('IncomingCall');
  }, [incoming]);

  if (!incoming) return null;

  const initials = `${incoming.firstName?.[0] || ''}${incoming.lastName?.[0] || ''}`.toUpperCase() || '?';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={reject}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>
            {incoming.firstName} {incoming.lastName}
          </Text>
          <Text style={styles.sub}>
            {incoming.audioOnly ? 'Thirrje audio…' : 'Thirrje video…'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={reject} activeOpacity={0.85}>
              <Text style={styles.btnIcon}>✕</Text>
              <Text style={styles.btnLabel}>Refuzo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={accept} activeOpacity={0.85}>
              <Text style={styles.btnIcon}>✓</Text>
              <Text style={styles.btnLabel}>Prano</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  sub: { fontSize: 15, color: '#64748b', marginTop: 6, marginBottom: 28 },
  actions: { flexDirection: 'row', gap: 32 },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: { color: '#fff', fontSize: 28, fontWeight: '800' },
  btnLabel: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
