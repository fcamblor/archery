import Phaser from 'phaser';
import { ComboState, ComboTier } from '../entities/ComboTracker';

const TIER_CONFIG: Record<ComboTier, { label: string; color: string; fontSize: string }> = {
  none: { label: '', color: '#f4a261', fontSize: '16px' },
  good: { label: 'GOOD!', color: '#f4a261', fontSize: '16px' },
  great: { label: 'GREAT!!', color: '#e76f51', fontSize: '20px' },
  amazing: { label: 'AMAZING!!!', color: '#e9c46a', fontSize: '24px' },
};

export class ComboHUD {
  private scene: Phaser.Scene;
  private countText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private baseX: number;
  private punchTween: Phaser.Tweens.Tween | null = null;
  private shakeTween: Phaser.Tweens.Tween | null = null;
  private hideTween: Phaser.Tweens.Tween | null = null;
  private flashTween: Phaser.Tweens.Tween | null = null;
  private flashRect: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.baseX = scene.scale.width / 2;

    this.countText = scene.add.text(
      this.baseX,
      scene.scale.height * 0.3,
      '',
      { fontSize: '16px', fontFamily: 'monospace', color: '#f4a261' },
    ).setOrigin(0.5).setDepth(200).setVisible(false);

    this.tierText = scene.add.text(
      this.baseX,
      scene.scale.height * 0.3 + 18,
      '',
      { fontSize: '10px', fontFamily: 'monospace', color: '#f4a261' },
    ).setOrigin(0.5).setDepth(200).setVisible(false);
  }

  animateHit(state: ComboState): void {
    const { count, tier } = state;
    const config = TIER_CONFIG[tier];

    this.countText.setText(`x${count}`);
    this.countText.setFontSize(config.fontSize);
    this.countText.setColor(config.color);

    this.tierText.setText(config.label);
    this.tierText.setColor(config.color);

    this.countText.setVisible(true).setAlpha(1);
    this.tierText.setVisible(true).setAlpha(1);

    // Punch effect
    if (this.punchTween) this.punchTween.stop();
    this.countText.setScale(1);
    this.punchTween = this.scene.tweens.add({
      targets: this.countText,
      scale: { from: 1.3, to: 1 },
      duration: 150,
      ease: 'Back.easeOut',
    });

    // Shake for great+ tiers
    if (tier === 'great' || tier === 'amazing') {
      if (this.shakeTween) this.shakeTween.stop();
      this.countText.x = this.baseX;
      this.shakeTween = this.scene.tweens.add({
        targets: this.countText,
        x: this.baseX + 2,
        duration: 50,
        yoyo: true,
        repeat: 2,
        onComplete: () => { this.countText.x = this.baseX; },
      });
    }

    // Flash for amazing tier
    if (tier === 'amazing') {
      this.flashWhite();
    }
  }

  hideCombo(finalCount: number): void {
    this.countText.setText(`x${finalCount}`);
    if (this.hideTween) this.hideTween.stop();
    this.hideTween = this.scene.tweens.add({
      targets: [this.countText, this.tierText],
      alpha: 0,
      duration: 300,
      delay: 200,
      onComplete: () => {
        this.countText.setVisible(false);
        this.tierText.setVisible(false);
      },
    });
  }

  destroy(): void {
    this.punchTween?.stop();
    this.shakeTween?.stop();
    this.hideTween?.stop();
    this.flashTween?.stop();
    this.countText.destroy();
    this.tierText.destroy();
    this.flashRect?.destroy();
  }

  private flashWhite(): void {
    if (!this.flashRect) {
      this.flashRect = this.scene.add.rectangle(
        this.scene.scale.width / 2,
        this.scene.scale.height / 2,
        this.scene.scale.width,
        this.scene.scale.height,
        0xffffff,
      ).setDepth(199).setAlpha(0);
    }

    this.flashRect.setAlpha(0.3);
    if (this.flashTween) this.flashTween.stop();
    this.flashTween = this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 100,
    });
  }
}
