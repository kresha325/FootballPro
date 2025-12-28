import { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const VideoCall = ({ receiverId, onClose }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    const newSocket = io('http://192.168.100.57:5098');
    setSocket(newSocket);

    newSocket.emit('join', user.id);

    newSocket.on('callUser', (data) => {
      console.log('Receiving call from:', data);
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });

    newSocket.on('callAccepted', async (signal) => {
      console.log('Call accepted with signal:', signal);
      setCallAccepted(true);
      if (connectionRef.current) {
        try {
          await connectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (err) {
          console.error('Error setting remote description:', err);
          setError('Failed to connect call');
        }
      }
    });

    newSocket.on('iceCandidate', async (candidate) => {
      console.log('Received ICE candidate:', candidate);
      if (connectionRef.current && candidate) {
        try {
          await connectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    newSocket.on('callEnded', () => {
      console.log('Call ended');
      endCall();
    });

    return () => {
      newSocket.disconnect();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user.id]);

  const callUser = async (id) => {
    try {
      console.log('Calling user:', id);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setStream(mediaStream);
      if (myVideo.current) {
        myVideo.current.srcObject = mediaStream;
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      
      connectionRef.current = peer;

      // Add tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        peer.addTrack(track, mediaStream);
      });

      // Handle incoming tracks
      peer.ontrack = (event) => {
        console.log('Received remote track:', event);
        if (userVideo.current && event.streams[0]) {
          userVideo.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate');
          socket.emit('iceCandidate', { to: id, candidate: event.candidate });
        }
      };

      // Create and send offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit('callUser', { 
        userToCall: id, 
        signalData: offer, 
        from: user.id, 
        name: user.firstName 
      });
      
    } catch (err) {
      console.error('Error calling user:', err);
      setError('Failed to access camera/microphone. Please grant permissions.');
    }
  };

  const answerCall = async () => {
    try {
      console.log('Answering call from:', caller);
      setCallAccepted(true);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setStream(mediaStream);
      if (myVideo.current) {
        myVideo.current.srcObject = mediaStream;
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      
      connectionRef.current = peer;

      // Add tracks to peer connection
      mediaStream.getTracks().forEach(track => {
        peer.addTrack(track, mediaStream);
      });

      // Handle incoming tracks
      peer.ontrack = (event) => {
        console.log('Received remote track:', event);
        if (userVideo.current && event.streams[0]) {
          userVideo.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate');
          socket.emit('iceCandidate', { to: caller, candidate: event.candidate });
        }
      };

      // Set remote description and create answer
      await peer.setRemoteDescription(new RTCSessionDescription(callerSignal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('answerCall', { to: caller, signal: answer });
      
    } catch (err) {
      console.error('Error answering call:', err);
      setError('Failed to access camera/microphone. Please grant permissions.');
    }
  };

  const endCall = () => {
    setCallEnded(true);
    setCallAccepted(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    
    if (onClose) {
      onClose();
    }
  };

  const leaveCall = () => {
    socket.emit('endCall', { to: receiverId || caller });
    endCall();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-500 text-white rounded-lg">
            {error}
          </div>
        )}
        
        {/* Video Container */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
          
          {/* Remote Video (Large) */}
          <div className="relative w-full aspect-video bg-gray-800">
            {callAccepted && !callEnded ? (
              <video 
                playsInline 
                ref={userVideo} 
                autoPlay 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">📹</div>
                  <p className="text-lg">
                    {receivingCall ? `${name} is calling...` : 'Waiting to connect...'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* My Video (Small PiP) */}
          {stream && (
            <div className="absolute top-4 right-4 w-48 aspect-video bg-gray-700 rounded-lg overflow-hidden shadow-lg border-2 border-white">
              <video 
                playsInline 
                muted 
                ref={myVideo} 
                autoPlay 
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
        
        {/* Call Controls */}
        <div className="mt-6 flex items-center justify-center gap-4">
          
          {receivingCall && !callAccepted && (
            <>
              <button 
                onClick={answerCall}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-semibold shadow-lg transition-colors flex items-center gap-2"
              >
                <span>📞</span>
                Answer
              </button>
              <button 
                onClick={() => { setReceivingCall(false); endCall(); }}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold shadow-lg transition-colors flex items-center gap-2"
              >
                <span>❌</span>
                Decline
              </button>
            </>
          )}
          
          {!receivingCall && !callAccepted && !callEnded && (
            <button 
              onClick={() => callUser(receiverId)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold shadow-lg transition-colors flex items-center gap-2"
            >
              <span>📞</span>
              Start Call
            </button>
          )}
          
          {(callAccepted || (receivingCall && callAccepted)) && !callEnded && (
            <button 
              onClick={leaveCall}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold shadow-lg transition-colors flex items-center gap-2"
            >
              <span>📵</span>
              Hang Up
            </button>
          )}
          
          {/* Close Button (always visible) */}
          <button 
            onClick={endCall}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full font-semibold shadow-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;