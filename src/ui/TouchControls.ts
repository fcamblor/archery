import Phaser from 'phaser';

/** Seuil de déplacement du joystick (en pixels) pour déclencher une direction */
const JOYSTICK_THRESHOLD = 0.3;
const JOYSTICK_RADIUS = 40;
const JOYSTICK_THUMB_RADIUS = 18;
const BUTTON_RADIUS = 24;
const BUTTON_MARGIN = 16;
const UI_ALPHA = 0.35;
const UI_ALPHA_ACTIVE = 0.6;
const UI_DEPTH = 1000;

export interface VirtualInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shoot: boolean;
  menu: boolean;
}

/**
 * Contrôles tactiles pour mobile/tablette.
 * Joystick virtuel à gauche, boutons saut/tir à droite.
 * Se superpose à la scène de jeu via une scène Phaser dédiée.
 */
export class TouchControls extends Phaser.Scene {
  // État virtuel lu par le Player
  public state: VirtualInputState = {
    left: false, right: false, up: false, down: false,
    jump: false, shoot: false, menu: false,
  };

  // Joystick
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private joystickPointerId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };

  // Boutons
  private jumpBtn!: Phaser.GameObjects.Arc;
  private shootBtn!: Phaser.GameObjects.Arc;
  private menuBtn!: Phaser.GameObjects.Arc;
  private jumpLabel!: Phaser.GameObjects.Text;
  private shootLabel!: Phaser.GameObjects.Text;
  private menuLabel!: Phaser.GameObjects.Text;
  private jumpPointerId: number | null = null;
  private shootPointerId: number | null = null;

  // Flags "just pressed" pour saut et tir (consommés par le Player)
  private _jumpJustPressed = false;
  private _shootJustPressed = false;
  private _menuJustPressed = false;

  constructor() {
    super({ key: 'TouchControlsScene', active: false });
  }

  create() {
    const { width, height } = this.scale;

    // --- Joystick (zone gauche) ---
    const jx = JOYSTICK_RADIUS + BUTTON_MARGIN + 10;
    const jy = height - JOYSTICK_RADIUS - BUTTON_MARGIN - 10;
    this.joystickCenter = { x: jx, y: jy };

    this.joystickBase = this.add.circle(jx, jy, JOYSTICK_RADIUS, 0xffffff, UI_ALPHA)
      .setDepth(UI_DEPTH).setStrokeStyle(2, 0xffffff, UI_ALPHA);
    this.joystickThumb = this.add.circle(jx, jy, JOYSTICK_THUMB_RADIUS, 0xffffff, UI_ALPHA_ACTIVE)
      .setDepth(UI_DEPTH + 1);

    // --- Boutons (zone droite) ---
    const bx1 = width - BUTTON_RADIUS - BUTTON_MARGIN - 60;
    const bx2 = width - BUTTON_RADIUS - BUTTON_MARGIN;
    const by = height - BUTTON_RADIUS - BUTTON_MARGIN - 10;

    this.jumpBtn = this.add.circle(bx1, by, BUTTON_RADIUS, 0x2a9d8f, UI_ALPHA)
      .setDepth(UI_DEPTH).setStrokeStyle(2, 0x2a9d8f, UI_ALPHA_ACTIVE);
    this.jumpLabel = this.add.text(bx1, by, 'SAUT', {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(UI_DEPTH + 1).setAlpha(UI_ALPHA_ACTIVE);

    this.shootBtn = this.add.circle(bx2, by - 50, BUTTON_RADIUS, 0xe76f51, UI_ALPHA)
      .setDepth(UI_DEPTH).setStrokeStyle(2, 0xe76f51, UI_ALPHA_ACTIVE);
    this.shootLabel = this.add.text(bx2, by - 50, 'TIR', {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(UI_DEPTH + 1).setAlpha(UI_ALPHA_ACTIVE);

    // --- Bouton menu (coin haut-gauche) ---
    const menuRadius = 18;
    const mx = menuRadius + BUTTON_MARGIN;
    const my = menuRadius + BUTTON_MARGIN;
    this.menuBtn = this.add.circle(mx, my, menuRadius, 0x888888, UI_ALPHA)
      .setDepth(UI_DEPTH).setStrokeStyle(2, 0x888888, UI_ALPHA_ACTIVE);
    this.menuLabel = this.add.text(mx, my, '✕', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(UI_DEPTH + 1).setAlpha(UI_ALPHA_ACTIVE);

    // --- Gestion multi-touch ---
    this.input.addPointer(2); // Jusqu'à 3 pointeurs simultanés

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerMove(pointer);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerUp(pointer);
    });
  }

  /** Indique si le saut vient d'être pressé (consommé après lecture) */
  consumeJumpPress(): boolean {
    if (this._jumpJustPressed) {
      this._jumpJustPressed = false;
      return true;
    }
    return false;
  }

  /** Indique si le tir vient d'être pressé (consommé après lecture) */
  consumeShootPress(): boolean {
    if (this._shootJustPressed) {
      this._shootJustPressed = false;
      return true;
    }
    return false;
  }

  /** Indique si le bouton menu vient d'être pressé (consommé après lecture) */
  consumeMenuPress(): boolean {
    if (this._menuJustPressed) {
      this._menuJustPressed = false;
      return true;
    }
    return false;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const { x, y } = pointer;

    // Bouton menu (testé en premier pour ne pas être capturé par la zone joystick)
    if (this.hitTest(x, y, this.menuBtn, 18 * 1.5)) {
      this._menuJustPressed = true;
      this.state.menu = true;
      this.menuBtn.setAlpha(UI_ALPHA_ACTIVE);
      return;
    }

    // Zone joystick (quart inférieur gauche de l'écran)
    if (x < this.scale.width / 2 && y > this.scale.height / 2 && this.joystickPointerId === null) {
      this.joystickPointerId = pointer.id;
      // Repositionner le joystick à l'endroit du toucher
      this.joystickCenter = { x, y };
      this.joystickBase.setPosition(x, y);
      this.joystickThumb.setPosition(x, y);
      this.joystickBase.setAlpha(UI_ALPHA_ACTIVE);
      return;
    }

    // Bouton saut
    if (this.hitTest(x, y, this.jumpBtn, BUTTON_RADIUS * 1.3)) {
      this.jumpPointerId = pointer.id;
      this._jumpJustPressed = true;
      this.state.jump = true;
      this.jumpBtn.setAlpha(UI_ALPHA_ACTIVE);
      return;
    }

    // Bouton tir
    if (this.hitTest(x, y, this.shootBtn, BUTTON_RADIUS * 1.3)) {
      this.shootPointerId = pointer.id;
      this._shootJustPressed = true;
      this.state.shoot = true;
      this.shootBtn.setAlpha(UI_ALPHA_ACTIVE);
      return;
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.joystickPointerId) {
      const dx = pointer.x - this.joystickCenter.x;
      const dy = pointer.y - this.joystickCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Limiter le thumb au rayon du joystick
      const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const thumbX = this.joystickCenter.x + Math.cos(angle) * clampedDist;
      const thumbY = this.joystickCenter.y + Math.sin(angle) * clampedDist;
      this.joystickThumb.setPosition(thumbX, thumbY);

      // Normaliser la distance pour le seuil
      const norm = clampedDist / JOYSTICK_RADIUS;
      const nx = Math.cos(angle) * norm;
      const ny = Math.sin(angle) * norm;

      this.state.left = nx < -JOYSTICK_THRESHOLD;
      this.state.right = nx > JOYSTICK_THRESHOLD;
      this.state.up = ny < -JOYSTICK_THRESHOLD;
      this.state.down = ny > JOYSTICK_THRESHOLD;
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickThumb.setPosition(this.joystickCenter.x, this.joystickCenter.y);
      this.joystickBase.setAlpha(UI_ALPHA);
      this.state.left = false;
      this.state.right = false;
      this.state.up = false;
      this.state.down = false;
    }
    if (pointer.id === this.jumpPointerId) {
      this.jumpPointerId = null;
      this.state.jump = false;
      this.jumpBtn.setAlpha(UI_ALPHA);
    }
    if (pointer.id === this.shootPointerId) {
      this.shootPointerId = null;
      this.state.shoot = false;
      this.shootBtn.setAlpha(UI_ALPHA);
    }
  }

  private hitTest(x: number, y: number, obj: Phaser.GameObjects.Arc, radius: number): boolean {
    const dx = x - obj.x;
    const dy = y - obj.y;
    return dx * dx + dy * dy <= radius * radius;
  }
}

/** Détecte si l'appareil supporte le tactile */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
