import Phaser from 'phaser';

const MOB_SIZE = 12;
const MOB_SPEED = 40;

export class Mob {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public alive = true;
  private scene: Phaser.Scene;
  private direction = 1; // 1 = droite, -1 = gauche

  private static textureCreated = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    if (!Mob.textureCreated) {
      const gfx = scene.add.graphics();
      // Corps vert
      gfx.fillStyle(0x2a9d8f);
      gfx.fillRect(0, 0, MOB_SIZE, MOB_SIZE);
      // Yeux
      gfx.fillStyle(0xffffff);
      gfx.fillRect(2, 2, 3, 3);
      gfx.fillRect(7, 2, 3, 3);
      gfx.generateTexture('mob', MOB_SIZE, MOB_SIZE);
      gfx.destroy();
      Mob.textureCreated = true;
    }

    this.sprite = scene.physics.add.sprite(x, y, 'mob');
    this.sprite.setSize(MOB_SIZE, MOB_SIZE);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(false);

    // Direction initiale aléatoire
    this.direction = Math.random() < 0.5 ? -1 : 1;
  }

  update() {
    if (!this.alive) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Se déplacer horizontalement
    body.setVelocityX(MOB_SPEED * this.direction);

    // Inverser la direction si bloqué par un mur
    let wallBounced = false;
    if (body.blocked.left) {
      this.direction = 1;
      wallBounced = true;
    } else if (body.blocked.right) {
      this.direction = -1;
      wallBounced = true;
    }

    // Détection de bord de plateforme : inverser avant de tomber
    // (sauf si on vient de rebondir sur un mur, pour éviter la double inversion)
    if (body.blocked.down && !wallBounced) {
      this.checkEdge();
    }

    // Wrap-around sur tous les bords
    this.wrapAround();
  }

  private checkEdge() {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Vérifier s'il y a du sol devant le mob en utilisant un rayon vers le bas
    const checkX = this.sprite.x + this.direction * (MOB_SIZE / 2 + 2);
    const checkY = this.sprite.y + MOB_SIZE / 2 + 4;

    // Vérifier si un body solide existe sous le prochain pas
    const bodies = this.scene.physics.overlapRect(checkX, checkY, 2, 2);
    if (bodies.length === 0) {
      this.direction *= -1;
      body.setVelocityX(MOB_SPEED * this.direction);
    }
  }

  private wrapAround() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const half = MOB_SIZE / 2;

    if (this.sprite.x < -half) {
      this.sprite.x = width + half;
    } else if (this.sprite.x > width + half) {
      this.sprite.x = -half;
    }

    if (this.sprite.y < -half) {
      this.sprite.y = height + half;
    } else if (this.sprite.y > height + half) {
      this.sprite.y = -half;
    }
  }

  die(stomped = false) {
    if (!this.alive) return;
    this.alive = false;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setEnable(false);

    if (stomped) {
      // Animation de stomp : écrasement vertical + disparition
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 0.2,
        duration: 250,
        ease: 'Power2',
        onComplete: () => {
          this.sprite.destroy();
        },
      });
    } else {
      // Animation de mort par flèche : expansion + disparition
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          this.sprite.destroy();
        },
      });
    }
  }

  destroy() {
    this.sprite.destroy();
  }
}
