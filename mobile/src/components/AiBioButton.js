import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { aiGenerateBioRequest, extractErrorMessage } from '../api/client';

export default function AiBioButton({ hints = {}, onBio, style }) {
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      const res = await aiGenerateBioRequest({ hints });
      const bio = res.data?.bio;
      if (bio) onBio?.(bio);
      else Alert.alert('AI', 'Nuk u gjenerua tekst.');
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = extractErrorMessage(err, 'Gjenerimi dështoi');
      if (code === 'AI_NOT_CONFIGURED') {
        Alert.alert('AI', 'AI nuk është aktiv në server (OPENAI_API_KEY).');
      } else {
        Alert.alert('AI', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <TouchableOpacity style={styles.btn} onPress={onPress} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#0f766e" />
        ) : (
          <Text style={styles.btnText}>✨ Gjenero bio me AI</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginBottom: 8 },
  btn: {
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  btnText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
});
