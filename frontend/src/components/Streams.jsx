import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const Streams = () => {
  const [streams, setStreams] = useState([]);
  const [currentStream, setCurrentStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchStreams();
    socketRef.current = io('http://localhost:5098');

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const fetchStreams = async () => {
    try {
      const response = await axios.get('/api/streams');
      setStreams(response.data);
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
  };

  const createStream = async () => {
    try {
      const response = await axios.post('/api/streams', {
        title: streamTitle,
        description: streamDescription,
        isPremium,
      });
      setCurrentStream(response.data);
      startStreaming();
    } catch (error) {
      console.error('Error creating stream:', error);
    }
  };

  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setIsStreaming(true);

      await axios.put(`/api/streams/${currentStream.id}/start`);

      socketRef.current.emit('joinStream', currentStream.id);
    } catch (error) {
      console.error('Error starting stream:', error);
    }
  };

  const stopStreaming = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsStreaming(false);
    await axios.put(`/api/streams/${currentStream.id}/end`);
    setCurrentStream(null);
  };

  const joinStream = async (stream) => {
    setCurrentStream(stream);
    socketRef.current.emit('joinStream', stream.id);
    await axios.post(`/api/streams/${stream.id}/join`);
  };

  const leaveStream = async () => {
    socketRef.current.emit('leaveStream', currentStream.id);
    await axios.post(`/api/streams/${currentStream.id}/leave`);
    setCurrentStream(null);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Live Streams</h1>

      {!currentStream && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Create New Stream</h2>
          <input
            type="text"
            placeholder="Stream Title"
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <textarea
            placeholder="Stream Description"
            value={streamDescription}
            onChange={(e) => setStreamDescription(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="mr-2"
            />
            Premium Stream
          </label>
          <button
            onClick={createStream}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Start Stream
          </button>
        </div>
      )}

      {currentStream && isStreaming && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Streaming: {currentStream.title}</h2>
          <video ref={videoRef} autoPlay muted className="w-full max-w-md mx-auto border rounded"></video>
          <button
            onClick={stopStreaming}
            className="bg-red-500 text-white px-4 py-2 rounded mt-2"
          >
            Stop Stream
          </button>
        </div>
      )}

      {currentStream && !isStreaming && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Watching: {currentStream.title}</h2>
          <p>{currentStream.description}</p>
          <p>Streamer: {currentStream.streamer.firstName} {currentStream.streamer.lastName}</p>
          <p>Viewers: {currentStream.viewers}</p>
          <video ref={videoRef} autoPlay className="w-full max-w-md mx-auto border rounded"></video>
          <button
            onClick={leaveStream}
            className="bg-gray-500 text-white px-4 py-2 rounded mt-2"
          >
            Leave Stream
          </button>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-2">Available Streams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.map((stream) => (
            <div key={stream.id} className="border rounded p-4">
              <h3 className="font-semibold">{stream.title}</h3>
              <p>{stream.description}</p>
              <p>Streamer: {stream.streamer.firstName} {stream.streamer.lastName}</p>
              <p>Status: {stream.isLive ? 'Live' : 'Offline'}</p>
              <p>Viewers: {stream.viewers}</p>
              {stream.isPremium && <p className="text-yellow-500">Premium</p>}
              {stream.isLive && (
                <button
                  onClick={() => joinStream(stream)}
                  className="bg-green-500 text-white px-4 py-2 rounded mt-2"
                >
                  Watch Stream
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Streams;