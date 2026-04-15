import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Arrow } from '../entities/Arrow';
import { Mob } from '../entities/Mob';
import { LEVEL_1 } from '../levels/level1';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { ComboTracker } from '../entities/ComboTracker';
import { ComboHUD } from '../ui/ComboHUD';

const TILE_SIZE = 16;
const MOB_COUNT = 5;
const MOB_RESPAWN_DELAY = 3000; // ms avant respawn d'un mob tué
const PLAYER_RESPAWN_DELAY = 2000; // ms avant respawn du joueur
const PLAYER_INVINCIBLE_DURATION = 2000; // ms d'invincibilité après respawn
const MOB_HARMLESS_DURATION = 1500; // ms d'inoffensivité après spawn d'un mob

// Points de spawn pour les mobs (sur les plateformes)
const MOB_SPAWN_POINTS = [
  { x: 14 * TILE_SIZE, y: 3 * TILE_SIZE },  // plateforme haute centrale
  { x: 2 * TILE_SIZE, y: 7 * TILE_SIZE },    // plateforme gauche
  { x: 28 * TILE_SIZE, y: 7 * TILE_SIZE },   // plateforme droite
  { x: 14 * TILE_SIZE, y: 10 * TILE_SIZE },  // grande plateforme centrale
  { x: 6 * TILE_SIZE, y: 13 * TILE_SIZE },   // petite plateforme gauche
  { x: 22 * TILE_SIZE, y: 13 * TILE_SIZE },  // petite plateforme droite
  { x: 14 * TILE_SIZE, y: 16 * TILE_SIZE },  // plateforme basse centrale
  { x: 4 * TILE_SIZE, y: 19 * TILE_SIZE },   // sol gauche
  { x: 15 * TILE_SIZE, y: 19 * TILE_SIZE },  // sol centre
  { x: 26 * TILE_SIZE, y: 19 * TILE_SIZE },  // sol droite
];

// Points de spawn pour le joueur
const PLAYER_SPAWN_POINTS = [
  { x: 120, y: 300 },
  { x: 360, y: 300 },
  { x: 240, y: 155 },
  { x: 100, y: 100 },
  { x: 380, y: 100 },
  { x: 240, y: 250 },
];

export class TrainingScene extends Phaser.Scene {
  private localPlayer!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private arrows: Arrow[] = [];
  private mobs: Mob[] = [];
  private score = 0;
  private hudText!: Phaser.GameObjects.Text;
  private touchControls: TouchControls | null = null;
  private comboTracker!: ComboTracker;
  private comboHUD!: ComboHUD;

  constructor() {
    super('TrainingScene');
  }

  create() {
    this.arrows = [];
    this.mobs = [];
    this.score = 0;

    this.buildLevel();
    this.spawnPlayer();
    this.setupShooting();
    this.spawnInitialMobs();
    this.setupHUD();
    this.comboTracker = new ComboTracker({
      onComboHit: (state) => this.comboHUD.animateHit(state),
      onComboEnd: (finalCount) => this.comboHUD.hideCombo(finalCount),
    });
    this.comboHUD = new ComboHUD(this);
    this.setupTouchControls();
  }

