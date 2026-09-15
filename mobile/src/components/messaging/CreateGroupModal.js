import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createGroupConversationRequest, extractErrorMessage } from '../../api/client';

/**
 * Create a group from existing 1:1 contacts (same flow as web Messaging).
 */
export default function CreateGroupModal({ visible, onClose, conversations, currentUserId, onCreated }) {
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const contacts = useMemo(() => {
    const map = new Map();
    (conversations || []).forEach((conv) => {
      if (conv?.isGroup || !Array.isArray(conv?.members)) return;
      const other = conv.members.find((m) => Number(m.id) !== Number(currentUserId));
      if (other?.id && !map.has(Number(other.id))) {
        map.set(Number(other.id), {
          id: other.id,
          name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Përdorues',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations, currentUserId]);

  const reset = () => {
    setGroupName('');
    setSelectedIds([]);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const toggle = (id) => {
    const n = Number(id);
    setSelectedIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const submit = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Grupi', 'Shkruaj emrin e grupit.');
      return;
    }
    if (selectedIds.length < 2) {
      Alert.alert('Grupi', 'Zgjidh të paktën 2 anëtarë.');
      return;
    }
    setBusy(true);
    try {
      const res = await createGroupConversationRequest(name, selectedIds);
      const created = res?.data;
      if (!created?.id) throw new Error('Grupi nuk u krijua');
      onCreated?.(created);
      close();
    } catch (err) {
      Alert.alert('Gabim', extractErrorMessage(err, 'Nuk u krijua grupi'));
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Krijo grup</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Emri i grupit"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            editable={!busy}
          />

          <Text style={styles.label}>Zgjidh anëtarët (min. 2)</Text>
          {contacts.length === 0 ? (
            <Text style={styles.hint}>Nuk ka kontakte. Fillo biseda 1:1 fillimisht.</Text>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              renderItem={({ item }) => {
                const on = selectedIds.includes(Number(item.id));
                return (
                  <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)} disabled={busy}>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? '#0f766e' : '#94a3b8'}
                    />
                    <Text style={styles.rowText}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.createBtn, busy && styles.createBtnDisabled]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Krijo grupin</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
  },
  label: { fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  hint: { color: '#64748b', marginBottom: 16 },
  list: { maxHeight: 280, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowText: { flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  createBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.65 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
