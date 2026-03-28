import { createServer } from 'http';
import { Server } from 'socket.io';
import type { PlayerInfo, RoomInfo, ClientEvents, ServerEvents } from '../src/shared/types';

const PORT = 3001;

const httpServer = createServer();
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: '*' },
});

// Couleurs disponibles pour les joueurs
const PLAYER_COLORS = [
  0xe76f51, // orange-rouge (joueur actuel)
  0x2a9d8f, // vert-bleu
  0xe9c46a, // jaune
  0x264653, // bleu foncé
  0xf4a261, // orange
  0x9b5de5, // violet
];

// Stockage des rooms
const rooms = new Map<string, RoomInfo>();
// Mapping socketId → roomCode
const playerRooms = new Map<string, string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Éviter les collisions
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

io.on('connection', (socket) => {
  console.log(`Joueur connecté: ${socket.id}`);

  socket.on('create-room', (playerName: string) => {
    const code = generateRoomCode();
    const player: PlayerInfo = {
      id: socket.id,
      name: playerName || 'Joueur 1',
      color: PLAYER_COLORS[0],
    };
    const room: RoomInfo = {
      code,
      hostId: socket.id,
      players: [player],
    };
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('room-created', room);
    console.log(`Room ${code} créée par ${player.name}`);
  });

  socket.on('join-room', (code: string, playerName: string) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('error', 'Code de partie invalide');
      return;
    }
    if (room.players.length >= 6) {
      socket.emit('error', 'Partie pleine (6 joueurs max)');
      return;
    }

    const player: PlayerInfo = {
      id: socket.id,
      name: playerName || `Joueur ${room.players.length + 1}`,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
    };
    room.players.push(player);
    playerRooms.set(socket.id, code);
    socket.join(code);

    // Notifier le nouveau joueur avec l'état complet de la room
    socket.emit('room-joined', room);
    // Notifier les autres joueurs
    socket.to(code).emit('player-joined', player);
    console.log(`${player.name} a rejoint la room ${code}`);
  });

  socket.on('start-game', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId !== socket.id) return;

    console.log(`Partie lancée dans la room ${code}`);
    io.to(code).emit('game-starting');
  });

  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    playerRooms.delete(socket.id);

    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`Room ${code} supprimée (vide)`);
    } else {
      // Si l'hôte quitte, transférer au premier joueur restant
      if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
        console.log(`Nouvel hôte dans ${code}: ${room.players[0].name}`);
      }
      io.to(code).emit('player-left', socket.id);
    }
    console.log(`Joueur déconnecté: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Serveur Towerfall démarré sur le port ${PORT}`);
});