  private buildLevel() {
    this.platforms = this.physics.add.staticGroup();

    const rows = LEVEL_1.length;
    const cols = LEVEL_1[0].length;

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

  private spawnPlayer() {
    const sp = Phaser.Utils.Array.GetRandom(PLAYER_SPAWN_POINTS);
    this.localPlayer = new Player(this, sp.x, sp.y, {
      color: 0xe76f51,
      isRemote: false,
      playerId: 'local',
      playerName: 'Joueur',
    });
    this.physics.add.collider(this.localPlayer.sprite, this.platforms);
  }

  private setupShooting() {
    if (!this.localPlayer) return;

    this.localPlayer.setOnShoot((x, y, dir) => {
      const arrow = new Arrow(this, x, y, dir.x, dir.y, this.localPlayer.sprite, undefined, 'local', 0xe76f51);
      this.arrows.push(arrow);

      this.physics.add.collider(arrow.sprite, this.platforms, () => {
        arrow.stick();
      });
    });
  }

  private spawnInitialMobs() {
    // Mélanger les points de spawn et en prendre MOB_COUNT
    const shuffled = Phaser.Utils.Array.Shuffle([...MOB_SPAWN_POINTS]);
    for (let i = 0; i < MOB_COUNT; i++) {
      this.spawnMob(shuffled[i % shuffled.length]);
    }
  }

  private spawnMob(point: { x: number; y: number }) {
    const mob = new Mob(this, point.x, point.y);
    mob.setHarmless(MOB_HARMLESS_DURATION);
    this.physics.add.collider(mob.sprite, this.platforms);
    this.mobs.push(mob);
  }

  private respawnMob() {
    // Choisir un point de spawn aléatoire
    const point = Phaser.Utils.Array.GetRandom(MOB_SPAWN_POINTS);
    this.spawnMob(point);
  }

  private setupHUD() {
    this.hudText = this.add.text(8, 8, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100);

    // Touche Escape pour retourner au titre
    this.input.keyboard!.on('keydown-ESC', () => {
      this.cleanupGame();
      this.scene.start('TitleScene');
    });

    // Hints clavier (desktop uniquement)
    if (!isTouchDevice()) {
      this.showKeyboardHints();
    }
  }

  private async showKeyboardHints() {
    const keyLabels = await this.resolveKeyLabels({
      left: 'KeyA',
      right: 'KeyD',
      up: 'KeyW',
      down: 'KeyS',
      jump: 'KeyK',
      shoot: 'KeyO',
    });

    const hintsLines = [
      `${keyLabels.left}/${keyLabels.right} = déplacer`,
      `${keyLabels.jump} = sauter`,
      `${keyLabels.shoot} = tirer`,
      `${keyLabels.up}/${keyLabels.down} = viser`,
      `ESC = retour`,
    ];

    this.add.text(this.scale.width / 2, this.scale.height - 10, hintsLines.join('   '), {
      fontSize: '8px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(100);
  }

  private async resolveKeyLabels(codes: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    // Fallback : extraire la lettre du code (ex: "KeyA" → "A")
    for (const [key, code] of Object.entries(codes)) {
      result[key] = code.replace('Key', '');
    }
    // Tenter d'utiliser l'API Keyboard Layout Map pour les labels réels
    try {
      if ('keyboard' in navigator && 'getLayoutMap' in (navigator as any).keyboard) {
        const layoutMap = await (navigator as any).keyboard.getLayoutMap();
        for (const [key, code] of Object.entries(codes)) {
          const label = layoutMap.get(code);
          if (label) {
            result[key] = label.toUpperCase();
          }
        }
      }
    } catch {
      // L'API n'est pas disponible, on garde le fallback
    }
    return result;
  }

  private setupTouchControls() {
    if (!isTouchDevice()) return;

    if (!this.scene.get('TouchControlsScene')) {
      this.scene.add('TouchControlsScene', TouchControls, false);
    }
    this.scene.launch('TouchControlsScene');
    this.touchControls = this.scene.get('TouchControlsScene') as TouchControls;

    if (this.localPlayer && this.touchControls) {
      this.localPlayer.setVirtualInput(this.touchControls.state);
    }
  }

  update(time: number, delta: number) {
    // Bouton menu tactile → retour au titre
    if (this.touchControls?.consumeMenuPress()) {
      this.cleanupGame();
      this.scene.start('TitleScene');
      return;
    }

    // Update joueur
    this.localPlayer.update(delta);

    // Combo : le sol brise le combo rebond si le debounce est aussi expiré
    if (this.localPlayer.alive) {
      const body = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (body?.blocked.down) {
        this.comboTracker.notifyGrounded(this.time.now);
      }
      this.comboTracker.update(this.time.now);
    }

    // Update mobs
    for (const mob of this.mobs) {
      mob.update();
    }

    // Update flèches et détection de kills
    this.updateArrows();

    // Stomp sur les mobs
    this.checkStomps();

    // HUD
    this.updateHUD();
  }

  private updateArrows() {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      arrow.update();

      if (!arrow.stuck) {
        const tip = arrow.getTipPosition();

        // Vérifier les kills sur les mobs
        for (let m = this.mobs.length - 1; m >= 0; m--) {
          const mob = this.mobs[m];
          if (!mob.alive) continue;

          if (this.tipHitsSprite(tip, mob.sprite)) {
            mob.die(false);
            arrow.drop();
            this.score++;
            this.comboTracker.registerKill('arrow', this.time.now);
            this.scheduleRespawnMob();
            break;
          }
        }

        // Auto-kill : la flèche peut tuer le joueur (pas si invincible)
        if (this.localPlayer.alive && !this.localPlayer.invincible && arrow.canHitOwner && arrow.armed) {
          if (this.tipHitsSprite(tip, this.localPlayer.sprite)) {
            this.localPlayer.die();
            arrow.drop();
            this.scheduleRespawnPlayer();
          }
        }
      }

      // Ramassage de flèches plantées
      if (arrow.stuck && this.localPlayer.alive) {
        if (this.checkOverlap(this.localPlayer.sprite, arrow.sprite)) {
          if (this.localPlayer.addArrow()) {
            arrow.destroy();
            this.arrows.splice(i, 1);
          }
        }
      }
    }
  }

  private checkStomps() {
    if (!this.localPlayer.alive) return;

    const localBody = this.localPlayer.sprite.body as Phaser.Physics.Arcade.Body;

    for (let m = this.mobs.length - 1; m >= 0; m--) {
      const mob = this.mobs[m];
      if (!mob.alive) continue;

      if (this.checkOverlap(this.localPlayer.sprite, mob.sprite)) {
        if (this.isStomping(this.localPlayer.sprite, mob.sprite)) {
          // Stomp : le joueur tue le mob
          mob.die(true);
          localBody.setVelocityY(-200);
          this.stompEffect(mob.sprite.x, mob.sprite.y);
          this.score++;
          this.comboTracker.registerKill('stomp', this.time.now);
          this.scheduleRespawnMob();
        } else if (!this.localPlayer.invincible && !mob.harmless) {
          // Contact sans stomp : le mob tue le joueur (sauf si invincible ou mob inoffensif)
          this.localPlayer.die();
          this.scheduleRespawnPlayer();
          return; // Le joueur est mort, pas besoin de continuer
        }
      }
    }
  }

  private scheduleRespawnMob() {
    this.time.delayedCall(MOB_RESPAWN_DELAY, () => {
      // Nettoyer les mobs morts du tableau
      this.mobs = this.mobs.filter(m => m.alive);
      this.respawnMob();
    });
  }

  private scheduleRespawnPlayer() {
    this.time.delayedCall(PLAYER_RESPAWN_DELAY, () => {
      this.comboTracker.reset();
      const sp = Phaser.Utils.Array.GetRandom(PLAYER_SPAWN_POINTS);
      this.localPlayer.respawn(sp.x, sp.y, true);
      this.localPlayer.setInvincible(PLAYER_INVINCIBLE_DURATION);
      this.setupShooting();
    });
  }

  private updateHUD() {
    const aliveMobs = this.mobs.filter(m => m.alive).length;
    this.hudText.setText(
      `FPS: ${Math.round(this.game.loop.actualFps)} | score: ${this.score} | mobs: ${aliveMobs} | fleches: ${this.arrows.length}`,
    );
  }

  private isStomping(stomper: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite): boolean {
    const stomperBody = stomper.body as Phaser.Physics.Arcade.Body;
    if (stomperBody.velocity.y <= 0) return false;

    const stomperBounds = stomper.getBounds();
    const targetBounds = target.getBounds();
    const targetMidY = targetBounds.y + targetBounds.height / 2;

    return stomperBounds.bottom >= targetBounds.y && stomperBounds.bottom <= targetMidY;
  }

  private stompEffect(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const particle = this.add.rectangle(
        x + Phaser.Math.Between(-8, 8), y, 3, 3, 0xffff00,
      );
      this.tweens.add({
        targets: particle,
        alpha: 0,
        y: y + Phaser.Math.Between(-12, 12),
        x: particle.x + Phaser.Math.Between(-16, 16),
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private tipHitsSprite(tip: { x: number; y: number }, target: Phaser.Physics.Arcade.Sprite): boolean {
    const bounds = target.getBounds();
    return bounds.contains(tip.x, tip.y);
  }

  private checkOverlap(a: Phaser.Physics.Arcade.Sprite, b: Phaser.Physics.Arcade.Sprite): boolean {
    const boundsA = a.getBounds();
    const boundsB = b.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);
  }

  private cleanupGame() {
    for (const mob of this.mobs) {
      if (mob.alive) mob.destroy();
    }
    this.mobs = [];
    for (const arrow of this.arrows) {
      arrow.destroy();
    }
    this.arrows = [];
    this.comboTracker?.reset();
    this.comboHUD?.destroy();
    this.localPlayer?.destroy();
    if (this.touchControls) {
      this.scene.stop('TouchControlsScene');
      this.touchControls = null;
    }
  }

  shutdown() {
    this.cleanupGame();
  }
}
