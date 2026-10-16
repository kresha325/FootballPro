import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from '../../theme/nativeComponents';
import { Ionicons } from '@expo/vector-icons';
import { extractErrorMessage, getOrCreateConversationRequest, searchUsersRequest } from '../../api/client';
import { normalizeBrowseUser } from '../UserProfileBrowsePager';

export default function StartConversationModal({ visible, currentUserId, colors, onClose, onOpen }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const term = query.trim();

  useEffect(() => {
    if (!visible) return undefined;
    if (term.length < 2) {
      setResults([]);
      setError('');
      return undefined;
    }
    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await searchUsersRequest({ q: term, limit: 20 });
        if (requestRef.current !== requestId) return;
        const rows = response?.data?.users ?? response?.data ?? [];
        setResults((Array.isArray(rows) ? rows : []).map(normalizeBrowseUser).filter((u) => u && Number(u.id) !== Number(currentUserId)));
      } catch (err) {
        if (requestRef.current === requestId) setError(extractErrorMessage(err, 'Kërkimi dështoi. Provo përsëri.'));
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [visible, term, currentUserId]);

  const close = () => {
    requestRef.current += 1;
    setQuery(''); setResults([]); setError(''); setLoading(false); setOpeningId(null);
    onClose?.();
  };

  const openConversation = async (person) => {
    setOpeningId(person.id); setError('');
    try {
      const response = await getOrCreateConversationRequest(person.id);
      if (!response?.data?.id) throw new Error('Biseda nuk u hap. Provo përsëri.');
      onOpen?.(response.data, person);
      close();
    } catch (err) {
      setError(extractErrorMessage(err, 'Biseda nuk u hap. Provo përsëri.'));
    } finally { setOpeningId(null); }
  };

  const emptyText = useMemo(() => term.length < 2 ? 'Shkruaj të paktën 2 shkronja për të kërkuar.' : 'Nuk u gjet asnjë përdorues.', [term]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <View><Text style={[styles.title, { color: colors.text }]}>Mesazh i ri</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Kërko personin që dëshiron t’i shkruash.</Text></View>
            <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel="Mbyll kërkimin" hitSlop={10}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>
          <TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Emri i përdoruesit…" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} returnKeyType="search" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
          <FlatList data={results} keyboardShouldPersistTaps="handled" keyExtractor={(item) => String(item.id)} ListEmptyComponent={!loading ? <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text> : null} renderItem={({ item }) => {
            const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Përdorues';
            return <TouchableOpacity style={[styles.person, { borderColor: colors.border }]} onPress={() => openConversation(item)} disabled={openingId != null} accessibilityRole="button" accessibilityLabel={`Hap bisedë me ${name}`}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.personText}><Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text><Text style={[styles.role, { color: colors.muted }]} numberOfLines={1}>{item.role || item.club || ''}</Text></View>
              {openingId === item.id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
            </TouchableOpacity>;
          }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { maxHeight: '82%', minHeight: 360, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' }, subtitle: { fontSize: 13, marginTop: 3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontWeight: '800', fontSize: 17 },
  personText: { flex: 1 }, name: { fontSize: 15, fontWeight: '700' }, role: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 }, loader: { marginVertical: 16 }, error: { color: '#b91c1c', marginVertical: 8 },
});
