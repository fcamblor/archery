// Types partagés entre client et serveur

export interface PlayerInfo {
  id: string;
  name: string;
  color: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: PlayerInfo[];
}

// Événements client → serveur
export interface ClientEvents {
  'create-room': (playerName: string) => void;
  'join-room': (code: string, playerName: string) => void;
  'start-game': () => void;
}

// Événements serveur → client
export interface ServerEvents {
  'room-created': (room: RoomInfo) => void;
  'room-joined': (room: RoomInfo) => void;
  'player-joined': (player: PlayerInfo) => void;
  'player-left': (playerId: string) => void;
  'game-starting': () => void;
  'error': (message: string) => void;
}
