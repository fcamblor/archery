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

// État d'un joueur synchronisé en réseau
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  arrowCount: number;
  alive: boolean;
}

// Données d'une flèche tirée
export interface ArrowData {
  arrowId: string;
  ownerId: string;
  ownerColor: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

// Scores des joueurs
export interface ScoreBoard {
  [playerId: string]: number;
}

// Événements client → serveur
export interface ClientEvents {
  'create-room': (playerName: string) => void;
  'join-room': (code: string, playerName: string) => void;
  'start-game': () => void;
  // Gameplay
  'player-update': (state: PlayerState) => void;
  'arrow-fired': (data: ArrowData) => void;
  'arrow-stuck': (arrowId: string, x: number, y: number, rotation: number) => void;
  'arrow-pickup': (arrowId: string) => void;
  'player-hit': (victimId: string, method: 'arrow' | 'stomp') => void;
  'player-respawned': () => void;
}

// Événements serveur → client
export interface ServerEvents {
  'room-created': (room: RoomInfo) => void;
  'room-joined': (room: RoomInfo) => void;
  'player-joined': (player: PlayerInfo) => void;
  'player-left': (playerId: string) => void;
  'game-starting': (spawnPoints: { id: string; x: number; y: number }[]) => void;
  'error': (message: string) => void;
  // Gameplay
  'player-state': (state: PlayerState) => void;
  'arrow-spawned': (data: ArrowData) => void;
  'arrow-stuck-sync': (arrowId: string, x: number, y: number, rotation: number) => void;
  'arrow-picked-up': (arrowId: string, playerId: string) => void;
  'player-died': (victimId: string, killerId: string, method: 'arrow' | 'stomp') => void;
  'player-respawned': (playerId: string, x: number, y: number) => void;
  'round-over': (winnerId: string, winnerName: string, scores: ScoreBoard) => void;
  'new-round': (spawnPoints: { id: string; x: number; y: number }[], scores: ScoreBoard) => void;
  'game-over': (winnerId: string, winnerName: string, scores: ScoreBoard) => void;
  'player-disconnected': (playerId: string) => void;
}
