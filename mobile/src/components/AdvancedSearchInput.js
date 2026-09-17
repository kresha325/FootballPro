import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'xtalenti_search_recent_v1';
const MAX_RECENT = 8;

async function loadRecent() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
  } catch {
    return [];
  }
}

async function pushRecent(term) {
  const t = String(term || '').trim();
  if (t.length < 2) return;
  try {
    const prev = await loadRecent();
    const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Polished search field: icon, clear, spinner, filter chips, suggestions, recent.
 */
export default function AdvancedSearchInput({
  value,
  onChangeText,
  onSubmit,
  onSelectUser,
  onApplyFilter,
  filters = {},
  suggestions = { users: [], positions: [], clubs: [] },
  loading = false,
  colors = {},
  placeholder = 'Kërko emër, klub, pozicion…',
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState([]);

  const border = colors.border || '#e2e8f0';
  const bg = colors.card || '#fff';
  const text = colors.text || '#0f172a';
  const muted = colors.muted || '#64748b';
  const chipBg = colors.chipBg || '#ecfdf5';
  const chipText = colors.chipText || '#0f766e';
  const panelBg = colors.inputBg || bg;

  const hasText = String(value || '').length > 0;
  const showPanel =
    focused &&
    (recent.length > 0 ||
      (suggestions.users || []).length > 0 ||
      (suggestions.positions || []).length > 0 ||
      (suggestions.clubs || []).length > 0 ||
      !hasText);

  useEffect(() => {
    loadRecent().then(setRecent);
  }, []);

  const refreshRecent = useCallback(() => {
    loadRecent().then(setRecent);
  }, []);

  const commit = useCallback(
    async (term) => {
      const t = (term != null ? term : value) || '';
      await pushRecent(t);
      refreshRecent();
      onSubmit?.(String(t).trim());
      inputRef.current?.blur();
    },
    [onSubmit, refreshRecent, value]
  );

  const activeFilters = [
    filters.position ? { key: 'position', label: filters.position, icon: 'football-outline' } : null,
    filters.club ? { key: 'club', label: filters.club, icon: 'business-outline' } : null,
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          {
            borderColor: focused ? '#0f766e' : border,
            backgroundColor: bg,
            shadowOpacity: focused ? 0.12 : 0.04,
          },
        ]}
      >
        <Ionicons name="search" size={20} color={focused ? '#0f766e' : muted} style={styles.leadIcon} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={muted}
          style={[styles.input, { color: text }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          clearButtonMode="never"
          onFocus={() => {
            setFocused(true);
            refreshRecent();
          }}
          onBlur={() => {
            // Delay so suggestion taps register
            setTimeout(() => setFocused(false), 180);
          }}
          onSubmitEditing={() => commit()}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#0f766e" style={styles.trail} />
        ) : hasText ? (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              onSubmit?.('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
            accessibilityLabel="Pastro"
          >
            <Ionicons name="close-circle" size={20} color={muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {activeFilters.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
          keyboardShouldPersistTaps="handled"
        >
          {activeFilters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, { backgroundColor: chipBg, borderColor: border }]}
              onPress={() => onApplyFilter?.({ [f.key]: '' })}
              activeOpacity={0.85}
            >
              <Ionicons name={f.icon} size={14} color={chipText} />
              <Text style={[styles.filterChipText, { color: chipText }]} numberOfLines={1}>
                {f.label}
              </Text>
              <Ionicons name="close" size={14} color={chipText} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {showPanel ? (
        <ScrollView
          style={[styles.panel, { backgroundColor: panelBg, borderColor: border }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {!hasText && recent.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Të fundit</Text>
              {recent.map((term) => (
                <Pressable
                  key={term}
                  style={styles.row}
                  onPress={() => {
                    onChangeText(term);
                    commit(term);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color={muted} />
                  <Text style={[styles.rowText, { color: text }]} numberOfLines={1}>
                    {term}
                  </Text>
                  <Ionicons name="arrow-up-outline" size={16} color={muted} style={styles.rowHint} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {(suggestions.users || []).length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Njerëz</Text>
              {suggestions.users.map((u) => {
                const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User';
                return (
                  <Pressable
                    key={`u-${u.id}`}
                    style={styles.row}
                    onPress={() => {
                      pushRecent(name);
                      onSelectUser?.(u);
                      setFocused(false);
                      inputRef.current?.blur();
                    }}
                  >
                    <Ionicons name="person-outline" size={18} color={chipText} />
                    <Text style={[styles.rowText, { color: text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {u.verified ? <Ionicons name="checkmark-circle" size={16} color="#3b82f6" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {(suggestions.positions || []).length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Pozicione</Text>
              <View style={styles.chipWrap}>
                {suggestions.positions.map((p) => (
                  <TouchableOpacity
                    key={`pos-${p}`}
                    style={[styles.suggestChip, { backgroundColor: chipBg, borderColor: border }]}
                    onPress={() => {
                      onApplyFilter?.({ position: p });
                      setFocused(false);
                      inputRef.current?.blur();
                    }}
                  >
                    <Text style={[styles.suggestChipText, { color: chipText }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {(suggestions.clubs || []).length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: muted }]}>Klube</Text>
              <View style={styles.chipWrap}>
                {suggestions.clubs.map((c) => (
                  <TouchableOpacity
                    key={`club-${c}`}
                    style={[styles.suggestChip, { backgroundColor: chipBg, borderColor: border }]}
                    onPress={() => {
                      onApplyFilter?.({ club: c });
                      setFocused(false);
                      inputRef.current?.blur();
                    }}
                  >
                    <Text style={[styles.suggestChipText, { color: chipText }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {!hasText && recent.length === 0 && !(suggestions.users || []).length ? (
            <Text style={[styles.hint, { color: muted }]}>
              Shkruaj për të kërkuar. Pa tekst shfaqen njerëzit që ndjek.
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    zIndex: 20,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 52,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  leadIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  trail: { marginLeft: 6 },
  clearBtn: { marginLeft: 4, padding: 2 },
  filterChips: {
    paddingTop: 10,
    paddingRight: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    maxWidth: 220,
  },
  filterChipText: { fontWeight: '700', fontSize: 13, maxWidth: 160 },
  panel: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    maxHeight: 280,
    overflow: 'hidden',
  },
  section: { paddingHorizontal: 8, paddingVertical: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowHint: { transform: [{ rotate: '45deg' }] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestChipText: { fontWeight: '700', fontSize: 13 },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
