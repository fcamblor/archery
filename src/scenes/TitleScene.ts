import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  private networkButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;

    // Titre
    this.add.text(width / 2, height * 0.25, 'Archery', {
      fontSize: '32px',
      color: '#e76f51',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Sous-titre
    this.add.text(width / 2, height * 0.35, 'By Naïa & Fred', {
      fontSize: '12px',
      color: '#f4a261',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Bouton Héberger
    const hostBtn = this.createButton(width / 2, height * 0.55, 'HÉBERGER', () => {
      this.scene.start('LobbyScene', { mode: 'host' });
    });
    this.networkButtons.push(hostBtn);

    // Bouton Rejoindre
    const joinBtn = this.createButton(width / 2, height * 0.70, 'REJOINDRE', () => {
      this.scene.start('LobbyScene', { mode: 'join' });
    });
    this.networkButtons.push(joinBtn);

    // Bouton Entraînement
    this.createButton(width / 2, height * 0.85, "S'ENTRAÎNER", () => {
      this.scene.start('TrainingScene');
    });

    // Appliquer l'état initial et écouter les changements
    this.updateNetworkButtons();
    window.addEventListener('online', this.onNetworkChange);
    window.addEventListener('offline', this.onNetworkChange);

    this.events.on('shutdown', () => {
      window.removeEventListener('online', this.onNetworkChange);
      window.removeEventListener('offline', this.onNetworkChange);
    });
  }

  private onNetworkChange = () => {
    this.updateNetworkButtons();
  };

  private updateNetworkButtons() {
    const online = navigator.onLine;
    for (const btn of this.networkButtons) {
      if (online) {
        btn.setAlpha(1);
        btn.setInteractive({ useHandCursor: true });
        btn.setStyle({ backgroundColor: '#264653' });
      } else {
        btn.setAlpha(0.4);
        btn.disableInteractive();
        btn.setStyle({ backgroundColor: '#333333' });
      }
    }
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#264653',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => {
      if (text.input?.enabled) {
        text.setStyle({ backgroundColor: '#2a9d8f' });
      }
    });
    text.on('pointerout', () => {
      if (text.input?.enabled) {
        text.setStyle({ backgroundColor: '#264653' });
      }
    });
    text.on('pointerdown', onClick);

    return text;
  }
}
