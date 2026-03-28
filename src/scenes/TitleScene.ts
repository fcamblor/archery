import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    // Titre
    this.add.text(width / 2, height * 0.25, 'TOWERFALL', {
      fontSize: '32px',
      color: '#e76f51',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Sous-titre
    this.add.text(width / 2, height * 0.35, 'PhaserJS Edition', {
      fontSize: '12px',
      color: '#f4a261',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Bouton Héberger
    this.createButton(width / 2, height * 0.55, 'HÉBERGER', () => {
      this.scene.start('LobbyScene', { mode: 'host' });
    });

    // Bouton Rejoindre
    this.createButton(width / 2, height * 0.70, 'REJOINDRE', () => {
      this.scene.start('LobbyScene', { mode: 'join' });
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void) {
    const text = this.add.text(x, y, label, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#264653',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => {
      text.setStyle({ backgroundColor: '#2a9d8f' });
    });
    text.on('pointerout', () => {
      text.setStyle({ backgroundColor: '#264653' });
    });
    text.on('pointerdown', onClick);
  }
}
