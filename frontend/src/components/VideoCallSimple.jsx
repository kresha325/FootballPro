import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { PhoneIcon, PhoneXMarkIcon, VideoCameraIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { API_URL } from '../config/api';

const API = axios.create({ baseURL: API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function VideoCallSimple({ targetUser, onClose }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, connected, ended
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!socket || !connected) {
      console.log('❌ Socket not connected');
      return;
    }

    // Listen for incoming call answer
    socket.on('call:answered', handleCallAnswered);
    
    // Listen for ICE candidates
    socket.on('call:ice-candidate', handleRemoteIceCandidate);
    
    // Listen for call rejection
    socket.on('call:rejected', handleCallRejected);
    
    // Listen for call end
    socket.on('call:ended', handleRemoteCallEnd);

    startLocalStream();
    
    return () => {
      socket.off('call:answered');
      socket.off('call:ice-candidate');
      socket.off('call:rejected');
      socket.off('call:ended');
      cleanup();
    };
  }, [socket, connected]);

  const startLocalStream = async () => {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const currentUrl = window.location.href;
        console.error('MediaDevices API not supported - requires HTTPS or localhost');
        console.error('Current URL:', currentUrl);
        
        if (currentUrl.startsWith('http://') && !currentUrl.includes('localhost')) {
          alert('⚠️ VIDEO CALLS NEVOITEN HTTPS!\n\n' +
                'URL Aktuale: ' + currentUrl + '\n\n' +
                'Zgjidhje:\n' +
                '✓ Përdor URL-në me https:// (rekomanduar)\n' +
                '✓ Ose përdor localhost për testing\n\n' +
                'Të gjitha features e tjera funksionojnë normalisht në HTTP.');
        } else {
          alert('Browser-i juaj nuk i suporton video calls. Ju lutem përdorni Chrome, Firefox ose Edge të përditësuar.');
        }
        return;
      }

      // Detect if mobile for lower resolution
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: 'user' // Front camera për mobile
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('✅ Local stream started successfully');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      let errorMessage = 'Nuk mund të aksesoj kamerën/mikrofonin. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Ju lutem jepni leje për kamerë dhe mikrofon në settings të browser-it.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'Nuk u gjet kamerë ose mikrofon.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Kamera ose mikrofoni është në përdorim nga një aplikacion tjetër.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('📥 Received remote track');
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('🧊 Sending ICE candidate');
        socket.emit('call:ice-candidate', {
          to: targetUser.id,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    setPeerConnection(pc);
    return pc;
  };

  const handleCallAnswered = async ({ from, answer }) => {
    console.log('✅ Call answered by user:', from);
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleRemoteIceCandidate = async ({ from, candidate }) => {
    console.log('🧊 Received ICE candidate from:', from);
    try {
      if (peerConnectionRef.current && candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const handleCallRejected = ({ from }) => {
    console.log('❌ Call rejected by user:', from);
    alert(`${targetUser.firstName} ${targetUser.lastName} rejected the call`);
    endCall();
  };

  const handleRemoteCallEnd = ({ from }) => {
    console.log('📴 Call ended by remote user:', from);
    endCall();
  };

  const startCall = async () => {
    if (!socket || !connected) {
      alert('Socket not connected. Please wait and try again.');
      return;
    }

    try {
      setCallStatus('calling');
      
      // Create backend call record
      const response = await API.post('/video-calls/start', {
        receiverId: targetUser.id,
      });
      setCurrentCallId(response.data.id);

      // Create peer connection and offer
      const pc = createPeerConnection();
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      // Send offer through socket
      console.log('📞 Sending call offer to user:', targetUser.id);
      socket.emit('call:offer', {
        to: targetUser.id,
        from: user.id,
        callerName: `${user.firstName} ${user.lastName}`,
        offer: offer,
      });

      setCallStatus('ringing');
      
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call: ' + error.message);
      setCallStatus('idle');
    }
  };

  const endCall = async () => {
    try {
      if (currentCallId) {
        await API.put(`/video-calls/${currentCallId}/end`);
      }
      
      // Notify remote user
      if (socket && targetUser) {
        socket.emit('call:end', { to: targetUser.id });
      }

      cleanup();
      setCallStatus('ended');
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error ending call:', error);
      cleanup();
      onClose();
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnection(null);
    peerConnectionRef.current = null;
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-black">
        {callStatus === 'connected' && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white px-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-700 flex items-center justify-center text-3xl sm:text-4xl mb-4">
              {targetUser.firstName?.[0]}{targetUser.lastName?.[0]}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center">
              {targetUser.firstName} {targetUser.lastName}
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              {callStatus === 'calling' && 'Duke thirrur...'}
              {callStatus === 'ringing' && 'Duke rënë...'}
              {callStatus === 'connected' && 'Lidhur'}
              {callStatus === 'ended' && 'Thirrja përfundoi'}
            </p>
          </div>
        )}

        {/* Local Video (Picture in Picture) - Responsive */}
        {localStream && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 w-20 h-28 sm:w-32 sm:h-48 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}

        {/* Call Status Indicator - Mobile */}
        {callStatus === 'connected' && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Lidhur
          </div>
        )}
      </div>

      {/* Controls - Mobile Optimized */}
      <div className="bg-gray-800 p-4 sm:p-6 flex justify-center items-center gap-3 sm:gap-4 pb-safe">
        {callStatus === 'idle' && (
          <button
            onClick={startCall}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500 active:bg-green-600 flex items-center justify-center text-white shadow-lg"
            aria-label="Thirr"
          >
            <PhoneIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>
        )}

        {(callStatus === 'calling' || callStatus === 'ringing' || callStatus === 'connected') && (
          <>
            <button
              onClick={toggleMute}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${
                isMuted ? 'bg-red-500' : 'bg-gray-600 active:bg-gray-700'
              } text-white shadow-lg transition-colors`}
              aria-label={isMuted ? 'Hiq mute' : 'Mute'}
            >
              <MicrophoneIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${isMuted ? 'opacity-40' : ''}`} />
            </button>

            <button
              onClick={endCall}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 active:bg-red-600 flex items-center justify-center text-white shadow-lg"
              aria-label="Mbyll"
            >
              <PhoneXMarkIcon className="h-7 w-7 sm:h-8 sm:w-8" />
            </button>

            <button
              onClick={toggleVideo}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${
                isVideoOff ? 'bg-red-500' : 'bg-gray-600 active:bg-gray-700'
              } text-white shadow-lg transition-colors`}
              aria-label={isVideoOff ? 'Aktivizo kamerën' : 'Fik kamerën'}
            >
              <VideoCameraIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${isVideoOff ? 'opacity-40' : ''}`} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
