// mediasoupClient.js - Utility for connecting to mediasoup-server
import io from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { BACKEND_URL } from './config/api';

// Server URL for mediasoup (configurable via VITE_MEDIASOUP_URL). Falls back to backend origin.
const SERVER_URL = import.meta.env.VITE_MEDIASOUP_URL || (BACKEND_URL ? BACKEND_URL.replace(/\/api\/?$/i, '') : window.location.origin);

// roomId = streamId ose id unik për çdo stream
export async function startBroadcast(localStream, roomId, userId = null) {
  const token = localStorage.getItem('token');
  const socket = io(SERVER_URL, { query: { userId, token } });
  // Wait for connect with timeout
  await Promise.race([
    new Promise((resolve) => socket.on('connect', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Socket connect timeout')), 8000))
  ]);
  // Join room with timeout
  await Promise.race([
    new Promise((resolve) => socket.emit('joinRoom', { roomId }, resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('joinRoom ack timeout')), 8000))
  ]);

  // 1. Get router RTP capabilities
  const rtpCapabilities = await new Promise((resolve) => {
    socket.emit('getRouterRtpCapabilities', { roomId }, resolve);
  });

  // 2. Create device
  const device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  // 3. Create send transport
  const sendTransportOptions = await new Promise((resolve) => {
    socket.emit('createWebRtcTransport', { roomId, sender: true }, resolve);
  });
  const sendTransport = device.createSendTransport(sendTransportOptions);

  // 4. Connect transport (DTLS)
  sendTransport.on('connect', ({ dtlsParameters }, callback) => {
    socket.emit('connectTransport', { roomId, transportId: sendTransport.id, dtlsParameters }, callback);
  });

  // 5. Produce audio/video
  sendTransport.on('produce', async ({ kind, rtpParameters }, callback) => {
    socket.emit('produce', { roomId, transportId: sendTransport.id, kind, rtpParameters }, ({ id }) => {
      callback({ id });
    });
  });

  // 6. Add tracks
  for (const track of localStream.getTracks()) {
    await sendTransport.produce({ track });
  }

  return { socket, device, sendTransport };
}

// Viewer merr producerId automatikisht nga backend për roomId
export async function startViewer(roomId, userId = null) {
  const token = localStorage.getItem('token');
  const socket = io(SERVER_URL, { query: { userId, token } });
  await Promise.race([
    new Promise((resolve) => socket.on('connect', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Socket connect timeout')), 8000))
  ]);
  await Promise.race([
    new Promise((resolve) => socket.emit('joinRoom', { roomId }, resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('joinRoom ack timeout')), 8000))
  ]);

  // 1. Get router RTP capabilities
  const rtpCapabilities = await new Promise((resolve) => {
    socket.emit('getRouterRtpCapabilities', { roomId }, resolve);
  });

  // 2. Create device
  const device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  // 3. Create recv transport
  const recvTransportOptions = await new Promise((resolve) => {
    socket.emit('createWebRtcTransport', { roomId, sender: false }, resolve);
  });
  const recvTransport = device.createRecvTransport(recvTransportOptions);

  // 4. Connect transport (DTLS)
  recvTransport.on('connect', ({ dtlsParameters }, callback) => {
    socket.emit('connectTransport', { roomId, transportId: recvTransport.id, dtlsParameters }, callback);
  });

  // 5. Merr producer-at (audio/video) nga backend
  const producersRes = await fetch(`${SERVER_URL}/api/mediasoup/producers/${roomId}`);
  if (!producersRes.ok) throw new Error('Producer-at nuk u gjeten');

  const producersPayload = await producersRes.json();
  const producers = Array.isArray(producersPayload.producers) ? producersPayload.producers : [];
  if (producers.length === 0) throw new Error('Nuk ka producer aktiv');

  // 6. Consume secilin producer dhe krijo stream me të gjitha tracks
  const consumers = [];
  const tracks = [];

  for (const producerInfo of producers) {
    const { producerId } = producerInfo;
    const consumeParams = await new Promise((resolve) => {
      socket.emit('consume', {
        roomId,
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities
      }, resolve);
    });

    if (consumeParams && consumeParams.error) {
      throw new Error(consumeParams.error);
    }

    const { id, kind, rtpParameters } = consumeParams;
    const consumer = await recvTransport.consume({ id, producerId, kind, rtpParameters });
    consumers.push(consumer);
    tracks.push(consumer.track);
  }

  const stream = new MediaStream(tracks);
  return { socket, device, recvTransport, consumers, stream };
}
