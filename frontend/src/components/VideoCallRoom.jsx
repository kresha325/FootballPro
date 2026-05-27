import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { API_URL, BACKEND_URL } from '../config/api';

const API = axios.create({ baseURL: API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || BACKEND_URL || 'http://localhost:10000';

const VideoCallRoom = ({ roomId, userId }) => {
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef();
  const peerConnections = useRef({});
  const localVideoRef = useRef();

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { auth: { userId } });
    return () => {
      socketRef.current.disconnect();
    };
  }, [userId]);

  useEffect(() => {
    if (!joined) return;
    // Get local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setLocalStream(stream);
      localVideoRef.current.srcObject = stream;
      socketRef.current.emit('call:join-room', { roomId, userId });
    });
  }, [joined, roomId, userId]);

  useEffect(() => {
    if (!socketRef.current) return;
    // Handle user joined
    socketRef.current.on('call:user-joined', ({ userId: remoteUserId }) => {
      setParticipants(prev => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
      if (remoteUserId === userId) return;
      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnections.current[remoteUserId] = pc;
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      pc.onicecandidate = e => {
        if (e.candidate) {
          socketRef.current.emit('call:ice-candidate', { to: remoteUserId, candidate: e.candidate });
        }
      };
      pc.ontrack = e => {
        setRemoteStreams(prev => {
          if (prev.find(s => s.id === e.streams[0].id)) return prev;
          return [...prev, e.streams[0]];
        });
      };
      pc.createOffer().then(async (offer) => {
        pc.setLocalDescription(offer);
        // Create backend call record and include callId if available
        let callId = null;
        try {
          const resp = await API.post('/video-calls/create', { participantId: remoteUserId });
          if (resp && resp.data && resp.data.id) callId = resp.data.id;
        } catch (e) {
          console.warn('Could not create backend call record:', e.message);
        }
        socketRef.current.emit('call:offer', { to: remoteUserId, offer, from: userId, callId });
      });
    });
    // Handle user left
    socketRef.current.on('call:user-left', ({ userId: leftUserId }) => {
      setParticipants(prev => prev.filter(id => id !== leftUserId));
      if (peerConnections.current[leftUserId]) {
        peerConnections.current[leftUserId].close();
        delete peerConnections.current[leftUserId];
      }
      setRemoteStreams(prev => prev.filter(s => s.id !== leftUserId));
    });
    // Handle offer
    socketRef.current.on('call:incoming', async ({ from, offer, callId }) => {
      setParticipants(prev => prev.includes(from) ? prev : [...prev, from]);
      const pc = new RTCPeerConnection();
      peerConnections.current[from] = pc;
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      pc.onicecandidate = e => {
        if (e.candidate) {
          socketRef.current.emit('call:ice-candidate', { to: from, candidate: e.candidate });
        }
      };
      pc.ontrack = e => {
        setRemoteStreams(prev => {
          if (prev.find(s => s.id === e.streams[0].id)) return prev;
          return [...prev, e.streams[0]];
        });
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('call:answer', { to: from, answer, callId });
    });
    // Handle answer
    socketRef.current.on('call:answered', async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });
    // Handle ICE candidate
    socketRef.current.on('call:ice-candidate', async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
    return () => {
      socketRef.current.off('call:user-joined');
      socketRef.current.off('call:user-left');
      socketRef.current.off('call:incoming');
      socketRef.current.off('call:answered');
      socketRef.current.off('call:ice-candidate');
    };
  }, [localStream, joined, userId]);

  const handleJoin = () => setJoined(true);
  const handleLeave = () => {
    setJoined(false);
    socketRef.current.emit('call:end', { roomId, userId });
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    setRemoteStreams([]);
    setParticipants([]);
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const handleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      setMuted(m => !m);
    }
  };

  const handleVideoToggle = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(v => !v);
    }
  };

  return (
    <div className="video-call-room">
      {!joined ? (
        <button onClick={handleJoin}>Join Video Call</button>
      ) : (
        <div>
          <div>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300 }} />
            <div>
              <button onClick={handleMute}>{muted ? 'Unmute' : 'Mute'}</button>
              <button onClick={handleVideoToggle}>{videoEnabled ? 'Turn Off Video' : 'Turn On Video'}</button>
              <button onClick={handleLeave}>Leave Call</button>
            </div>
          </div>
          <div>
            <h4>Participants:</h4>
            <ul>
              {participants.map(pid => (
                <li key={pid}>{pid === userId ? 'You' : `User ${pid}`}</li>
              ))}
            </ul>
          </div>
          <div>
            {remoteStreams.map((stream, idx) => (
              <video key={idx} srcObject={stream} autoPlay playsInline style={{ width: 300 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallRoom;
