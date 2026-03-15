import Phaser from 'phaser';

const ARROW_SPEED = 400;
const ARROW_WIDTH = 10;
const ARROW_HEIGHT = 3;
const ARROW_GRAVITY = 600;

export class Arrow {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public stuck = false;
  public armed = false; // La flèche ne peut pas tuer tant qu'elle n'est pas armée
  private scene: Phaser.Scene;
  private spawnTime: number;

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
    this.sprite.setSize(ARROW_WIDTH, ARROW_HEIGHT);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(false);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Normaliser la direction et appliquer la vitesse
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0) {
      body.setVelocity((dirX / len) * ARROW_SPEED, (dirY / len) * ARROW_SPEED);
    }

    body.setAllowGravity(true);
    body.setGravityY(ARROW_GRAVITY - 800); // Compenser la gravité globale (800) pour obtenir ARROW_GRAVITY

    // Rotation initiale selon la direction
    this.updateRotation();

    // Délai d'armement pour éviter de tuer le tireur immédiatement
    this.spawnTime = scene.time.now;
  }

  update() {
    if (this.stuck) return;

    // Armer la flèche après 100ms (évite de tuer le tireur au spawn)
    if (!this.armed && this.scene.time.now - this.spawnTime > 100) {
      this.armed = true;
    }

    this.updateRotation();
    this.wrapAround();
  }

  private updateRotation() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.sprite.rotation = Math.atan2(body.velocity.y, body.velocity.x);
    // Retourner le sprite si la flèche va vers la gauche
    this.sprite.setFlipY(Math.abs(body.velocity.x) > 0 && body.velocity.x < 0 ? false : false);
  }

  stick() {
    if (this.stuck) return;
    this.stuck = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);
    // Garder la rotation figée au moment de l'impact
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
