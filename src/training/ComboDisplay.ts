import Phaser from 'phaser';

const COMBO_MIN_DISPLAY = 2;

export class ComboDisplay {
  private text: Phaser.GameObjects.Text | null;
  private tweens: Phaser.Tweens.TweenManager;
  private lastCount = 0;

  constructor(scene: Phaser.Scene) {
    this.tweens = scene.tweens;
    this.text = scene.add.text(scene.scale.width / 2, 40, '', {
      fontSize: '16px',
      color: '#f4a261',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);
  }

  update(count: number): void {
    if (!this.text) return;

    if (count >= COMBO_MIN_DISPLAY) {
      this.text.setText(`COMBO x${count}`);
      this.text.setAlpha(1);

      if (count !== this.lastCount) {
        this.tweens.killTweensOf(this.text);
        this.text.setScale(1.3);
        this.tweens.add({
          targets: this.text,
          scale: 1,
          duration: 150,
          ease: 'Power2',
        });
      }
    } else if (this.lastCount >= COMBO_MIN_DISPLAY && count < COMBO_MIN_DISPLAY) {
      this.tweens.killTweensOf(this.text);
      this.tweens.add({
        targets: this.text,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
      });
    }

    this.lastCount = count;
  }

  destroy(): void {
    if (!this.text) return;
    this.tweens.killTweensOf(this.text);
    this.text.destroy();
    this.text = null;
  }
}
