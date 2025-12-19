# Watch Together - Signaling Server

WebRTC signaling server for the Watch Together application.

## Features

- **Room Management**: Max 2 users per room
- **WebRTC Signaling**: SDP offer/answer and ICE candidate relay
- **Host Management**: Track and notify host changes
- **Real-time Communication**: Socket.IO for low-latency signaling
- **Auto Cleanup**: Removes stale empty rooms

## Installation

```bash
npm install
```

## Configuration

Set environment variables (optional):

```bash
PORT=3001                    # Server port (default: 3001)
FRONTEND_URL=http://localhost:5173  # Frontend URL for CORS
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Socket Events

### Client → Server

#### `join-room`
Join a room (max 2 users).

```javascript
socket.emit('join-room', {
  roomId: 'ABC123',
  userId: 'user-123',
  name: 'John' // optional
});
```

#### `offer`
Send WebRTC offer to peer.

```javascript
socket.emit('offer', {
  offer: RTCSessionDescriptionInit,
  roomId: 'ABC123',
  targetSocketId: 'socket-456' // optional
});
```

#### `answer`
Send WebRTC answer to peer.

```javascript
socket.emit('answer', {
  answer: RTCSessionDescriptionInit,
  roomId: 'ABC123',
  targetSocketId: 'socket-456'
});
```

#### `ice-candidate`
Send ICE candidate to peer.

```javascript
socket.emit('ice-candidate', {
  candidate: RTCIceCandidateInit,
  roomId: 'ABC123',
  targetSocketId: 'socket-456' // optional
});
```

#### `host-changed`
Notify server that host changed (screen share started/stopped).

```javascript
socket.emit('host-changed', {
  roomId: 'ABC123'
});
```

#### `leave-room`
Explicitly leave room.

```javascript
socket.emit('leave-room');
```

### Server → Client

#### `room-joined`
Confirmation that client joined room.

```javascript
socket.on('room-joined', (data) => {
  // data: { roomId, userId, isHost, otherUsers: [...] }
});
```

#### `peer-joined`
Another user joined the room.

```javascript
socket.on('peer-joined', (data) => {
  // data: { userId, name, socketId }
});
```

#### `peer-left`
Another user left the room.

```javascript
socket.on('peer-left', (data) => {
  // data: { userId, socketId }
});
```

#### `create-offer`
Server requests client to create an offer (when new peer joins).

```javascript
socket.on('create-offer', (data) => {
  // data: { targetSocketId, targetUserId }
  // Create offer and emit 'offer' event
});
```

#### `offer`
Received WebRTC offer from peer.

```javascript
socket.on('offer', (data) => {
  // data: { offer, fromSocketId, fromUserId }
});
```

#### `answer`
Received WebRTC answer from peer.

```javascript
socket.on('answer', (data) => {
  // data: { answer, fromSocketId, fromUserId }
});
```

#### `ice-candidate`
Received ICE candidate from peer.

```javascript
socket.on('ice-candidate', (data) => {
  // data: { candidate, fromSocketId }
});
```

#### `host-changed`
Host changed in room.

```javascript
socket.on('host-changed', (data) => {
  // data: { hostId, hostName, socketId }
});
```

#### `error`
Error occurred.

```javascript
socket.on('error', (data) => {
  // data: { message: 'Error description' }
});
```

## Architecture

```
src/
  ├── index.js        # Entry point, server startup
  ├── server.js       # Express HTTP server setup
  ├── socket.js       # Socket.IO event handlers
  └── roomManager.js  # Room and user management
```

## Notes

- **No Media Processing**: This server only handles signaling, no video/audio processing
- **In-Memory Storage**: Rooms are stored in memory (no database)
- **Auto Cleanup**: Empty rooms older than 1 hour are automatically removed
- **Max 2 Users**: Rooms are limited to 2 users maximum

