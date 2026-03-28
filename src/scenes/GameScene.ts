import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Arrow } from '../entities/Arrow';
import { LEVEL_1 } from '../levels/level1';
import { NetworkManager } from '../network/NetworkManager';
import type { PlayerState, ArrowData } from '../shared/types';

const TILE_SIZE = 16;
const SYNC_INTERVAL = 50; // ms entre chaque envoi d'état (20 Hz)

export class GameScene extends Phaser.Scene {
  private localPlayer!: Player;
  private players: Map<string, Player> = new Map();
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private arrows: Arrow[] = [];
  private arrowHud!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private roundOverText?: Phaser.GameObjects.Text;
  private network!: NetworkManager;
  private lastSyncTime = 0;
  private lastArrowCount = -1;
  private roundEnded = false;

  // Données reçues du lobby
  private spawnPoints: { id: string; x: number; y: number }[] = [];

  constructor() {
    super('GameScene');
  }

  init(data: { networked?: boolean; spawnPoints?: { id: string; x: number; y: number }[] }) {
    this.spawnPoints = data.spawnPoints ?? [];
  }

  create() {
    this.network = NetworkManager.getInstance();
    this.players.clear();
    this.arrows = [];
    this.roundEnded = false;
    this.lastArrowCount = -1;

    this.buildLevel();
    this.spawnPlayers();
    this.setupLocalPlayerShooting();
    this.setupNetworkListeners();
    this.setupHUD();
  }

  private buildLevel() {
    this.platforms = this.physics.add.staticGroup();

    const rows = LEVEL_1.length;
    const cols = LEVEL_1[0].length;

    for (let col = 0; col < cols; col++) {
      let runStart = -1;
      for (let row = 0; row <= rows; row++) {
        const isSolid = row < rows && LEVEL_1[row][col] === 1;
        if (isSolid && runStart === -1) {
          runStart = row;
        } else if (!isSolid && runStart !== -1) {
          const runLength = row - runStart;
          const x = col * TILE_SIZE + TILE_SIZE / 2;
          const y = runStart * TILE_SIZE + (runLength * TILE_SIZE) / 2;
          const block = this.add.rectangle(x, y, TILE_SIZE, runLength * TILE_SIZE, 0x4a4e69);
          this.platforms.add(block);
          runStart = -1;
        }
      }
    }
  }

  private spawnPlayers() {
    const room = this.network.room;
    if (!room) return;

    for (const sp of this.spawnPoints) {
      const info = room.players.find(p => p.id === sp.id);
      if (!info) continue;

      const isLocal = sp.id === this.network.playerId;
      const player = new Player(this, sp.x, sp.y, {
        color: info.color,
        isRemote: !isLocal,
        playerId: info.id,
        playerName: info.name,
      });

      this.physics.add.collider(player.sprite, this.platforms);
      this.players.set(info.id, player);

      if (isLocal) {
        this.localPlayer = player;
      }
    }

  }

  private setupLocalPlayerShooting() {
    if (!this.localPlayer) return;

    this.localPlayer.setOnShoot((x, y, dir) => {
      const arrow = new Arrow(this, x, y, dir.x, dir.y, this.localPlayer.sprite, undefined, this.network.playerId);
      this.arrows.push(arrow);

      // Collision flèche → plateformes
      this.physics.add.collider(arrow.sprite, this.platforms, () => {
        arrow.stick();
        // Notifier le réseau
        this.network.sendArrowStuck(arrow.arrowId, arrow.sprite.x, arrow.sprite.y, arrow.sprite.rotation);
      });

      // Notifier le réseau du tir
      this.network.sendArrowFired({
        arrowId: arrow.arrowId,
        ownerId: this.network.playerId,
        x, y,
        dirX: dir.x,
        dirY: dir.y,
      });
    });
  }

