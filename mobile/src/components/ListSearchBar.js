import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ListSearchBar({
  value,
  onChangeText,
  placeholder = 'Kërko…',
  onGlobalPress,
  colors = {},
}) {
  const border = colors.border || '#e2e8f0';
  const bg = colors.card || '#fff';
  const text = colors.text || '#0f172a';
  const muted = colors.muted || '#64748b';

  return (
    <View style={styles.row}>
      <View style={[styles.inputWrap, { borderColor: border, backgroundColor: bg }]}>
        <Ionicons name="search" size={18} color={muted} style={styles.icon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={muted}
          style={[styles.input, { color: text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {onGlobalPress ? (
        <TouchableOpacity style={styles.globalBtn} onPress={onGlobalPress} activeOpacity={0.85}>
          <Ionicons name="globe-outline" size={18} color="#fff" />
          <Text style={styles.globalText}>Global</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  icon: { marginRight: 6 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  globalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  globalText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
