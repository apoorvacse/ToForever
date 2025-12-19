# Integration Guide - Watch Together Backend

This guide explains how the frontend integrates with the signaling backend.

## Backend Overview

The signaling server handles:
- Room management (max 2 users per room)
- WebRTC signaling (SDP offers/answers, ICE candidates)
- Host management (tracking who is sharing screen)
- User join/leave events

## Frontend Integration

### 1. Socket Connection

The `useSocket` hook (`client/src/hooks/useSocket.ts`) manages the Socket.IO connection:

```typescript
const socket = useSocket({
  roomId: 'ABC123',
  userId: 'user-123',
  userName: 'John',
  // Event handlers...
});
```

### 2. WebRTC Integration

The `useWebRTC` hook (`client/src/hooks/useWebRTC.ts`) handles peer connections:

```typescript
const webrtc = useWebRTC({
  onIceCandidate: (candidate) => {
    socket.emitIceCandidate(candidate);
  },
  onOffer: (offer) => {
    socket.emitOffer(offer);
  },
  onAnswer: (answer) => {
    socket.emitAnswer(answer);
  },
});
```

### 3. Room Component Flow

In `Room.tsx`, the flow is:

1. **User enters room** → Generate user ID → Set local user
2. **Socket connects** → Join room via `join-room` event
3. **Media initialized** → Get camera/mic → Create peer connection
4. **Peer joins** → Create offer → Exchange SDP → Exchange ICE candidates
5. **Connection established** → Media streams flow peer-to-peer

## Socket Event Flow

### When User Joins Room

```
Client A                    Server                    Client B
   |                          |                          |
   |-- join-room ------------>|                          |
   |                          |                          |
   |<-- room-joined ----------|                          |
   |                          |                          |
   |                          |-- peer-joined ---------->|
   |                          |                          |
   |                          |<-- create-offer ---------|
   |                          |                          |
   |<-- create-offer ---------|                          |
   |                          |                          |
   |-- offer ---------------->|-- offer ---------------->|
   |                          |                          |
   |                          |<-- answer ---------------|
   |<-- answer ---------------|                          |
   |                          |                          |
   |-- ice-candidate -------->|-- ice-candidate -------->|
   |<-- ice-candidate --------|-- ice-candidate -------->|
   |                          |                          |
   | [WebRTC Connected]       |                          |
```

### When Host Starts Screen Share

```
Client A                    Server                    Client B
   |                          |                          |
   |-- host-changed --------->|                          |
   |                          |-- host-changed --------->|
   |                          |                          |
```

## Key Implementation Details

### 1. Offer/Answer Exchange

- When a new peer joins, the existing peer creates an offer
- The new peer receives the offer and creates an answer
- Both exchange ICE candidates to establish connection

### 2. Target Socket ID

- Offers/answers include `targetSocketId` for direct peer communication
- ICE candidates can be sent to specific peer or broadcast to room

### 3. Host Management

- First user in room becomes host
- When host starts screen share, `host-changed` event is emitted
- If host leaves, next user becomes host automatically

### 4. Error Handling

- Room full: Server rejects join with error message
- Invalid room: Server returns error
- Peer disconnect: Server notifies other peer via `peer-left` event

## Testing the Integration

1. **Start backend**: `cd server && npm start`
2. **Start frontend**: `cd client && npm run dev`
3. **Open two browser windows**:
   - Window 1: Create room, get room ID
   - Window 2: Join with same room ID
4. **Verify connection**:
   - Both should see each other's video
   - Screen share should work
   - Audio should work

## Common Issues

### "Room is full" Error

- Check that only 2 users are in the room
- Ensure previous users properly disconnected

### No Video/Audio

- Check browser console for WebRTC errors
- Verify camera/microphone permissions
- Check firewall settings (WebRTC needs UDP)

### Socket Connection Failed

- Verify backend is running on correct port
- Check `VITE_SOCKET_URL` environment variable
- Verify CORS settings in backend

## Environment Variables

### Backend (`server/.env`)

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend (`client/.env`)

```env
VITE_SOCKET_URL=http://localhost:3001
```

## Next Steps

1. Test with two different devices/networks
2. Add error recovery (reconnection logic)
3. Add room password/authentication if needed
4. Add logging/monitoring for production

