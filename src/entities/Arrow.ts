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
  public canHitOwner = false;
  public arrowId: string;
  public ownerId: string;
  private scene: Phaser.Scene;
  private spawnTime: number;
  private gravityEnabled = false;
  private hasLeftOwner = false;
  private lastVx = 0;
  private lastVy = 0;
  private dropping = false;
  public spawner?: Phaser.Physics.Arcade.Sprite;
  public ownerColor: number;

  private static textureCreated = false;
  private static idCounter = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dirX: number, dirY: number, spawner?: Phaser.Physics.Arcade.Sprite, arrowId?: string, ownerId?: string, ownerColor?: number) {
    this.scene = scene;
    this.arrowId = arrowId ?? `arrow_${Date.now()}_${Arrow.idCounter++}`;
    this.ownerId = ownerId ?? '';
    this.ownerColor = ownerColor ?? 0xf4a261;

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

    // Limiter la vitesse max pour éviter le tunneling à travers les plateformes
    body.setMaxSpeed(ARROW_SPEED);

    this.spawner = spawner;
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

    // Permettre l'auto-kill une fois que la flèche a quitté la hitbox du tireur
    if (!this.canHitOwner && this.spawner) {
      if (this.hasLeftOwner) {
        this.canHitOwner = true;
      } else {
        const spBounds = this.spawner.getBounds();
        if (!spBounds.contains(this.sprite.x, this.sprite.y)) {
          this.hasLeftOwner = true;
        }
      }
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

    // Teinter la flèche avec la couleur du propriétaire
    this.sprite.setTint(this.ownerColor);
  }

  /** La flèche transperce le joueur et se plante au sol juste après */
  drop() {
    if (this.stuck) return;
    this.dropping = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Garder la vélocité horizontale réduite + forte composante vers le bas
    const vx = this.lastVx * 0.3;
    const vy = Math.max(this.lastVy, 0) + 400;
    body.setVelocity(vx, vy);
    body.setAllowGravity(true);
    body.setGravityY(ARROW_GRAVITY - 800);
    this.gravityEnabled = true;
    this.sprite.setTint(this.ownerColor);
  }

  /** Forcer la flèche à se planter à une position donnée (sync réseau) */
  stickAt(x: number, y: number, rotation: number) {
    if (this.stuck) return;
    this.stuck = true;
    this.sprite.setPosition(x, y);
    this.sprite.rotation = rotation;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Teinter la flèche avec la couleur du propriétaire
    this.sprite.setTint(this.ownerColor);
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

  /** Position de la pointe de la flèche (extrémité avant dans la direction de vol) */
  getTipPosition(): { x: number; y: number } {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len === 0) {
      // Flèche plantée : utiliser la dernière direction connue
      const lLen = Math.sqrt(this.lastVx * this.lastVx + this.lastVy * this.lastVy);
      if (lLen === 0) return { x: this.sprite.x, y: this.sprite.y };
      return {
        x: this.sprite.x + (this.lastVx / lLen) * (ARROW_WIDTH / 2),
        y: this.sprite.y + (this.lastVy / lLen) * (ARROW_WIDTH / 2),
      };
    }
    return {
      x: this.sprite.x + (vx / len) * (ARROW_WIDTH / 2),
      y: this.sprite.y + (vy / len) * (ARROW_WIDTH / 2),
    };
  }

  destroy() {
    this.sprite.destroy();
  }
}
