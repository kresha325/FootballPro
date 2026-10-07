export function normalizeSearchQuery(q) {
  return String(q || '').trim().toLowerCase();
}

export function matchesSearchQuery(query, strings) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const haystack = (Array.isArray(strings) ? strings : [strings])
    .map((s) => String(s ?? ''))
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function filterBySearch(items, query, getStrings) {
  const list = Array.isArray(items) ? items : [];
  const q = normalizeSearchQuery(query);
  if (!q) return list;
  return list.filter((item) => matchesSearchQuery(q, getStrings(item)));
}
