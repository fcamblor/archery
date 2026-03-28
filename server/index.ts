import { createServer } from 'http';
import { Server } from 'socket.io';
import type { PlayerInfo, RoomInfo, ClientEvents, ServerEvents, PlayerState } from '../src/shared/types';

const PORT = 3001;

const httpServer = createServer();
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: '*' },
});

// Couleurs disponibles pour les joueurs
const PLAYER_COLORS = [
  0xe76f51, // orange-rouge
  0x2a9d8f, // vert-bleu
  0xe9c46a, // jaune
  0x264653, // bleu foncé
  0xf4a261, // orange
  0x9b5de5, // violet
];

// Points de spawn répartis sur le niveau
const SPAWN_POINTS = [
  { x: 120, y: 300 },
  { x: 360, y: 300 },
  { x: 240, y: 155 },
  { x: 100, y: 100 },
  { x: 380, y: 100 },
  { x: 240, y: 250 },
];

// Stockage des rooms
const rooms = new Map<string, RoomInfo>();
// Mapping socketId → roomCode
const playerRooms = new Map<string, string>();
// Joueurs vivants par room (pour détection de victoire)
const alivePlayersInRoom = new Map<string, Set<string>>();

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

function checkRoundOver(code: string) {
  const alive = alivePlayersInRoom.get(code);
  const room = rooms.get(code);
  if (!alive || !room) return;

  // Il faut au moins 2 joueurs dans la room pour un round
  if (room.players.length < 2) return;

  if (alive.size === 1) {
    const winnerId = [...alive][0];
    const winner = room.players.find(p => p.id === winnerId);
    io.to(code).emit('round-over', winnerId, winner?.name || 'Inconnu');
  } else if (alive.size === 0) {
    // Tout le monde est mort simultanément — pas de gagnant
    io.to(code).emit('round-over', '', 'Personne');
  }
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

    // Attribuer les spawn points
    const spawnPoints = room.players.map((p, i) => ({
      id: p.id,
      x: SPAWN_POINTS[i % SPAWN_POINTS.length].x,
      y: SPAWN_POINTS[i % SPAWN_POINTS.length].y,
    }));

    // Initialiser le tracking des joueurs vivants
    const alive = new Set(room.players.map(p => p.id));
    alivePlayersInRoom.set(code, alive);

    console.log(`Partie lancée dans la room ${code} avec ${room.players.length} joueurs`);
    io.to(code).emit('game-starting', spawnPoints);
  });

  // --- Événements gameplay ---

  socket.on('player-update', (state: PlayerState) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    // Relayer à tous les autres joueurs de la room
    socket.to(code).emit('player-state', state);
  });

  socket.on('arrow-fired', (data) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    socket.to(code).emit('arrow-spawned', data);
  });

  socket.on('arrow-stuck', (arrowId, x, y, rotation) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    socket.to(code).emit('arrow-stuck-sync', arrowId, x, y, rotation);
  });

  socket.on('arrow-pickup', (arrowId) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    socket.to(code).emit('arrow-picked-up', arrowId, socket.id);
  });

  socket.on('player-hit', (victimId, method) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;

    // Marquer la victime comme morte
    const alive = alivePlayersInRoom.get(code);
    if (alive) {
      alive.delete(victimId);
    }

    io.to(code).emit('player-died', victimId, socket.id, method);
    checkRoundOver(code);
  });

  socket.on('player-respawned', () => {
    // En mode round, pas de respawn — mais on garde pour compatibilité future
  });

  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    playerRooms.delete(socket.id);

    // Retirer des joueurs vivants
    const alive = alivePlayersInRoom.get(code);
    if (alive) {
      alive.delete(socket.id);
    }

    if (room.players.length === 0) {
      rooms.delete(code);
      alivePlayersInRoom.delete(code);
      console.log(`Room ${code} supprimée (vide)`);
    } else {
      // Si l'hôte quitte, transférer au premier joueur restant
      if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
        console.log(`Nouvel hôte dans ${code}: ${room.players[0].name}`);
      }
      io.to(code).emit('player-left', socket.id);
      io.to(code).emit('player-disconnected', socket.id);

      // Vérifier si le round est terminé après déconnexion
      if (alive) {
        checkRoundOver(code);
      }
    }
    console.log(`Joueur déconnecté: ${socket.id}`);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur Towerfall démarré sur 0.0.0.0:${PORT}`);
});
