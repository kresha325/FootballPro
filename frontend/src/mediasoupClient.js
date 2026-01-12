// mediasoupClient.js - Utility for connecting to mediasoup-server
import io from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';


const SERVER_URL = 'http://localhost:4000'; // ndryshoje sipas production

// roomId = streamId ose id unik për çdo stream
export async function startBroadcast(localStream, roomId, userId = null) {
  const token = localStorage.getItem('token');
  const socket = io(SERVER_URL, { query: { userId, token } });
  await new Promise((resolve) => socket.on('connect', resolve));
  await new Promise((resolve) => socket.emit('joinRoom', { roomId }, resolve));

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
  await new Promise((resolve) => socket.on('connect', resolve));
  await new Promise((resolve) => socket.emit('joinRoom', { roomId }, resolve));

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

  // 5. Merr producerId nga backend
  const res = await fetch(`${SERVER_URL}/api/mediasoup/producer/${roomId}`);
  if (!res.ok) throw new Error('Producer nuk u gjet');
  const { producerId } = await res.json();

  // 6. Consume
  const { id, kind, rtpParameters } = await new Promise((resolve) => {
    socket.emit('consume', {
      roomId,
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities
    }, resolve);
  });

  const consumer = await recvTransport.consume({ id, producerId, kind, rtpParameters });
  const stream = new MediaStream([consumer.track]);
  return { socket, device, recvTransport, consumer, stream };
}
