/** Normalize Profile JSON array fields (matches, achievements, etc.). */
export function parseProfileJsonArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return [value];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
    } catch (_e) {
      return [];
    }
  }
  return [];
}
