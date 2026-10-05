const HIGHLIGHT_TAGS = ['GOAL', 'ASSIST', 'SAVE', 'SKILL', 'TACKLE', 'MATCH HIGHLIGHT'];

const TAG_TO_CATEGORY = {
  GOAL: 'goal',
  ASSIST: 'assist',
  SAVE: 'save',
  SKILL: 'skills',
  TACKLE: 'tackle',
  'MATCH HIGHLIGHT': 'match_highlight',
};

function normalizeHighlightTag(raw) {
  const tag = String(raw || '').trim().toUpperCase();
  if (!tag) return null;
  if (TAG_TO_CATEGORY[tag]) return tag;
  return null;
}

function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(',');
  const cleaned = list
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  return [...new Set(cleaned)];
}

function categoryForHighlightTag(tag) {
  const normalized = normalizeHighlightTag(tag);
  return normalized ? TAG_TO_CATEGORY[normalized] : null;
}

module.exports = {
  HIGHLIGHT_TAGS,
  TAG_TO_CATEGORY,
  normalizeHighlightTag,
  normalizeTags,
  categoryForHighlightTag,
};
