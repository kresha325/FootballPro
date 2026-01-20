// Socket.IO signaling server for WebRTC video calls
// This file will handle signaling events for offer, answer, ice-candidate, join/leave, etc.

module.exports = (io) => {
  io.on('connection', (socket) => {
    // Join a video call room
    socket.on('join-call', (roomId, userId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', userId);
    });

    // Relay offer
    socket.on('webrtc-offer', (data) => {
      socket.to(data.roomId).emit('webrtc-offer', data);
    });

    // Relay answer
    socket.on('webrtc-answer', (data) => {
      socket.to(data.roomId).emit('webrtc-answer', data);
    });

    // Relay ICE candidates
    socket.on('webrtc-ice-candidate', (data) => {
      socket.to(data.roomId).emit('webrtc-ice-candidate', data);
    });

    // Leave call
    socket.on('leave-call', (roomId, userId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', userId);
    });
  });
};
