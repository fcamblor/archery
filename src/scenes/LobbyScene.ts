import Phaser from 'phaser';
import { NetworkManager } from '../network/NetworkManager';
import type { PlayerInfo } from '../shared/types';

const PLAYER_COLOR_HEX = [
  '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#9b5de5',
];

export class LobbyScene extends Phaser.Scene {
  private mode!: 'host' | 'join';
  private network!: NetworkManager;
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private startButton?: Phaser.GameObjects.Text;
  private joinButton?: Phaser.GameObjects.Text;
  private inputElement?: HTMLInputElement;

  constructor() {
    super('LobbyScene');
  }

  init(data: { mode: 'host' | 'join' }) {
    this.mode = data.mode;
  }

  create() {
    const { width, height } = this.scale;
    this.network = NetworkManager.getInstance();

    // Titre
    this.add.text(width / 2, 20, this.mode === 'host' ? 'HÉBERGER' : 'REJOINDRE', {
      fontSize: '20px',
      color: '#e76f51',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Status
    this.statusText = this.add.text(width / 2, 50, 'Connexion...', {
      fontSize: '11px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Code de la room
    this.codeText = this.add.text(width / 2, 75, '', {
      fontSize: '24px',
      color: '#e9c46a',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Bouton retour
    this.createButton(60, height - 25, '← RETOUR', () => {
      this.cleanup();
      this.scene.start('TitleScene');
    });

    // Lancer la connexion
    this.connectAndSetup();
  }

  private async connectAndSetup() {
    try {
      await this.network.connect();
      this.statusText.setText('Connecté !');

      if (this.mode === 'host') {
        await this.hostRoom();
      } else {
        this.showJoinInput();
      }
    } catch {
      this.statusText.setText('Erreur de connexion au serveur');
      this.statusText.setColor('#ff4444');
    }
  }

  private async hostRoom() {
    try {
      const room = await this.network.createRoom('Hôte');
      this.codeText.setText(`Code: ${room.code}`);
      this.statusText.setText('En attente de joueurs...');
      this.renderPlayerList(room.players);
      this.showStartButton();
      this.listenForUpdates();
    } catch (err) {
      this.statusText.setText(`Erreur: ${(err as Error).message}`);
    }
  }

  private showJoinInput() {
    const { width } = this.scale;
    this.statusText.setText('Entrez le code de la partie :');

    // Utiliser un vrai input HTML pour la saisie du code
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 4;
    input.placeholder = 'CODE';
    input.style.cssText = `
      position: absolute;
      left: ${rect.left + (width / 2 - 50) * scaleX}px;
      top: ${rect.top + 65 * scaleY}px;
      width: ${100 * scaleX}px;
      height: ${30 * scaleY}px;
      font-family: monospace;
      font-size: ${16 * scaleY}px;
      text-align: center;
      text-transform: uppercase;
      background: #264653;
      color: #e9c46a;
      border: 2px solid #e9c46a;
      outline: none;
      letter-spacing: 4px;
    `;
    document.body.appendChild(input);
    input.focus();
    this.inputElement = input;

    // Bouton Rejoindre
    this.joinButton = this.createButton(width / 2, 120, 'OK', () => {
      const code = input.value.trim().toUpperCase();
      if (code.length === 4) {
        this.joinRoom(code);
      }
    });

    // Aussi sur Entrée
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = input.value.trim().toUpperCase();
        if (code.length === 4) {
          this.joinRoom(code);
        }
      }
    });
  }

  private async joinRoom(code: string) {
    try {
      this.statusText.setText('Connexion à la partie...');
      this.removeInput();
      const room = await this.network.joinRoom(code, 'Joueur');
      this.codeText.setText(`Code: ${room.code}`);
      this.statusText.setText('Dans le lobby');
      this.renderPlayerList(room.players);
      this.listenForUpdates();
    } catch (err) {
      this.statusText.setText(`Erreur: ${(err as Error).message}`);
      this.statusText.setColor('#ff4444');
    }
  }

  private listenForUpdates() {
    this.network.onPlayerJoined((player: PlayerInfo) => {
      if (this.network.room) {
        this.network.room.players.push(player);
        this.renderPlayerList(this.network.room.players);
      }
    });

    this.network.onPlayerLeft((playerId: string) => {
      if (this.network.room) {
        this.network.room.players = this.network.room.players.filter(
          (p) => p.id !== playerId,
        );
        this.renderPlayerList(this.network.room.players);
      }
    });

    this.network.onGameStarting(() => {
      this.cleanup();
      this.scene.start('GameScene', { networked: true });
    });
  }

  private renderPlayerList(players: PlayerInfo[]) {
    // Nettoyer l'ancienne liste
    for (const t of this.playerListTexts) {
      t.destroy();
    }
    this.playerListTexts = [];

    const { width } = this.scale;
    const startY = 110;

    this.add.text(width / 2, startY - 15, `Joueurs (${players.length}/6)`, {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const isHost = this.network.room?.hostId === p.id;
      const isSelf = p.id === this.network.playerId;
      const label = `${isHost ? '★ ' : '  '}${p.name}${isSelf ? ' (vous)' : ''}`;
      const color = PLAYER_COLOR_HEX[i % PLAYER_COLOR_HEX.length];
      const text = this.add.text(width / 2, startY + i * 22, label, {
        fontSize: '13px',
        color,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.playerListTexts.push(text);
    }
  }

  private showStartButton() {
    const { width, height } = this.scale;
    this.startButton = this.createButton(width / 2, height - 25, 'LANCER LA PARTIE', () => {
      this.network.startGame();
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#264653',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => text.setStyle({ backgroundColor: '#2a9d8f' }));
    text.on('pointerout', () => text.setStyle({ backgroundColor: '#264653' }));
    text.on('pointerdown', onClick);
    return text;
  }

  private removeInput() {
    if (this.inputElement) {
      this.inputElement.remove();
      this.inputElement = undefined;
    }
    if (this.joinButton) {
      this.joinButton.destroy();
      this.joinButton = undefined;
    }
  }

  private cleanup() {
    this.removeInput();
    this.network.removeAllGameListeners();
  }

  shutdown() {
    this.cleanup();
  }
}
