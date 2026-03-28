import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Arrow } from '../entities/Arrow';
import { LEVEL_1 } from '../levels/level1';
import { NetworkManager } from '../network/NetworkManager';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import type { PlayerState, ArrowData, ScoreBoard } from '../shared/types';

const TILE_SIZE = 16;
const SYNC_INTERVAL = 50; // ms entre chaque envoi d'état (20 Hz)

export class GameScene extends Phaser.Scene {
  private localPlayer!: Player;
  private players: Map<string, Player> = new Map();
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private arrows: Arrow[] = [];
  private fpsText!: Phaser.GameObjects.Text;
  private roundOverText?: Phaser.GameObjects.Text;
  private scoreTexts: Phaser.GameObjects.GameObject[] = [];
  private network!: NetworkManager;
  private lastSyncTime = 0;
  private roundEnded = false;
  private scores: ScoreBoard = {};
  private previousScores: ScoreBoard = {};
  private touchControls: TouchControls | null = null;

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

    this.buildLevel();
    this.spawnPlayers();
    this.setupLocalPlayerShooting();
    this.setupNetworkListeners();
    this.setupHUD();
    this.setupTouchControls();
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

    const localColor = this.localPlayer.color;
    this.localPlayer.setOnShoot((x, y, dir) => {
      const arrow = new Arrow(this, x, y, dir.x, dir.y, this.localPlayer.sprite, undefined, this.network.playerId, localColor);
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
        ownerColor: localColor,
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
      const arrow = new Arrow(this, data.x, data.y, data.dirX, data.dirY, owner?.sprite, data.arrowId, data.ownerId, data.ownerColor);
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

    // Fin de round (un joueur a gagné ce round, mais la partie continue)
    this.network.onRoundOver((winnerId, winnerName, scores) => {
      this.roundEnded = true;
      this.previousScores = { ...this.scores };
      this.scores = scores;
      const isMe = winnerId === this.network.playerId;
      const msg = winnerId === ''
        ? 'ÉGALITÉ !'
        : isMe ? 'ROUND GAGNÉ !' : `${winnerName} gagne le round !`;

      this.roundOverText = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 30,
        msg,
        {
          fontSize: '20px',
          color: isMe ? '#e9c46a' : '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 10 },
        },
      ).setOrigin(0.5).setDepth(200);

      this.showScoreBoard(scores);
    });

    // Nouveau round
    this.network.onNewRound((spawnPoints, scores) => {
      this.scores = scores;
      this.clearRoundUI();
      this.startNewRound(spawnPoints);
    });

    // Fin de partie (un joueur a atteint 5 points)
    this.network.onGameOver((winnerId, winnerName, scores) => {
      this.roundEnded = true;
      this.previousScores = { ...this.scores };
      this.scores = scores;
      const isMe = winnerId === this.network.playerId;
      const msg = isMe ? 'VICTOIRE FINALE !' : `${winnerName} remporte la partie !`;

      this.roundOverText = this.add.text(
        this.scale.width / 2, this.scale.height / 2 - 30,
        msg,
        {
          fontSize: '20px',
          color: isMe ? '#e9c46a' : '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000aa',
          padding: { x: 20, y: 10 },
        },
      ).setOrigin(0.5).setDepth(200);

      this.showScoreBoard(scores);

      // Retour au lobby après quelques secondes
      this.time.delayedCall(5000, () => {
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

  private setupTouchControls() {
    if (!isTouchDevice()) return;

    // Ajouter et lancer la scène de contrôles tactiles par-dessus la scène de jeu
    if (!this.scene.get('TouchControlsScene')) {
      this.scene.add('TouchControlsScene', TouchControls, false);
    }
    this.scene.launch('TouchControlsScene');
    this.touchControls = this.scene.get('TouchControlsScene') as TouchControls;

    // Connecter l'état virtuel au joueur local
    if (this.localPlayer && this.touchControls) {
      this.localPlayer.setVirtualInput(this.touchControls.state);
    }
  }

  private setupHUD() {
    this.fpsText = this.add.text(8, 8, '', {
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
          // Une flèche ne peut tuer son tireur qu'après avoir quitté sa hitbox
          if (arrow.ownerId === playerId && !arrow.canHitOwner) continue;

          // Les flèches peuvent toucher les autres joueurs immédiatement,
          // mais ne peuvent toucher leur tireur qu'après le délai d'armement
          const isOwner = arrow.ownerId === playerId;
          if ((!isOwner || arrow.armed) && this.tipHitsSprite(tip, player.sprite)) {
            if (playerId === localId && arrow.ownerId === localId) {
              // Le joueur local se tue avec sa propre flèche retombante
              this.network.sendPlayerHit(localId, 'arrow');
              player.die();
              arrow.drop();
            } else if (playerId === localId) {
              // Le joueur local est touché par une flèche distante
              // C'est le tireur (distant) qui devrait détecter, mais pour la réactivité
              // on laisse le serveur gérer via l'événement du tireur
              // On ne fait rien ici pour éviter les doubles détections
            } else if (arrow.ownerId === localId) {
              // Le joueur local a touché un joueur distant
              this.network.sendPlayerHit(playerId, 'arrow');
              player.die();
              arrow.drop();
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
    const myScore = this.scores[this.network.playerId] || 0;
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)} | flèches: ${this.arrows.length} | joueurs: ${this.countAlivePlayers()}/${this.players.size} | score: ${myScore}/5`);
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

  private showScoreBoard(scores: ScoreBoard) {
    this.clearScoreTexts();
    const room = this.network.room;
    if (!room) return;

    const startY = this.scale.height / 2 + 10;
    const rowHeight = 22;
    const skullChar = '💀';
    const skullSize = 14;
    const nameWidth = 70;
    const centerX = this.scale.width / 2;

    const sorted = room.players
      .map(p => ({ ...p, score: scores[p.id] || 0, prevScore: this.previousScores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);

    // Fond semi-transparent pour le tableau
    const bgHeight = sorted.length * rowHeight + 12;
    const bgWidth = nameWidth + 10 * skullSize + 20;
    const bg = this.add.rectangle(
      centerX, startY + (sorted.length * rowHeight) / 2 - 4,
      bgWidth, bgHeight,
      0x000000, 0.7,
    ).setDepth(200);
    this.scoreTexts.push(bg);

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const color = `#${p.color.toString(16).padStart(6, '0')}`;
      const y = startY + i * rowHeight;
      const rowLeft = centerX - bgWidth / 2 + 8;

      // Nom du joueur
      const nameText = this.add.text(rowLeft, y, p.name, {
        fontSize: '11px',
        color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(201);
      this.scoreTexts.push(nameText);

      const skullStartX = rowLeft + nameWidth;
      const prevCount = p.prevScore;
      const newCount = p.score;
      const delta = newCount - prevCount;

      // Crânes déjà acquis (affichés immédiatement)
      const stableCount = delta >= 0 ? prevCount : newCount;
      for (let s = 0; s < stableCount; s++) {
        const skull = this.add.text(skullStartX + s * skullSize, y, skullChar, {
          fontSize: '12px',
        }).setOrigin(0, 0.5).setDepth(201);
        this.scoreTexts.push(skull);
      }

      if (delta > 0) {
        // Nouveaux kills : animer les crânes un par un
        for (let d = 0; d < delta; d++) {
          const sx = skullStartX + (prevCount + d) * skullSize;
          const skull = this.add.text(sx, y, skullChar, {
            fontSize: '12px',
          }).setOrigin(0, 0.5).setDepth(201).setScale(0).setAlpha(0);
          this.scoreTexts.push(skull);

          this.tweens.add({
            targets: skull,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 300,
            delay: 700 + d * 200,
            ease: 'Back.easeOut',
          });
        }
      } else if (delta < 0) {
        // Auto-kill : griser les crânes perdus
        for (let d = 0; d < Math.abs(delta); d++) {
          const sx = skullStartX + (newCount + d) * skullSize;

          const skull = this.add.text(sx, y, skullChar, {
            fontSize: '12px',
          }).setOrigin(0, 0.5).setDepth(201);
          this.scoreTexts.push(skull);

          this.tweens.add({
            targets: skull,
            alpha: 0.3,
            duration: 400,
            delay: 700 + d * 200,
            ease: 'Sine.easeOut',
          });
        }
      }
    }
  }

  private clearScoreTexts() {
    for (const t of this.scoreTexts) {
      t.destroy();
    }
    this.scoreTexts = [];
  }

  private clearRoundUI() {
    this.roundOverText?.destroy();
    this.roundOverText = undefined;
    this.clearScoreTexts();
  }

  private startNewRound(spawnPoints: { id: string; x: number; y: number }[]) {
    // Détruire toutes les flèches
    for (const arrow of this.arrows) {
      arrow.destroy();
    }
    this.arrows = [];

    // Respawn tous les joueurs
    for (const sp of spawnPoints) {
      const player = this.players.get(sp.id);
      if (player) {
        player.respawn(sp.x, sp.y);
      }
    }

    // Réinitialiser le tir local (les colliders sont perdus lors du respawn)
    this.setupLocalPlayerShooting();

    this.roundEnded = false;
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
    this.clearRoundUI();
    // Arrêter la scène des contrôles tactiles
    if (this.touchControls) {
      this.scene.stop('TouchControlsScene');
      this.touchControls = null;
    }
  }

  shutdown() {
    this.cleanupGame();
  }
}
