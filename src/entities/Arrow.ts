import Phaser from 'phaser';

const ARROW_SPEED = 500;
const ARROW_WIDTH = 10;
const ARROW_HEIGHT = 3;
const ARROW_GRAVITY = 700;
const EMBED_DEPTH = 4; // pixels d'enfoncement dans la plateforme

export class Arrow {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public stuck = false;
  public armed = false;
  private scene: Phaser.Scene;
  private spawnTime: number;
  private gravityEnabled = false;
  private lastVx = 0;
  private lastVy = 0;

  private static textureCreated = false;

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number, dirY: number) {
    this.scene = scene;

    if (!Arrow.textureCreated) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xf4a261);
      gfx.fillRect(0, 0, ARROW_WIDTH, ARROW_HEIGHT);
      // Pointe de flèche
      gfx.fillStyle(0xffffff);
      gfx.fillRect(ARROW_WIDTH - 2, 0, 2, ARROW_HEIGHT);
      gfx.generateTexture('arrow', ARROW_WIDTH, ARROW_HEIGHT);
      gfx.destroy();
      Arrow.textureCreated = true;
    }

    this.sprite = scene.physics.add.sprite(x, y, 'arrow');
    // Body carré petit pour que la collision soit précise quelle que soit la rotation
    this.sprite.setSize(4, 4);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(false);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0) {
      const vx = (dirX / len) * ARROW_SPEED;
      const vy = (dirY / len) * ARROW_SPEED;
      body.setVelocity(vx, vy);
      this.lastVx = vx;
      this.lastVy = vy;
    }

    // Pas de gravité au départ pour un tir bien horizontal
    body.setAllowGravity(false);

    this.updateRotation();
    this.spawnTime = scene.time.now;
  }

  update() {
    if (this.stuck) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Sauvegarder la vélocité avant que le collider ne la modifie
    this.lastVx = body.velocity.x;
    this.lastVy = body.velocity.y;

    const elapsed = this.scene.time.now - this.spawnTime;
    if (!this.armed && elapsed > 100) {
      this.armed = true;
    }

    if (!this.gravityEnabled && elapsed > 120) {
      this.gravityEnabled = true;
      body.setAllowGravity(true);
      body.setGravityY(ARROW_GRAVITY - 800);
    }

    this.updateRotation();
    this.wrapAround();
  }

  private updateRotation() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.sprite.rotation = Math.atan2(body.velocity.y, body.velocity.x);
  }

  stick() {
    if (this.stuck) return;
    this.stuck = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Enfoncer la flèche dans la plateforme selon sa direction de vol
    const absVx = Math.abs(this.lastVx);
    const absVy = Math.abs(this.lastVy);

    if (absVx > absVy) {
      // Impact horizontal : décaler en X
      this.sprite.x += Math.sign(this.lastVx) * EMBED_DEPTH;
    } else {
      // Impact vertical : décaler en Y
      this.sprite.y += Math.sign(this.lastVy) * EMBED_DEPTH;
    }
  }

  private wrapAround() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const halfW = ARROW_WIDTH / 2;
    const halfH = ARROW_HEIGHT / 2;

    if (this.sprite.x < -halfW) {
      this.sprite.x = width + halfW;
    } else if (this.sprite.x > width + halfW) {
      this.sprite.x = -halfW;
    }

    if (this.sprite.y < -halfH) {
      this.sprite.y = height + halfH;
    } else if (this.sprite.y > height + halfH) {
      this.sprite.y = -halfH;
    }
  }

  destroy() {
    this.sprite.destroy();
  }
}
