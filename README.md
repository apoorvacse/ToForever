# 🎬 ToForever

<div align="center">

**A real-time video watch party application with WebRTC peer-to-peer connections**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Deployment](#-deployment) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🎥 **Screen Sharing**
- Share your entire screen or specific windows
- High-quality video streaming with low latency
- Only the host can share (automatic host management)
- Real-time synchronization between peers

### 📹 **Video Chat**
- See each other's reactions in real-time
- Camera toggle on/off functionality
- Mirrored local video for natural experience
- High-quality video with automatic optimization

### 🔊 **Audio Control**
- Separate volume controls for voice chat and screen audio
- Mute/unmute microphone independently
- Remote audio mute functionality
- Crystal-clear audio with echo cancellation

### 🖼️ **Picture-in-Picture**
- Keep partner video visible while browsing
- Seamless PiP integration
- Works across different browser tabs
- Smooth transitions and animations

### ⚡ **Performance**
- **WebRTC-powered**: Near-instant peer-to-peer communication
- **Low Latency**: Direct connection between peers
- **Optimized Builds**: Code splitting and lazy loading
- **Efficient State Management**: Zustand for reactive updates

### 🔒 **Privacy & Security**
- **No Account Required**: Join rooms instantly with a room ID
- **Peer-to-Peer**: Media streams never pass through servers
- **Secure Signaling**: Encrypted WebRTC connections
- **Input Validation**: Comprehensive security measures

### 🎨 **User Experience**
- **Dark/Light Mode**: Beautiful theme switching
- **Responsive Design**: Works on desktop and mobile
- **Real-time Status**: Connection status indicators
- **Error Handling**: User-friendly error messages

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **Modern browser** with WebRTC support (Chrome, Firefox, Edge, Safari)

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd watch_together
```

#### 2. Install Backend Dependencies

```bash
cd server
npm install
```

#### 3. Install Frontend Dependencies

```bash
cd ../client
npm install
```

### Running the Application

#### Start the Backend Server

```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

The server will start on `http://localhost:3001` by default.

#### Start the Frontend

In a new terminal:

```bash
cd client
npm run dev
```

The frontend will start on `http://localhost:5173` by default.

#### Use the Application

1. Open `http://localhost:5173` in your browser
2. Click **"Generate Room ID"** to create a room
3. Share the room ID with a friend (or use the invite link)
4. Your friend can join by entering the room ID
5. Both users will be connected via WebRTC automatically

---

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the `server/` directory (optional):

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
FRONTEND_URL=http://localhost:5173
# For multiple origins, use comma-separated values:
# FRONTEND_URL=http://localhost:5173,https://yourdomain.com
```

### Frontend Environment Variables

Create a `.env` file in the `client/` directory (optional):

```env
# Socket.IO Server URL
VITE_SOCKET_URL=http://localhost:3001
```

---

## 🏗️ Architecture

### Project Structure

```
watch_together/
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/         # UI component library
│   │   │   ├── ControlBar.tsx
│   │   │   ├── ScreenPlayer.tsx
│   │   │   ├── VideoTile.tsx
│   │   │   └── ...
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useMedia.ts
│   │   │   ├── useWebRTC.ts
│   │   │   ├── useSocket.ts
│   │   │   └── ...
│   │   ├── pages/          # Page components
│   │   │   ├── Home.tsx
│   │   │   └── Room.tsx
│   │   ├── store/          # State management
│   │   │   └── roomStore.ts
│   │   └── lib/            # Utilities
│   ├── public/             # Static assets
│   └── package.json
│
├── server/                 # Node.js signaling server
│   ├── src/
│   │   ├── index.js        # Entry point
│   │   ├── server.js       # Express HTTP server
│   │   ├── socket.js       # Socket.IO handlers
│   │   ├── roomManager.js  # Room management
│   │   └── logger.js       # Logging utility
│   └── package.json
│
├── DEPLOYMENT.md           # Deployment guide
├── PRODUCTION_READY.md     # Production checklist
└── README.md               # This file
```

### Technology Stack

#### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Zustand** - State management
- **Socket.IO Client** - Real-time communication
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible components

#### Backend
- **Node.js** - Runtime environment
- **Express** - HTTP server
- **Socket.IO** - WebSocket server
- **CORS** - Cross-origin resource sharing

### How It Works

1. **Signaling Server**: The Node.js backend handles WebRTC signaling (SDP offers/answers and ICE candidates)
2. **Peer Connection**: Once signaling is complete, peers connect directly via WebRTC (peer-to-peer)
3. **Media Streams**: Video/audio streams flow directly between peers, not through the server
4. **Room Management**: Server manages room membership (max 2 users per room)

### Data Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client A  │◄───────►│  Signaling   │◄───────►│  Client B   │
│  (Browser)  │         │    Server    │         │  (Browser)  │
└─────────────┘         └──────────────┘         └─────────────┘
       │                        │                        │
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   WebRTC P2P         │
                    │   (Direct Connection)│
                    └──────────────────────┘
```

---

## 📡 Socket Events

### Client → Server

| Event | Description | Payload |
|-------|-------------|---------|
| `join-room` | Join a room | `{ roomId, userId, name }` |
| `leave-room` | Leave the current room | `{ roomId }` |
| `offer` | Send WebRTC offer | `{ offer, targetSocketId }` |
| `answer` | Send WebRTC answer | `{ answer, targetSocketId }` |
| `ice-candidate` | Send ICE candidate | `{ candidate, targetSocketId }` |
| `host-changed` | Notify host change | `{ roomId }` |

### Server → Client

| Event | Description | Payload |
|-------|-------------|---------|
| `room-joined` | Room join confirmation | `{ roomId, isHost, otherUsers }` |
| `peer-joined` | Another peer joined | `{ userId, name, socketId }` |
| `peer-left` | Peer left the room | `{ userId, socketId }` |
| `create-offer` | Request to create offer | `{ targetSocketId, targetUserId }` |
| `offer` | Received WebRTC offer | `{ offer, fromSocketId, fromUserId }` |
| `answer` | Received WebRTC answer | `{ answer, fromSocketId, fromUserId }` |
| `ice-candidate` | Received ICE candidate | `{ candidate, fromSocketId }` |
| `host-changed` | Host changed | `{ hostId, hostName, socketId }` |
| `error` | Error occurred | `{ message }` |

---

## 🐛 Troubleshooting

### Connection Issues

- ✅ Ensure both frontend and backend are running
- ✅ Check browser console for errors
- ✅ Verify camera/microphone permissions are granted
- ✅ Check firewall settings (WebRTC may need UDP ports)
- ✅ Ensure both users are on the same network or have proper NAT traversal

### Media Issues

- ✅ Ensure camera/microphone are not being used by another application
- ✅ Try refreshing the page
- ✅ Check browser permissions in settings
- ✅ Verify browser supports WebRTC (Chrome, Firefox, Edge, Safari)

### Development Issues

- ✅ Clear browser cache if seeing stale code
- ✅ Restart both servers if changes aren't reflected
- ✅ Check terminal for error messages
- ✅ Verify environment variables are set correctly

### Screen Sharing Issues

- ✅ Only the host can share screen (check host status)
- ✅ Grant screen sharing permissions when prompted
- ✅ Ensure browser supports screen sharing API
- ✅ Check if screen share tracks are being detected

---

## 🚢 Deployment

### Render.com Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

#### Quick Deploy Steps

1. **Backend Deployment**
   - Create a Web Service on Render
   - Set build command: `cd server && npm install`
   - Set start command: `cd server && npm start`
   - Configure environment variables

2. **Frontend Deployment**
   - Create a Static Site on Render
   - Set build command: `cd client && npm install && npm run build`
   - Set publish directory: `client/dist`
   - Configure environment variables

### Other Platforms

The application can be deployed on:
- **Vercel** (Frontend)
- **Netlify** (Frontend)
- **Railway** (Backend)
- **Heroku** (Backend)
- **DigitalOcean** (Both)
- **AWS** (Both)

### Production Checklist

See [PRODUCTION_READY.md](./PRODUCTION_READY.md) for a complete production readiness checklist.

---

## 🧪 Development

### Available Scripts

#### Backend (`server/`)

```bash
npm start      # Start production server
npm run dev    # Start development server with auto-reload
```

#### Frontend (`client/`)

```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run preview # Preview production build
npm run lint   # Run ESLint
```

### Code Quality

- ✅ TypeScript for type safety
- ✅ ESLint for code linting
- ✅ Consistent code formatting
- ✅ Production-safe logging
- ✅ Comprehensive error handling

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **WebRTC** - For peer-to-peer communication
- **Socket.IO** - For real-time signaling
- **React** - For the amazing UI framework
- **Vite** - For the blazing-fast build tool

---

## 📧 Support

For issues, questions, or contributions, please open an issue on the repository.

---

<div align="center">

**Made with ❤️ for movie nights and virtual hangouts**

⭐ Star this repo if you find it useful!

</div>
