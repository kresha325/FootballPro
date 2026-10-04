export function outboundChatStatus(message, othersRead, currentUserId) {
  const sid = message?.senderId ?? message?.sender?.id;
  if (sid == null || currentUserId == null || Number(sid) !== Number(currentUserId)) return null;
  if (message._sendFailed) return 'failed';
  if (message._pending || String(message?.id || '').startsWith('pending')) return 'sending';
  const msgTime = new Date(message.createdAt).getTime();
  const times = (Array.isArray(othersRead) ? othersRead : [])
    .map((row) => (row?.lastReadAt ? new Date(row.lastReadAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (!Number.isNaN(msgTime) && times.length > 0 && Math.min(...times) >= msgTime) return 'read';
  if (message.deliveredAt) return 'delivered';
  if (message?.id != null) return 'sent';
  return 'sending';
}

export function replyUnavailable(reply) {
  return !reply || reply.deleted || reply.unavailable;
}

export function safeLinkParts(text) {
  return String(text || '').split(/(https?:\/\/[^\s]+)/g).map((part) => ({
    href: /^https?:\/\//.test(part) ? part : null,
    text: part,
  }));
}
