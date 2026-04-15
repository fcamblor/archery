import Phaser from 'phaser';
import { ComboState, ComboTier } from '../entities/ComboTracker';

const TIER_LABELS: Record<ComboTier, string> = {
  none: '',
  good: 'GOOD!',
  great: 'GREAT!!',
  amazing: 'AMAZING!!!',
};

const TIER_COLORS: Record<ComboTier, string> = {
  none: '#f4a261',
  good: '#f4a261',
  great: '#e76f51',
  amazing: '#e9c46a',
};

const TIER_FONT_SIZES: Record<ComboTier, string> = {
  none: '16px',
  good: '16px',
  great: '20px',
  amazing: '24px',
};

export class ComboHUD {
  private scene: Phaser.Scene;
  private countText: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  private punchTween: Phaser.Tweens.Tween | null = null;
  private shakeTween: Phaser.Tweens.Tween | null = null;
  private flashRect: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.countText = scene.add.text(
      scene.scale.width / 2,
      scene.scale.height * 0.3,
      '',
      { fontSize: '16px', fontFamily: 'monospace', color: '#f4a261' },
    ).setOrigin(0.5).setDepth(200).setVisible(false);

    this.tierText = scene.add.text(
      scene.scale.width / 2,
      scene.scale.height * 0.3 + 18,
      '',
      { fontSize: '10px', fontFamily: 'monospace', color: '#f4a261' },
    ).setOrigin(0.5).setDepth(200).setVisible(false);
  }

  animateHit(state: ComboState): void {
    const { count, tier } = state;

    // Update text content and style
    this.countText.setText(`x${count}`);
    this.countText.setFontSize(TIER_FONT_SIZES[tier]);
    this.countText.setColor(TIER_COLORS[tier]);

    this.tierText.setText(TIER_LABELS[tier]);
    this.tierText.setColor(TIER_COLORS[tier]);

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
      const baseX = this.scene.scale.width / 2;
      this.countText.x = baseX;
      this.shakeTween = this.scene.tweens.add({
        targets: this.countText,
        x: baseX + 2,
        duration: 50,
        yoyo: true,
        repeat: 2,
        onComplete: () => { this.countText.x = baseX; },
      });
    }

    // Flash for amazing tier
    if (tier === 'amazing') {
      this.flashWhite();
    }
  }

  hideCombo(finalCount: number): void {
    this.countText.setText(`x${finalCount}`);
    this.scene.tweens.add({
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
    this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 100,
    });
  }
}
