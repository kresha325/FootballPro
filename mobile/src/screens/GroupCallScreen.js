import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NativeCallRoom from '../livekit/NativeCallRoom';
import { useAuth } from '../context/AuthContext';

/**
 * Group AV call via LiveKit room `group-{conversationId}` (same ACL as backend).
 */
export default function GroupCallScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const conversationId = route?.params?.conversationId;
  const title = route?.params?.title || 'Grup';
  const audioOnly = !!route?.params?.audioOnly;

  const hangUp = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!conversationId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.error}>Mungon conversationId për thirrjen e grupit.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NativeCallRoom
        roomName={`group-${conversationId}`}
        callId={conversationId}
        audioOnly={audioOnly}
        participantName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined}
        peerLabel={title}
        onHangUp={hangUp}
        onDisconnected={hangUp}
        onFatalError={(msg) => Alert.alert('Thirrja e grupit', msg || 'Dështoi', [{ text: 'OK', onPress: hangUp }])}
        onNativeUnavailable={() => {
          Alert.alert(
            'Thirrja e grupit',
            'LiveKit native nuk është i disponueshëm në këtë build. Përdor development build.',
            [{ text: 'OK', onPress: hangUp }]
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0f172a' },
  error: { color: '#f87171', fontWeight: '700', textAlign: 'center' },
});
