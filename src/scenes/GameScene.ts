import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Arrow } from '../entities/Arrow';
import { LEVEL_1 } from '../levels/level1';

const TILE_SIZE = 16;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private arrows: Arrow[] = [];
  private arrowHud!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create() {
    this.buildLevel();
    this.player = new Player(this, 240, 200);
    this.physics.add.collider(this.player.sprite, this.platforms);

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

  update(_time: number, delta: number) {
    this.player.update(delta);

    // Mise à jour des flèches
    for (const arrow of this.arrows) {
      arrow.update();
    }

    // Ramasser les flèches plantées
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
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

  private checkOverlap(
    a: Phaser.Physics.Arcade.Sprite,
    b: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
  }
}
