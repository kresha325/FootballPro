import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom sheet for message actions (works on Android; Alert is capped at 3 buttons).
 */
export default function MessageActionsSheet({
  visible,
  onClose,
  message,
  mine,
  colors = {},
  onReply,
  onForward,
  onCopy,
  onEdit,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  if (!message) return null;

  const hasText = !!(message.content && String(message.content).trim());
  const canEdit = mine && !message.fileUrl && hasText;
  const canCopy = hasText;

  const bg = colors.card || '#fff';
  const text = colors.text || '#0f172a';
  const muted = colors.muted || '#64748b';
  const border = colors.border || '#e2e8f0';
  const danger = '#dc2626';

  const rows = [
    {
      key: 'reply',
      label: 'Përgjigju',
      icon: 'arrow-undo-outline',
      onPress: onReply,
      show: true,
    },
    {
      key: 'forward',
      label: 'Përcjell',
      icon: 'arrow-redo-outline',
      onPress: onForward,
      show: true,
    },
    {
      key: 'copy',
      label: 'Kopjo',
      icon: 'copy-outline',
      onPress: onCopy,
      show: canCopy,
    },
    {
      key: 'edit',
      label: 'Ndrysho',
      icon: 'create-outline',
      onPress: onEdit,
      show: canEdit,
    },
    {
      key: 'delete',
      label: 'Fshi',
      icon: 'trash-outline',
      onPress: onDelete,
      show: !!mine,
      destructive: true,
    },
  ].filter((r) => r.show);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: bg,
              borderColor: border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={[styles.handle, { backgroundColor: border }]} />
          <Text style={[styles.title, { color: muted }]}>Mesazhi</Text>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.row}
              onPress={() => {
                const fn = row.onPress;
                onClose();
                // Defer so modal unmounts before nested Alert / focus
                setTimeout(() => fn?.(message), 0);
              }}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: row.destructive ? 'rgba(220,38,38,0.12)' : 'rgba(15,118,110,0.12)' },
                ]}
              >
                <Ionicons
                  name={row.icon}
                  size={20}
                  color={row.destructive ? danger : '#0f766e'}
                />
              </View>
              <Text style={[styles.rowLabel, { color: row.destructive ? danger : text }]}>
                {row.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: border }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: muted }]}>Anulo</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 16, fontWeight: '700', flex: 1 },
  cancelBtn: {
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700' },
});
