import { describe, it, expect, beforeEach } from 'vitest';
import { ComboTracker } from './ComboTracker';

describe('ComboTracker', () => {
  let tracker: ComboTracker;

  beforeEach(() => {
    tracker = new ComboTracker();
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
      tracker.update(200, false);
      tracker.onKill();
      expect(tracker.count).toBe(2);
    });

    it('reset le combo quand le timer expire et le joueur est au sol', () => {
      tracker.onKill();
      tracker.update(501, true);
      expect(tracker.count).toBe(0);
    });

    it('ne reset PAS si le timer expire mais le joueur est en l\'air', () => {
      tracker.onKill();
      tracker.update(501, false);
      expect(tracker.count).toBe(1);
    });

    it('reset quand le joueur atterrit après expiration du timer', () => {
      tracker.onKill();
      tracker.update(501, false);
      expect(tracker.count).toBe(1);
      tracker.onGrounded();
      expect(tracker.count).toBe(0);
    });
  });

  describe('combo aérien (stomp)', () => {
    it('maintient le combo si le joueur ne touche pas le sol entre les kills', () => {
      tracker.onKill();
      tracker.update(600, false);
      tracker.onKill();
      expect(tracker.count).toBe(2);
    });

    it('un nouveau kill après expiration en vol relance le timer', () => {
      tracker.onKill();
      tracker.update(600, false); // timer expiré, en l'air
      tracker.onKill(); // relance le timer
      expect(tracker.count).toBe(2);
      tracker.update(501, true); // timer expire à nouveau + au sol → reset
      expect(tracker.count).toBe(0);
    });

    it('onGrounded ne reset pas si le timer n\'a pas expiré', () => {
      tracker.onKill();
      tracker.update(100, true);
      tracker.onGrounded();
      expect(tracker.count).toBe(1);
    });
  });

  describe('enchaînement kills (timer relance)', () => {
    it('un kill relance le timer pendant un combo en vol', () => {
      tracker.onKill();
      tracker.update(400, false);
      tracker.onKill();
      tracker.update(400, false);
      expect(tracker.count).toBe(2);
    });
  });

  describe('bestCombo', () => {
    it('met à jour bestCombo au reset explicite', () => {
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

    it('bestCombo mis à jour via auto-reset (timer expire + au sol)', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.update(501, true); // timer expire + grounded → auto-reset
      expect(tracker.bestCombo).toBe(2);
      expect(tracker.count).toBe(0);
    });

    it('bestCombo mis à jour via onGrounded après expiration timer', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.onKill();
      tracker.update(501, false); // timer expire, en l'air
      tracker.onGrounded(); // atterrit → reset
      expect(tracker.bestCombo).toBe(3);
      expect(tracker.count).toBe(0);
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

    it('reset pendant timer actif capture bestCombo et réinitialise le timer', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.onKill();
      tracker.update(200, false); // timer actif à 300ms restant
      tracker.reset(); // mort du joueur mid-combo
      expect(tracker.bestCombo).toBe(3);
      expect(tracker.count).toBe(0);
      // vérifier que le timer est bien réinitialisé : un nouveau kill ne continue pas l'ancien combo
      tracker.onKill();
      expect(tracker.count).toBe(1);
    });

    it('onKill après reset démarre un nouveau combo propre', () => {
      tracker.onKill();
      tracker.onKill();
      tracker.reset();
      tracker.onKill();
      expect(tracker.count).toBe(1);
      // le timer est actif pour le nouveau combo
      tracker.update(501, true);
      expect(tracker.count).toBe(0);
      expect(tracker.bestCombo).toBe(2);
    });
  });

  describe('cas limites', () => {
    it('update sans aucun kill ne fait rien', () => {
      tracker.update(1000, true);
      expect(tracker.count).toBe(0);
    });

    it('onGrounded sans combo actif ne fait rien', () => {
      tracker.onGrounded();
      expect(tracker.count).toBe(0);
    });

    it('kill exactement au moment de l\'expiration du timer (delta = 500)', () => {
      tracker.onKill();
      tracker.update(500, false);
      expect(tracker.count).toBe(1);
      tracker.onKill();
      expect(tracker.count).toBe(2);
    });

    it('multiple updates partielles totalisent le timeout', () => {
      tracker.onKill();
      tracker.update(200, true);
      tracker.update(200, true);
      expect(tracker.count).toBe(1);
      tracker.update(101, true);
      expect(tracker.count).toBe(0);
    });

    it('update(0) ne change rien', () => {
      tracker.onKill();
      tracker.update(0, true);
      expect(tracker.count).toBe(1);
    });
  });
});
