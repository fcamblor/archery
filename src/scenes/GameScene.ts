import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Arrow } from '../entities/Arrow';
import { Mob } from '../entities/Mob';
import { LEVEL_1 } from '../levels/level1';

const TILE_SIZE = 16;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private arrows: Arrow[] = [];
  private mobs: Mob[] = [];
  private arrowHud!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private playerDead = false;

  // Perf instrumentation
  private perfTimings = {
    playerUpdate: 0,
    mobsUpdate: 0,
    arrowsUpdate: 0,
    hudUpdate: 0,
    totalUpdate: 0,
    getBoundsCount: 0,
    colliderCount: 0,
    gameObjectCount: 0,
  };
  private perfAccum: typeof GameScene.prototype.perfTimings = {
    playerUpdate: 0, mobsUpdate: 0, arrowsUpdate: 0, hudUpdate: 0,
    totalUpdate: 0, getBoundsCount: 0, colliderCount: 0, gameObjectCount: 0,
  };
  private perfFrameCount = 0;
  private lastPerfDisplay = 0;
  private lastArrowCount = -1;

  constructor() {
    super('GameScene');
  }

  create() {
    this.buildLevel();
    this.player = new Player(this, 240, 200);
    this.physics.add.collider(this.player.sprite, this.platforms);

    // Créer des mobs sur les plateformes
    this.spawnMobs();

    // Callback de tir
    this.player.setOnShoot((x, y, dir) => {
      const arrow = new Arrow(this, x, y, dir.x, dir.y, this.player.sprite);
      this.arrows.push(arrow);

      // Collision flèche → plateformes : la flèche se plante
      this.physics.add.collider(arrow.sprite, this.platforms, () => {
        arrow.stick();
      });
    });

    // HUD : compteur de flèches
    this.arrowHud = this.add.text(8, 8, '', {
      fontSize: '12px',
      color: '#f4a261',
      fontFamily: 'monospace',
    });
    this.arrowHud.setScrollFactor(0);
    this.arrowHud.setDepth(100);

    // FPS counter (debug)
    this.fpsText = this.add.text(8, 22, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(100);

    // Panneau de debug perf
    this.debugText = this.add.text(8, 36, '', {
      fontSize: '9px',
      color: '#66cc66',
      fontFamily: 'monospace',
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);
  }

  private buildLevel() {
    this.platforms = this.physics.add.staticGroup();

    const rows = LEVEL_1.length;
    const cols = LEVEL_1[0].length;

    // Fusionner les tuiles verticalement adjacentes par colonne
    // pour éliminer les coutures qui causent des collisions parasites
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

  private spawnMobs() {
    // Positions de spawn des mobs (sur les plateformes principales)
    const spawnPoints = [
      { x: 120, y: 300 },  // sur le sol gauche
      { x: 360, y: 300 },  // sur le sol droite
      { x: 240, y: 155 },  // sur la plateforme centrale
      { x: 100, y: 210 },  // sur la plateforme gauche
      { x: 350, y: 210 },  // sur la plateforme droite
    ];

    for (const point of spawnPoints) {
      const mob = new Mob(this, point.x, point.y);
      this.physics.add.collider(mob.sprite, this.platforms);
      this.mobs.push(mob);
    }
  }

  update(_time: number, delta: number) {
    const t0 = performance.now();
    if (this.playerDead) return;

    this.perfTimings.getBoundsCount = 0;

    // --- Player update ---
    const tPlayer0 = performance.now();
    this.player.update(delta);
    this.perfTimings.playerUpdate = performance.now() - tPlayer0;

    // --- Mobs update + collision mob → joueur ---
    const tMobs0 = performance.now();
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update();
      if (mob.alive && this.checkOverlap(mob.sprite, this.player.sprite)) {
        if (this.isStomping(this.player.sprite, mob.sprite)) {
          mob.die(true);
          this.mobs.splice(i, 1);
          playerBody.setVelocityY(-200);
          this.stompEffect(mob.sprite.x, mob.sprite.y);
        } else {
          this.killPlayer();
          return;
        }
      }
    }
    this.perfTimings.mobsUpdate = performance.now() - tMobs0;

    // --- Arrows update + collisions ---
    const tArrows0 = performance.now();
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update();

      if (!arrow.stuck) {
        const tip = arrow.getTipPosition();

        for (let j = this.mobs.length - 1; j >= 0; j--) {
          const mob = this.mobs[j];
          if (mob.alive && this.tipHitsSprite(tip, mob.sprite)) {
            mob.die();
            this.mobs.splice(j, 1);
            break;
          }
        }

        if (!arrow.stuck && arrow.armed && arrow.spawner !== this.player.sprite
            && this.tipHitsSprite(tip, this.player.sprite)) {
          this.killPlayer();
        }
      }

      if (arrow.stuck && this.checkOverlap(this.player.sprite, arrow.sprite)) {
        if (this.player.addArrow()) {
          arrow.destroy();
          this.arrows.splice(i, 1);
        }
      }
    }
    this.perfTimings.arrowsUpdate = performance.now() - tArrows0;

    // --- HUD update ---
    const tHud0 = performance.now();
    // Arrow HUD : dirty flag
    if (this.player.arrowCount !== this.lastArrowCount) {
      this.arrowHud.setText('▲ '.repeat(this.player.arrowCount).trim());
      this.lastArrowCount = this.player.arrowCount;
    }
    // FPS + debug : update toutes les 500ms seulement
    const now = _time;
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)} | arrows: ${this.arrows.length} | mobs: ${this.mobs.length}`);
    this.perfTimings.hudUpdate = performance.now() - tHud0;

    this.perfTimings.totalUpdate = performance.now() - t0;

    // Compteurs de santé
    this.perfTimings.colliderCount = (this.physics.world as any)._colliders?.length
      ?? (this.physics.world.colliders as any)?.getActive?.()?.length ?? -1;
    this.perfTimings.gameObjectCount = this.children.length;

    // Accumulation pour affichage moyenné
    for (const key of Object.keys(this.perfTimings) as (keyof typeof this.perfTimings)[]) {
      this.perfAccum[key] += this.perfTimings[key];
    }
    this.perfFrameCount++;

    // Affichage debug toutes les 500ms
    if (now - this.lastPerfDisplay >= 500) {
      const n = this.perfFrameCount || 1;
      const avg = (k: keyof typeof this.perfTimings) => (this.perfAccum[k] / n).toFixed(2);
      this.debugText.setText(
        `update: ${avg('totalUpdate')}ms\n` +
        `  player: ${avg('playerUpdate')}ms\n` +
        `  mobs:   ${avg('mobsUpdate')}ms\n` +
        `  arrows: ${avg('arrowsUpdate')}ms\n` +
        `  hud:    ${avg('hudUpdate')}ms\n` +
        `getBounds: ${avg('getBoundsCount')}/frame\n` +
        `colliders: ${Math.round(this.perfAccum.colliderCount / n)}\n` +
        `objects:   ${Math.round(this.perfAccum.gameObjectCount / n)}`
      );
      this.lastPerfDisplay = now;
      // Reset accum
      for (const key of Object.keys(this.perfAccum) as (keyof typeof this.perfAccum)[]) {
        this.perfAccum[key] = 0;
      }
      this.perfFrameCount = 0;
    }
  }

  private killPlayer() {
    this.playerDead = true;
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setEnable(false);

    // Animation de mort du joueur
    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        // Respawn après un délai
        this.time.delayedCall(800, () => {
          this.respawnPlayer();
        });
      },
    });
  }

  private respawnPlayer() {
    this.player.sprite.setPosition(240, 200);
    this.player.sprite.setAlpha(1);
    this.player.sprite.setScale(1);
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setAllowGravity(true);
    body.setVelocity(0, 0);
    this.playerDead = false;
  }

  /**
   * Détecte si le sprite A est en train de piétiner le sprite B.
   * Conditions : A tombe (vélocité Y > 0) et le bas de A est dans la moitié haute de B.
   */
  private isStomping(
    stomper: Phaser.Physics.Arcade.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const stomperBody = stomper.body as Phaser.Physics.Arcade.Body;
    if (stomperBody.velocity.y <= 0) return false;

    this.perfTimings.getBoundsCount += 2;
    const stomperBounds = stomper.getBounds();
    const targetBounds = target.getBounds();
    const targetMidY = targetBounds.y + targetBounds.height / 2;

    return stomperBounds.bottom >= targetBounds.y && stomperBounds.bottom <= targetMidY;
  }

  private stompEffect(x: number, y: number) {
    // Particules d'écrasement : petits éclats autour du point de stomp
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

  /** Vérifie si un point (la pointe de la flèche) est dans les bounds d'un sprite */
  private tipHitsSprite(
    tip: { x: number; y: number },
    target: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    this.perfTimings.getBoundsCount++;
    const bounds = target.getBounds();
    return bounds.contains(tip.x, tip.y);
  }

  private checkOverlap(
    a: Phaser.Physics.Arcade.Sprite,
    b: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    this.perfTimings.getBoundsCount += 2;
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
  }
}
