import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { LEVEL_1 } from '../levels/level1';

const TILE_SIZE = 16;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  constructor() {
    super('GameScene');
  }

  create() {
    this.buildLevel();
    this.player = new Player(this, 240, 200);
    this.physics.add.collider(this.player.sprite, this.platforms);
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
  }
}
