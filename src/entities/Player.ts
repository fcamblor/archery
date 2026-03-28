import Phaser from 'phaser';

const SPEED = 160;
const JUMP_VELOCITY = -300;
const WALL_JUMP_VELOCITY = -200;
const WALL_JUMP_PUSH = 200;
const PLAYER_SIZE = 12;
const INITIAL_ARROWS = 4;
const MAX_ARROWS = 8;

export type AimDirection = { x: number; y: number };

export interface PlayerOptions {
  color?: number;
  isRemote?: boolean;
  playerId?: string;
  playerName?: string;
}

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public arrowCount = INITIAL_ARROWS;
  public playerId: string;
  public playerName: string;
  public isRemote: boolean;
  public alive = true;
  public facing: 'left' | 'right' = 'right';

  // Contrôles basés sur event.code (position physique, indépendant AZERTY/QWERTY)
  private keys: Record<string, boolean> = {};
  private justPressed: Set<string> = new Set();
  private scene: Phaser.Scene;
  private isClinging = false;
  private clingDirection: 'left' | 'right' | null = null;
  private wallJumpCooldown = 0;
  private onShoot?: (x: number, y: number, dir: AimDirection) => void;
  private color: number;
  private nameText: Phaser.GameObjects.Text;

  // Compteur de textures pour éviter les collisions de noms
  private static textureIndex = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PlayerOptions = {}) {
    this.scene = scene;
    this.color = opts.color ?? 0xe76f51;
    this.isRemote = opts.isRemote ?? false;
    this.playerId = opts.playerId ?? '';
    this.playerName = opts.playerName ?? 'Joueur';

    // Créer une texture unique par couleur
    const texKey = `player_${Player.textureIndex++}`;
    const gfx = scene.add.graphics();
    gfx.fillStyle(this.color);
    gfx.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    // Yeux blancs pour distinguer la direction
    gfx.fillStyle(0xffffff);
    gfx.fillRect(7, 2, 3, 3);
    gfx.fillRect(2, 2, 3, 3);
    gfx.generateTexture(texKey, PLAYER_SIZE, PLAYER_SIZE);
    gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, texKey);
    this.sprite.setSize(PLAYER_SIZE, PLAYER_SIZE);
    this.sprite.setBounce(0);
    this.sprite.setCollideWorldBounds(false);

    // Nom au-dessus du joueur
    this.nameText = scene.add.text(x, y - 12, this.playerName, {
      fontSize: '7px',
      color: `#${this.color.toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Contrôles clavier basés sur event.code (position physique — fonctionne AZERTY et QWERTY)
    if (!this.isRemote) {
      scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
        if (!this.keys[event.code]) {
          this.justPressed.add(event.code);
        }
        this.keys[event.code] = true;
      });
      scene.input.keyboard!.on('keyup', (event: KeyboardEvent) => {
        this.keys[event.code] = false;
      });
    }
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
    // Mettre à jour le nom au-dessus du sprite
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 12);
    this.nameText.setVisible(this.alive);

    if (this.isRemote || !this.alive) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    const left = this.isKeyDown('KeyA');
    const right = this.isKeyDown('KeyD');
    const jump = this.isJustPressed('KeyK');
    const shoot = this.isJustPressed('KeyO');

    // Déplacement horizontal (désactivé pendant l'éjection du wall jump)
    if (this.wallJumpCooldown <= 0) {
      if (left) {
        body.setVelocityX(-SPEED);
      } else if (right) {
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
    if (jump) {
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
    if (left) this.facing = 'left';
    else if (right) this.facing = 'right';

    // Tir de flèche
    if (shoot && this.arrowCount > 0) {
      const aim = this.getAimDirection();
      this.arrowCount--;
      this.onShoot?.(this.sprite.x, this.sprite.y, aim);
    }

    // Wrap-around sur tous les bords
    this.wrapAround();

    // Vider les justPressed après le traitement de la frame
    this.justPressed.clear();
  }

  /** Appliquer un état reçu du réseau (joueur remote) */
  applyRemoteState(state: { x: number; y: number; vx: number; vy: number; facing: 'left' | 'right'; arrowCount: number }) {
    if (!this.isRemote) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Repositionner via le body (pas setPosition) pour que les collisions restent actives
    body.reset(state.x, state.y);
    body.setVelocity(state.vx, state.vy);
    this.facing = state.facing;
    this.arrowCount = state.arrowCount;
  }

  die(stomped = false) {
    if (!this.alive) return;
    this.alive = false;
    this.nameText.setVisible(false);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setEnable(false);

    if (stomped) {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 0.2,
        duration: 250,
        ease: 'Power2',
      });
    } else {
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 400,
        ease: 'Power2',
      });
    }
  }

  respawn(x: number, y: number) {
    this.alive = true;
    this.sprite.setPosition(x, y);
    this.sprite.setAlpha(1);
    this.sprite.setScale(1);
    this.nameText.setVisible(true);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.setAllowGravity(true);
    body.setVelocity(0, 0);
  }

  /** Vérifie si une touche physique est enfoncée (via event.code) */
  private isKeyDown(code: string): boolean {
    return !!this.keys[code];
  }

  /** Vérifie si une touche vient d'être pressée cette frame */
  private isJustPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  private getAimDirection(): AimDirection {
    let dx = 0;
    let dy = 0;

    if (this.isKeyDown('KeyA')) dx = -1;
    else if (this.isKeyDown('KeyD')) dx = 1;

    if (this.isKeyDown('KeyW')) dy = -1;
    else if (this.isKeyDown('KeyS')) dy = 1;

    // Si aucune direction n'est pressée, tirer dans la direction du regard
    if (dx === 0 && dy === 0) {
      dx = this.facing === 'left' ? -1 : 1;
    }

    return { x: dx, y: dy };
  }

  private wallCling(body: Phaser.Physics.Arcade.Body) {
    const isAirborne = !body.blocked.down;
    const isPushingLeft = this.isKeyDown('KeyA') && body.blocked.left;
    const isPushingRight = this.isKeyDown('KeyD') && body.blocked.right;
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

  destroy() {
    this.sprite.destroy();
    this.nameText.destroy();
  }
}
