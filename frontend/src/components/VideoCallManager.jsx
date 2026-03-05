import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import IncomingCallModal from './IncomingCallModal';
import VideoCallSimple from './VideoCallSimple';
import axios from 'axios';
import { API_URL } from '../config/api';

const API = axios.create({ baseURL: API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function VideoCallManager() {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  const [incomingForChild, setIncomingForChild] = useState(null);
  
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for incoming calls
    socket.on('call:incoming', handleIncomingCall);

    return () => {
      socket.off('call:incoming');
    };
  }, [socket, connected]);

  const handleIncomingCall = async (data) => {
    const { from, callerName, offer, callId } = data;
    console.log('📞 Incoming call from:', callerName);

    // Fetch caller details
    try {
      const response = await API.get(`/profiles/${from}`);
      const caller = response.data;
      
      setIncomingCall({
        caller: {
          id: from,
          firstName: caller.firstName || callerName.split(' ')[0],
          lastName: caller.lastName || callerName.split(' ')[1] || '',
        },
        offer,
        callId,
      });
    } catch (error) {
      console.error('Error fetching caller details:', error);
      setIncomingCall({
        caller: {
          id: from,
          firstName: callerName.split(' ')[0],
          lastName: callerName.split(' ')[1] || '',
        },
        offer,
        callId,
      });
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    // Delegate acceptance to VideoCallSimple: pass the incoming call to child
    const saved = incomingCall;
    if (saved.callId) setCurrentCallId(saved.callId);
    setIncomingForChild(saved);
    setActiveCall(saved.caller);
    setShowVideoCall(true);
    setIncomingCall(null);
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    console.log('❌ Rejecting call');
    socket.emit('call:reject', {
      to: incomingCall.caller.id,
    });

    setIncomingCall(null);
  };

  const closeVideoCall = () => {
    // Cleanup
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerConnectionRef.current = null;

    setShowVideoCall(false);
    setActiveCall(null);
    setIncomingForChild(null);
  };

  return (
    <>
      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.caller}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Active Video Call */}
      {showVideoCall && activeCall && (
        <VideoCallSimple
          targetUser={activeCall}
          onClose={closeVideoCall}
          initialCallId={currentCallId}
          initialIncomingCall={incomingForChild}
        />
      )}
    </>
  );
}