  private setupNetworkListeners() {
    // Mise à jour d'état des joueurs distants
    this.network.onPlayerState((state: PlayerState) => {
      const player = this.players.get(state.id);
      if (player && player.isRemote) {
        player.applyRemoteState(state);
      }
    });

    // Flèche tirée par un joueur distant
    this.network.onArrowSpawned((data: ArrowData) => {
      const owner = this.players.get(data.ownerId);
      const arrow = new Arrow(this, data.x, data.y, data.dirX, data.dirY, owner?.sprite, data.arrowId, data.ownerId);
      this.arrows.push(arrow);

      this.physics.add.collider(arrow.sprite, this.platforms, () => {
        arrow.stick();
      });
    });

    // Flèche plantée (sync réseau)
    this.network.onArrowStuckSync((arrowId, x, y, rotation) => {
      const arrow = this.arrows.find(a => a.arrowId === arrowId);
      if (arrow && !arrow.stuck) {
        arrow.stickAt(x, y, rotation);
      }
    });

    // Flèche ramassée par un joueur distant
    this.network.onArrowPickedUp((arrowId, playerId) => {
      const idx = this.arrows.findIndex(a => a.arrowId === arrowId);
      if (idx !== -1) {
        this.arrows[idx].destroy();
        this.arrows.splice(idx, 1);
      }
      const player = this.players.get(playerId);
      if (player) {
        player.addArrow();
      }
    });

    // Joueur tué
    this.network.onPlayerDied((victimId, _killerId, method) => {
      const victim = this.players.get(victimId);
      if (victim) {
        victim.die(method === 'stomp');
      }
    });

    // Fin de round
    this.network.onRoundOver((winnerId, winnerName) => {
      this.roundEnded = true;
      const isMe = winnerId === this.network.playerId;
      const msg = winnerId === ''
        ? 'ÉGALITÉ !'
        : isMe ? 'VICTOIRE !' : `${winnerName} gagne !`;

      this.roundOverText = this.add.text(
        this.scale.width / 2, this.scale.height / 2,
        msg,
        {
          fontSize: '24px',
          color: isMe ? '#e9c46a' : '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 10 },
        },
      ).setOrigin(0.5).setDepth(200);

      // Retour au lobby après quelques secondes
      this.time.delayedCall(3000, () => {
        this.cleanupGame();
        this.scene.start('LobbyScene', { mode: this.network.isHost ? 'host' : 'join', returning: true });
      });
    });

    // Joueur déconnecté en cours de jeu
    this.network.onPlayerDisconnected((playerId) => {
      const player = this.players.get(playerId);
      if (player) {
        player.die();
        this.players.delete(playerId);
      }
    });
  }

  private setupHUD() {
    this.arrowHud = this.add.text(8, 8, '', {
      fontSize: '12px',
      color: '#f4a261',
      fontFamily: 'monospace',
    });
    this.arrowHud.setScrollFactor(0);
    this.arrowHud.setDepth(100);

    this.fpsText = this.add.text(8, 22, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(100);
  }

  update(time: number, delta: number) {
    if (this.roundEnded) return;

    // Update tous les joueurs
    for (const player of this.players.values()) {
      player.update(delta);
    }

    // Synchroniser l'état local à intervalle régulier
    if (this.localPlayer?.alive && time - this.lastSyncTime >= SYNC_INTERVAL) {
      this.lastSyncTime = time;
      const body = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body;
      this.network.sendPlayerUpdate({
        id: this.network.playerId,
        x: this.localPlayer.sprite.x,
        y: this.localPlayer.sprite.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        facing: this.localPlayer.facing,
        arrowCount: this.localPlayer.arrowCount,
        alive: this.localPlayer.alive,
      });
    }

    // Update et collisions des flèches
    this.updateArrows();

    // Stomp entre joueurs (le local détecte les stomps qu'il inflige) — avant la résolution de collision
    this.checkStomps();

    // Collision physique entre joueurs (résolution manuelle car les remote sont téléportés)
    this.resolvePlayerCollisions();

    // HUD
    this.updateHUD();
  }

  private updateArrows() {
    const localId = this.network.playerId;

    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update();

      if (!arrow.stuck) {
        const tip = arrow.getTipPosition();

        // Vérifier les kills par flèche — le joueur local détecte les hits sur les autres
        // et les flèches des autres sur le joueur local
        for (const [playerId, player] of this.players) {
          if (!player.alive) continue;
          // Une flèche ne peut pas tuer son propre tireur
          if (arrow.ownerId === playerId) continue;

          if (arrow.armed && this.tipHitsSprite(tip, player.sprite)) {
            if (playerId === localId) {
              // Le joueur local est touché par une flèche distante
              // C'est le tireur (distant) qui devrait détecter, mais pour la réactivité
              // on laisse le serveur gérer via l'événement du tireur
              // On ne fait rien ici pour éviter les doubles détections
            } else if (arrow.ownerId === localId) {
              // Le joueur local a touché un joueur distant
              this.network.sendPlayerHit(playerId, 'arrow');
              player.die();
            }
          }
        }
      }

      // Ramassage de flèches plantées par le joueur local
      if (arrow.stuck && this.localPlayer?.alive) {
        if (this.checkOverlap(this.localPlayer.sprite, arrow.sprite)) {
          if (this.localPlayer.addArrow()) {
            this.network.sendArrowPickup(arrow.arrowId);
            arrow.destroy();
            this.arrows.splice(i, 1);
          }
        }
      }
    }
  }

