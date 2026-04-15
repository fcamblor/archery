import { describe, it, expect, beforeEach } from 'vitest';
import { ComboTracker } from './ComboTracker';

describe('ComboTracker', () => {
  let grounded: boolean;
  let tracker: ComboTracker;

  beforeEach(() => {
    grounded = true;
    tracker = new ComboTracker(() => grounded);
  });

  describe('onKill', () => {
    it('incrémente le compteur à chaque kill', () => {
      tracker.onKill();
      expect(tracker.count).toBe(1);
      tracker.onKill();
      expect(tracker.count).toBe(2);
    });
  });

  describe('combo par flèches (timer)', () => {
    it('maintient le combo si kills enchaînés avant expiration du timer', () => {
      tracker.onKill();
      tracker.update(200); // 200ms écoulées, timer pas expiré
      tracker.onKill();
      expect(tracker.count).toBe(2);
    });

    it('reset le combo quand le timer expire et le joueur est au sol', () => {
      grounded = true;
      tracker.onKill();
      tracker.update(501); // timer expiré + joueur au sol → reset
      expect(tracker.count).toBe(0);
    });

    it('ne reset PAS si le timer expire mais le joueur est en l\'air', () => {
      grounded = false;
      tracker.onKill();
      tracker.update(501);
      expect(tracker.count).toBe(1); // toujours actif
    });

    it('reset quand le joueur atterrit après expiration du timer', () => {
      grounded = false;
      tracker.onKill();
      tracker.update(501); // timer expire, joueur en l'air → pas de reset
      expect(tracker.count).toBe(1);
      tracker.onGrounded(); // maintenant il atterrit → reset
      expect(tracker.count).toBe(0);
    });
  });

  describe('combo aérien (stomp)', () => {
    it('maintient le combo si le joueur ne touche pas le sol entre les kills', () => {
      grounded = false;
      tracker.onKill(); // stomp kill 1
      tracker.update(600); // timer expiré mais en l'air
      tracker.onKill(); // stomp kill 2 → relance le timer
      expect(tracker.count).toBe(2);
      expect(tracker.count).toBe(2); // combo toujours actif
    });

    it('onGrounded ne reset pas si le timer n\'a pas expiré', () => {
      tracker.onKill();
      tracker.update(100);
      tracker.onGrounded();
      expect(tracker.count).toBe(1); // combo maintenu
    });
  });

  describe('mix flèche + stomp', () => {
    it('un kill par flèche relance le timer pendant un combo aérien', () => {
      grounded = false;
      tracker.onKill(); // stomp
      tracker.update(400);
      tracker.onKill(); // flèche en l'air → relance timer
      tracker.update(400);
      expect(tracker.count).toBe(2); // timer pas encore expiré
    });
  });

  describe('bestCombo', () => {
    it('met à jour bestCombo au reset', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.onKill();
      tracker.reset();
      expect(tracker.bestCombo).toBe(3);
    });

    it('ne diminue pas bestCombo sur un combo plus faible', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.onKill();
      tracker.reset();
      tracker.onKill();
      tracker.reset();
      expect(tracker.bestCombo).toBe(3);
    });

    it('bestCombo reste 0 sans aucun kill', () => {
      tracker.reset();
      expect(tracker.bestCombo).toBe(0);
    });
  });

  describe('reset', () => {
    it('remet tout à zéro', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.reset();
      expect(tracker.count).toBe(0);
    });

    it('reset par mort du joueur en plein combo', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.onKill();
      tracker.reset();
      expect(tracker.count).toBe(0);
      expect(tracker.bestCombo).toBe(3);
    });
  });

  describe('cas limites', () => {
    it('update sans aucun kill ne fait rien', () => {
      tracker.update(1000);
      expect(tracker.count).toBe(0);
    });

    it('onGrounded sans combo actif ne fait rien', () => {
      tracker.onGrounded();
      expect(tracker.count).toBe(0);
    });

    it('kill exactement au moment de l\'expiration du timer (delta = 500)', () => {
      grounded = false;
      tracker.onKill();
      tracker.update(500); // timer arrive à 0 exactement
      // timer expiré mais en l'air → pas de reset
      expect(tracker.count).toBe(1);
      tracker.onKill(); // relance le timer
      expect(tracker.count).toBe(2);
    });

    it('multiple updates partielles totalisent le timeout', () => {
      grounded = true;
      tracker.onKill();
      tracker.update(200);
      tracker.update(200);
      expect(tracker.count).toBe(1); // 400ms, pas encore expiré
      tracker.update(101); // 501ms total → expiré + au sol → reset
      expect(tracker.count).toBe(0);
    });
  });
});
