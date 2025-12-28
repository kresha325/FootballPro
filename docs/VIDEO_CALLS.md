# Video Calls Feature

## Overview
Basic WebRTC video calling implementation with:
- Peer-to-peer video/audio communication
- Mute/unmute controls
- Camera on/off toggle
- Call history tracking

## Components

### Frontend
- **VideoCallSimple.jsx** - Main video call component
  - Local video preview (picture-in-picture)
  - Remote video (full screen)
  - Control buttons (mute, video, hang up)
  - Call status indicators

### Backend
- **videoCalls.js** controller - Call management
  - Start/end calls
  - Track call history
  - Schedule future calls
  - Call status updates

## Usage

### Starting a Call
```jsx
import VideoCallSimple from './components/VideoCallSimple';

const [showVideoCall, setShowVideoCall] = useState(false);
const [targetUser, setTargetUser] = useState(null);

// Open video call
<button onClick={() => {
  setTargetUser(someUser);
  setShowVideoCall(true);
}}>
  Video Call
</button>

{showVideoCall && (
  <VideoCallSimple
    targetUser={targetUser}
    onClose={() => setShowVideoCall(false)}
  />
)}
```

### API Endpoints

#### Start Call
```
POST /api/video-calls/start
Body: { "receiverId": 123 }
Response: {
  "id": 1,
  "callerId": 14,
  "receiverId": 123,
  "status": "ringing",
  "startTime": "2025-12-27T..."
}
```

#### End Call
```
PUT /api/video-calls/:callId/end
Response: {
  "msg": "Call ended",
  "call": { ... }
}
```

#### Get Call History
```
GET /api/video-calls/history
Response: [
  {
    "id": 1,
    "caller": { "id": 14, "firstName": "John", "lastName": "Doe" },
    "receiver": { "id": 16, "firstName": "Jane", "lastName": "Smith" },
    "status": "ended",
    "duration": 120,
    "startTime": "...",
    "endTime": "..."
  }
]
```

## WebRTC Configuration

### STUN Servers (Free, Google Public)
```javascript
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};
```

### For Production (with TURN servers)
```javascript
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass'
    },
  ],
};
```

## Browser Permissions
Users must grant camera/microphone permissions:
```javascript
await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});
```

## Current Limitations

### ⚠️ Simplified Implementation
- **No Signaling Server**: Currently uses simulated connection
- **No Real P2P**: Needs Socket.IO or WebSocket for signaling
- **Same Network Only**: Works best on local network

### For Full Production:

1. **Add Signaling Server** (Socket.IO)
   ```javascript
   // Exchange SDP offers/answers
   socket.emit('call-offer', { to: userId, offer: sdp });
   socket.on('call-answer', ({ answer }) => {...});
   
   // Exchange ICE candidates
   socket.emit('ice-candidate', { to: userId, candidate });
   socket.on('ice-candidate', ({ candidate }) => {...});
   ```

2. **Add TURN Server** (for NAT traversal)
   - Use services like Twilio, Xirsys, or self-hosted coturn
   - Required when users are behind firewalls/NAT

3. **Add Call Notifications**
   - Push notifications for incoming calls
   - Ringtone/vibration

4. **Add Recording** (optional)
   - MediaRecorder API
   - Save to backend

## Testing

1. Open http://192.168.100.57:5174 in **two different browsers**
2. Login with different users
3. Navigate to a user's profile
4. Click "Video Call" button
5. Grant camera/microphone permissions
6. See local video in small window
7. (Currently simulated) Remote video would appear after 2 seconds

## Future Enhancements

- [ ] Group video calls (3+ participants)
- [ ] Screen sharing
- [ ] Chat during call
- [ ] Call recording
- [ ] Background blur/virtual backgrounds
- [ ] Call quality indicators
- [ ] Bandwidth optimization

## Resources

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Simple Peer (library alternative)](https://github.com/feross/simple-peer)
- [Socket.IO for Signaling](https://socket.io/)
- [Free STUN servers](https://gist.github.com/mondain/b0ec1cf5f60ae726202e)
