# Watch Together

A real-time video watch party application with WebRTC peer-to-peer connections.

## Features

- 🎥 **Screen Sharing**: Share your screen with a partner
- 📹 **Video Chat**: See each other's reactions in real-time
- 🔊 **Audio Control**: Separate volume controls for voice and screen audio
- 🖼️ **Picture-in-Picture**: Keep partner video visible while browsing
- ⚡ **Low Latency**: WebRTC-powered for near-instant communication
- 🔒 **No Account Required**: Join rooms instantly with a room ID

## Project Structure

```
watch_together/
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Node.js signaling server (Express + Socket.IO)
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- Modern browser with WebRTC support (Chrome, Firefox, Edge, Safari)

## Quick Start

### 1. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd client
npm install
```

### 2. Start the Backend Server

```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

The server will start on `http://localhost:3001` by default.

### 3. Start the Frontend

In a new terminal:

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173` by default.

### 4. Use the Application

1. Open `http://localhost:5173` in your browser
2. Click "Generate Room ID" to create a room
3. Share the room ID with a friend
4. Your friend can join by entering the room ID
5. Both users will be connected via WebRTC

## Configuration

### Backend Environment Variables

Create a `.env` file in the `server/` directory (optional):

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment Variables

Create a `.env` file in the `client/` directory (optional):

```env
VITE_SOCKET_URL=http://localhost:3001
```

## How It Works

1. **Signaling Server**: The Node.js backend handles WebRTC signaling (SDP offers/answers and ICE candidates)
2. **Peer Connection**: Once signaling is complete, peers connect directly via WebRTC (peer-to-peer)
3. **Media Streams**: Video/audio streams flow directly between peers, not through the server
4. **Room Management**: Server manages room membership (max 2 users per room)

## Architecture

### Backend (`server/`)

- **`src/index.js`**: Entry point, starts HTTP and Socket.IO server
- **`src/server.js`**: Express HTTP server setup
- **`src/socket.js`**: Socket.IO event handlers for WebRTC signaling
- **`src/roomManager.js`**: In-memory room and user management

### Frontend (`client/`)

- **`src/pages/Room.tsx`**: Main room component
- **`src/hooks/useSocket.ts`**: Socket.IO client hook
- **`src/hooks/useWebRTC.ts`**: WebRTC peer connection management
- **`src/hooks/useMedia.ts`**: Camera/microphone/screen share handling
- **`src/store/roomStore.ts`**: Zustand state management

## Socket Events

See `server/README.md` for complete Socket.IO event documentation.

## Troubleshooting

### Connection Issues

- Ensure both frontend and backend are running
- Check browser console for errors
- Verify camera/microphone permissions are granted
- Check firewall settings (WebRTC may need UDP ports)

### Media Issues

- Ensure camera/microphone are not being used by another application
- Try refreshing the page
- Check browser permissions in settings

### Development Issues

- Clear browser cache if seeing stale code
- Restart both servers if changes aren't reflected
- Check terminal for error messages

## Production Deployment

### Backend

1. Set environment variables:
   ```bash
   PORT=3001
   FRONTEND_URL=https://your-frontend-domain.com
   ```

2. Start server:
   ```bash
   npm start
   ```

### Frontend

1. Set environment variable:
   ```bash
   VITE_SOCKET_URL=https://your-backend-domain.com
   ```

2. Build:
   ```bash
   npm run build
   ```

3. Serve the `dist/` folder with a static file server (nginx, Vercel, Netlify, etc.)

## License

MIT

# ToForever
