import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type UserRole = 'host' | 'viewer';

interface MediaState {
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
}

interface User {
  id: string;
  name: string;
  role: UserRole;
  mediaState: MediaState;
  stream: MediaStream | null;
}

interface RoomState {
  roomId: string | null;
  connectionStatus: ConnectionStatus;
  localUser: User | null;
  remoteUser: User | null;
  screenShareStream: MediaStream | null;
  hostId: string | null;
  isRemoteAudioMuted: boolean;
  
  // Actions
  setRoomId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLocalUser: (user: User | null) => void;
  setRemoteUser: (user: User | null) => void;
  updateLocalMedia: (updates: Partial<MediaState>) => void;
  updateRemoteMedia: (updates: Partial<MediaState>) => void;
  setScreenShareStream: (stream: MediaStream | null) => void;
  setHostId: (id: string | null) => void;
  setRemoteAudioMuted: (muted: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  resetRoom: () => void;
}

const initialState = {
  roomId: null,
  connectionStatus: 'disconnected' as ConnectionStatus,
  localUser: null,
  remoteUser: null,
  screenShareStream: null,
  hostId: null,
  isRemoteAudioMuted: false,
};

export const useRoomStore = create<RoomState>((set) => ({
  ...initialState,
  
  setRoomId: (id) => set({ roomId: id }),
  
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  
  setLocalUser: (user) => set({ localUser: user }),
  
  setRemoteUser: (user) => set({ remoteUser: user }),
  
  updateLocalMedia: (updates) =>
    set((state) => ({
      localUser: state.localUser
        ? { ...state.localUser, mediaState: { ...state.localUser.mediaState, ...updates } }
        : null,
    })),
  
  updateRemoteMedia: (updates) =>
    set((state) => ({
      remoteUser: state.remoteUser
        ? { ...state.remoteUser, mediaState: { ...state.remoteUser.mediaState, ...updates } }
        : null,
    })),
  
  setScreenShareStream: (stream) => set({ screenShareStream: stream }),
  
  setHostId: (id) => set({ hostId: id }),
  
  setRemoteAudioMuted: (muted) => set({ isRemoteAudioMuted: muted }),
  
  setLocalStream: (stream) =>
    set((state) => ({
      localUser: state.localUser ? { ...state.localUser, stream } : null,
    })),
  
  setRemoteStream: (stream) =>
    set((state) => ({
      remoteUser: state.remoteUser ? { ...state.remoteUser, stream } : null,
    })),
  
  resetRoom: () => set(initialState),
}));
