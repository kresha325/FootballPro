import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { aiSuggestPostRequest, extractErrorMessage } from '../api/client';

export default function AiCaptionButton({ hints = {}, onCaption, style }) {
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      const res = await aiSuggestPostRequest({ hints });
      const caption = res.data?.caption;
      if (caption) onCaption?.(caption);
      else Alert.alert('AI', 'Nuk u gjenerua caption.');
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = extractErrorMessage(err, 'Sugjerimi dështoi');
      if (code === 'AI_NOT_CONFIGURED') {
        Alert.alert('AI', 'AI nuk është aktiv në server.');
      } else {
        Alert.alert('AI', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#0f766e" />
      ) : (
        <Text style={styles.text}>✨ Caption AI</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  text: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
});
