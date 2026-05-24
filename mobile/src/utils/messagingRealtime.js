/** Normalizon payload nga API / socket për UI të mesazheve. */
export function normalizeMessagePayload(raw, fallbackConversationId) {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw.message && raw.id == null ? raw.message : raw;
  if (!msg || typeof msg !== 'object') return null;
  const cid = msg.conversationId ?? msg.conversation_id ?? fallbackConversationId;
  return cid != null ? { ...msg, conversationId: cid } : { ...msg };
}

export function messageBelongsToConversation(message, conversationId) {
  if (!message || conversationId == null) return false;
  const cid = message.conversationId ?? message.conversation_id;
  if (cid == null) return true;
  return String(cid) === String(conversationId);
}

export function lastMessagePreview(message) {
  if (!message) return '';
  if (message.deleted) return 'Mesazhi u fshi';
  const text = typeof message.content === 'string' ? message.content.trim() : '';
  if (text) return text;
  if (message.type === 'image' || message.type === 'video') return message.fileName || 'Media';
  if (message.fileName) return message.fileName;
  if (message.fileUrl) return 'Media';
  return 'Media';
}
