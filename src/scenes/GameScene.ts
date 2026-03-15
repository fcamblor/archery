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
  private playerDead = false;

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
      const arrow = new Arrow(this, x, y, dir.x, dir.y);
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
    if (this.playerDead) return;

    this.player.update(delta);

    // Mise à jour des mobs
    for (const mob of this.mobs) {
      mob.update();
    }

    // Mise à jour des flèches + collisions
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update();

      if (!arrow.stuck) {
        // Collision flèche en vol → mobs (la flèche traverse le mob)
        for (let j = this.mobs.length - 1; j >= 0; j--) {
          const mob = this.mobs[j];
          if (mob.alive && this.checkOverlap(arrow.sprite, mob.sprite)) {
            mob.die();
            this.mobs.splice(j, 1);
            break;
          }
        }

        // Collision flèche en vol → joueur (armée uniquement, évite le suicide au tir)
        if (!arrow.stuck && arrow.armed && this.checkOverlap(arrow.sprite, this.player.sprite)) {
          this.killPlayer();
        }
      }

      // Ramasser les flèches plantées (uniquement stuck)
      if (arrow.stuck && this.checkOverlap(this.player.sprite, arrow.sprite)) {
        if (this.player.addArrow()) {
          arrow.destroy();
          this.arrows.splice(i, 1);
        }
      }
    }

    // Mise à jour du HUD
    this.arrowHud.setText('▲ '.repeat(this.player.arrowCount).trim());
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

  private checkOverlap(
    a: Phaser.Physics.Arcade.Sprite,
    b: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
  }
}
