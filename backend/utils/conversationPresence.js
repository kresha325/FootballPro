function userIsViewingConversation(io, userId, conversationId) {
  if (!io || userId == null || conversationId == null) return false;
  const rooms = io.sockets?.adapter?.rooms;
  if (!rooms?.get) return false;
  const convRoom = rooms.get(`conversation-${conversationId}`);
  const userRoom = rooms.get(String(userId));
  if (!convRoom || !userRoom) return false;
  for (const sid of userRoom) {
    if (convRoom.has(sid)) return true;
  }
  return false;
}

module.exports = { userIsViewingConversation };
