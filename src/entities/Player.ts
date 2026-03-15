import Phaser from 'phaser';

const SPEED = 160;
const JUMP_VELOCITY = -300;
const WALL_JUMP_VELOCITY = -200;
const WALL_JUMP_PUSH = 200;
const PLAYER_SIZE = 12;
const INITIAL_ARROWS = 4;
const MAX_ARROWS = 8;

export type AimDirection = { x: number; y: number };

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public arrowCount = INITIAL_ARROWS;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private shootKey: Phaser.Input.Keyboard.Key;
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private isClinging = false;
  private clingDirection: 'left' | 'right' | null = null;
  private wallJumpCooldown = 0;
  private facing: 'left' | 'right' = 'right';
  private onShoot?: (x: number, y: number, dir: AimDirection) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Créer une texture placeholder pour le joueur
    this.gfx = scene.add.graphics();
    this.gfx.fillStyle(0xe76f51);
    this.gfx.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    this.gfx.generateTexture('player', PLAYER_SIZE, PLAYER_SIZE);
    this.gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setSize(PLAYER_SIZE, PLAYER_SIZE);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(false);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.shootKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  setOnShoot(callback: (x: number, y: number, dir: AimDirection) => void) {
    this.onShoot = callback;
  }

  addArrow(): boolean {
    if (this.arrowCount >= MAX_ARROWS) return false;
    this.arrowCount++;
    return true;
  }

  update(_delta: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Déplacement horizontal (désactivé pendant l'éjection du wall jump)
    if (this.wallJumpCooldown <= 0) {
      if (this.cursors.left.isDown) {
        body.setVelocityX(-SPEED);
      } else if (this.cursors.right.isDown) {
        body.setVelocityX(SPEED);
      } else {
        body.setVelocityX(0);
      }
    }

    // Cooldown après wall jump pour éviter de re-coller au mur immédiatement
    if (this.wallJumpCooldown > 0) {
      this.wallJumpCooldown -= _delta;
    }

    // Saut : depuis le sol ou wall jump depuis le mur
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      if (body.blocked.down) {
        body.setVelocityY(JUMP_VELOCITY);
      } else if (this.isClinging) {
        body.setAllowGravity(true);
        body.setVelocityY(WALL_JUMP_VELOCITY);
        // Éjecter à l'opposé du mur
        const pushDir = this.clingDirection === 'left' ? 1 : -1;
        body.setVelocityX(pushDir * WALL_JUMP_PUSH);
        this.wallJumpCooldown = 150;
      }
    }

    // Wall cling : rester collé au mur quand on est en l'air et qu'on appuie contre un mur
    this.wallCling(body);

    // Mise à jour de la direction du joueur
    if (this.cursors.left.isDown) this.facing = 'left';
    else if (this.cursors.right.isDown) this.facing = 'right';

    // Tir de flèche
    if (Phaser.Input.Keyboard.JustDown(this.shootKey) && this.arrowCount > 0) {
      const aim = this.getAimDirection();
      this.arrowCount--;
      this.onShoot?.(this.sprite.x, this.sprite.y, aim);
    }

    // Wrap-around sur tous les bords
    this.wrapAround();
  }

  private getAimDirection(): AimDirection {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx = -1;
    else if (this.cursors.right.isDown) dx = 1;

    if (this.cursors.up.isDown) dy = -1;
    else if (this.cursors.down.isDown) dy = 1;

    // Si aucune direction n'est pressée, tirer dans la direction du regard
    if (dx === 0 && dy === 0) {
      dx = this.facing === 'left' ? -1 : 1;
    }

    return { x: dx, y: dy };
  }

  private wallCling(body: Phaser.Physics.Arcade.Body) {
    const isAirborne = !body.blocked.down;
    const isPushingLeft = this.cursors.left.isDown && body.blocked.left;
    const isPushingRight = this.cursors.right.isDown && body.blocked.right;
    this.isClinging = isAirborne && (isPushingLeft || isPushingRight) && this.wallJumpCooldown <= 0;
    this.clingDirection = this.isClinging ? (isPushingLeft ? 'left' : 'right') : null;

    if (this.isClinging) {
      body.setVelocityY(0);
      body.setAllowGravity(false);
    } else {
      body.setAllowGravity(true);
    }
  }

  private wrapAround() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const halfW = PLAYER_SIZE / 2;
    const halfH = PLAYER_SIZE / 2;

    // Gauche/Droite
    if (this.sprite.x < -halfW) {
      this.sprite.x = width + halfW;
    } else if (this.sprite.x > width + halfW) {
      this.sprite.x = -halfW;
    }

    // Haut/Bas
    if (this.sprite.y < -halfH) {
      this.sprite.y = height + halfH;
    } else if (this.sprite.y > height + halfH) {
      this.sprite.y = -halfH;
    }
  }
}
