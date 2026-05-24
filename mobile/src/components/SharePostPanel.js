import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  sharePostFacebook,
  sharePostNative,
  sharePostTwitter,
  sharePostWhatsApp,
} from '../utils/sharePost';

function ShareOption({ label, emoji, color, onPress, isDark }) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.85} accessibilityLabel={label}>
      <View style={[styles.optionIcon, { backgroundColor: color }]}>
        <Text style={styles.optionEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.optionLabel, isDark && styles.optionLabelDark]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SharePostPanel({ post, onClose, isDark }) {
  if (!post?.id) return null;

  return (
    <View style={[styles.wrap, isDark && styles.wrapDark]}>
      <Text style={[styles.title, isDark && styles.titleDark]}>Ndaj postin</Text>
      <View style={styles.row}>
        <ShareOption
          label="Facebook"
          emoji="f"
          color="#1877f2"
          isDark={isDark}
          onPress={() => sharePostFacebook(post)}
        />
        <ShareOption
          label="X"
          emoji="𝕏"
          color="#0f172a"
          isDark={isDark}
          onPress={() => sharePostTwitter(post)}
        />
        <ShareOption
          label="WhatsApp"
          emoji="💬"
          color="#25d366"
          isDark={isDark}
          onPress={() => sharePostWhatsApp(post)}
        />
        <ShareOption
          label="Tjetër"
          emoji="↗"
          color="#64748b"
          isDark={isDark}
          onPress={() => sharePostNative(post)}
        />
      </View>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Mbyll">
        <Text style={[styles.closeText, isDark && styles.closeTextDark]}>Mbyll</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wrapDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  titleDark: {
    color: '#94a3b8',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    alignItems: 'center',
    minWidth: 64,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  optionEmoji: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  optionLabelDark: {
    color: '#cbd5e1',
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  closeTextDark: {
    color: '#94a3b8',
  },
});
