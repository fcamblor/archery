import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, RoomInfo, PlayerInfo } from '../shared/types';

// Le serveur Socket.io tourne sur le même hôte que la page, port 3001
const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:3001`;

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export class NetworkManager {
  private static instance: NetworkManager;
  socket: TypedSocket;
  room: RoomInfo | null = null;
  playerId: string = '';
  isHost = false;

  private constructor() {
    this.socket = io(SERVER_URL, { autoConnect: false });
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve();
        return;
      }
      this.socket.connect();
      this.socket.once('connect', () => {
        this.playerId = this.socket.id!;
        resolve();
      });
      this.socket.once('connect_error', (err) => {
        reject(err);
      });
    });
  }

  createRoom(playerName: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      this.socket.emit('create-room', playerName);
      this.socket.once('room-created', (room: RoomInfo) => {
        this.room = room;
        this.isHost = true;
        resolve(room);
      });
      this.socket.once('error', (msg: string) => reject(new Error(msg)));
    });
  }

  joinRoom(code: string, playerName: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-room', code, playerName);

      const onJoined = (room: RoomInfo) => {
        this.room = room;
        this.isHost = false;
        this.socket.off('error', onError);
        resolve(room);
      };
      const onError = (msg: string) => {
        this.socket.off('room-joined', onJoined);
        reject(new Error(msg));
      };

      this.socket.once('room-joined', onJoined);
      this.socket.once('error', onError);
    });
  }

  startGame() {
    this.socket.emit('start-game');
  }

  onPlayerJoined(cb: (player: PlayerInfo) => void) {
    this.socket.on('player-joined', cb);
  }

  onPlayerLeft(cb: (playerId: string) => void) {
    this.socket.on('player-left', cb);
  }

  onGameStarting(cb: () => void) {
    this.socket.on('game-starting', cb);
  }

  removeAllGameListeners() {
    this.socket.off('player-joined');
    this.socket.off('player-left');
    this.socket.off('game-starting');
  }

  disconnect() {
    this.socket.disconnect();
    this.room = null;
    this.isHost = false;
  }
}