  private resolvePlayerCollisions() {
    if (!this.localPlayer?.alive) return;

    const localSprite = this.localPlayer.sprite;
    const localBody = localSprite.body as Phaser.Physics.Arcade.Body;
    const localId = this.network.playerId;

    for (const [playerId, player] of this.players) {
      if (playerId === localId || !player.alive) continue;

      const otherSprite = player.sprite;
      const localBounds = localSprite.getBounds();
      const otherBounds = otherSprite.getBounds();

      if (!Phaser.Geom.Intersects.RectangleToRectangle(localBounds, otherBounds)) continue;

      // Calculer la pénétration sur chaque axe
      const overlapX = Math.min(localBounds.right - otherBounds.left, otherBounds.right - localBounds.left);
      const overlapY = Math.min(localBounds.bottom - otherBounds.top, otherBounds.bottom - localBounds.top);

      // Pousser le joueur local hors de l'overlap sur l'axe de moindre pénétration
      if (overlapX < overlapY) {
        const pushDir = localSprite.x < otherSprite.x ? -1 : 1;
        localSprite.x += pushDir * overlapX;
        localBody.setVelocityX(0);
      } else {
        const pushDir = localSprite.y < otherSprite.y ? -1 : 1;
        localSprite.y += pushDir * overlapY;
        if (pushDir === -1) {
          // Poussé vers le haut = on est "posé" sur l'autre joueur
          localBody.setVelocityY(0);
          localBody.blocked.down = true;
        } else {
          // Poussé vers le bas = on cogne la tête
          localBody.setVelocityY(0);
        }
      }
    }
  }

  private checkStomps() {
    if (!this.localPlayer?.alive) return;

    const localBody = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body;
    const localId = this.network.playerId;

    for (const [playerId, player] of this.players) {
      if (playerId === localId || !player.alive) continue;

      if (this.checkOverlap(this.localPlayer.sprite, player.sprite)) {
        if (this.isStomping(this.localPlayer.sprite, player.sprite)) {
          // Stomp !
          this.network.sendPlayerHit(playerId, 'stomp');
          player.die(true);
          localBody.setVelocityY(-200);
          this.stompEffect(player.sprite.x, player.sprite.y);
        } else if (this.isStomping(player.sprite, this.localPlayer.sprite)) {
          // Le joueur distant nous stomp — le distant détectera ça de son côté
          // On ne fait rien ici pour éviter les doubles détections
        }
      }
    }
  }

  private updateHUD() {
    if (this.localPlayer && this.localPlayer.arrowCount !== this.lastArrowCount) {
      this.arrowHud.setText('▲ '.repeat(this.localPlayer.arrowCount).trim());
      this.lastArrowCount = this.localPlayer.arrowCount;
    }
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)} | flèches: ${this.arrows.length} | joueurs: ${this.countAlivePlayers()}/${this.players.size}`);
  }

  private countAlivePlayers(): number {
    let count = 0;
    for (const p of this.players.values()) {
      if (p.alive) count++;
    }
    return count;
  }

  private isStomping(
    stomper: Phaser.Physics.Arcade.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const stomperBody = stomper.body as Phaser.Physics.Arcade.Body;
    if (stomperBody.velocity.y <= 0) return false;

    const stomperBounds = stomper.getBounds();
    const targetBounds = target.getBounds();
    const targetMidY = targetBounds.y + targetBounds.height / 2;

    return stomperBounds.bottom >= targetBounds.y && stomperBounds.bottom <= targetMidY;
  }

  private stompEffect(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const particle = this.add.rectangle(
        x + Phaser.Math.Between(-8, 8),
        y,
        3,
        3,
        0xffff00,
      );
      this.tweens.add({
        targets: particle,
        alpha: 0,
        y: y + Phaser.Math.Between(-12, 12),
        x: particle.x + Phaser.Math.Between(-16, 16),
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private tipHitsSprite(
    tip: { x: number; y: number },
    target: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const bounds = target.getBounds();
    return bounds.contains(tip.x, tip.y);
  }

  private checkOverlap(
    a: Phaser.Physics.Arcade.Sprite,
    b: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
  }

  private cleanupGame() {
    this.network.removeAllGameListeners();
    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();
    for (const arrow of this.arrows) {
      arrow.destroy();
    }
    this.arrows = [];
    this.roundOverText?.destroy();
  }

  shutdown() {
    this.cleanupGame();
  }
}
