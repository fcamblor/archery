import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComboTracker, ComboCallbacks, COMBO_DEBOUNCE, getTier } from '../ComboTracker';

function makeCallbacks(): ComboCallbacks & { hits: any[]; ends: number[] } {
  const result = {
    hits: [] as any[],
    ends: [] as number[],
    onComboHit: vi.fn((state) => result.hits.push({ ...state })),
    onComboEnd: vi.fn((count) => result.ends.push(count)),
  };
  return result;
}

describe('getTier', () => {
  it('returns none for count < 2', () => {
    expect(getTier(0)).toBe('none');
    expect(getTier(1)).toBe('none');
  });
  it('returns good for 2-3', () => {
    expect(getTier(2)).toBe('good');
    expect(getTier(3)).toBe('good');
  });
  it('returns great for 4-6', () => {
    expect(getTier(4)).toBe('great');
    expect(getTier(6)).toBe('great');
  });
  it('returns amazing for 7+', () => {
    expect(getTier(7)).toBe('amazing');
    expect(getTier(100)).toBe('amazing');
  });
});

describe('ComboTracker', () => {
  let cb: ReturnType<typeof makeCallbacks>;
  let tracker: ComboTracker;

  beforeEach(() => {
    cb = makeCallbacks();
    tracker = new ComboTracker(cb);
  });

  describe('registerKill — combo par debounce temporel', () => {
    it('un seul kill ne déclenche pas de combo', () => {
      const state = tracker.registerKill('arrow', 1000);
      expect(state.count).toBe(1);
      expect(state.active).toBe(false);
      expect(cb.onComboHit).not.toHaveBeenCalled();
    });

    it('deux kills dans le debounce forment un combo', () => {
      tracker.registerKill('arrow', 1000);
      const state = tracker.registerKill('arrow', 1000 + COMBO_DEBOUNCE - 1);
      expect(state.count).toBe(2);
      expect(state.active).toBe(true);
      expect(state.tier).toBe('good');
      expect(cb.hits).toHaveLength(1);
    });

    it('le timer se réinitialise à chaque kill', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1500); // +500ms → combo
      // Le timer repart de 1500, donc 2099 est encore valide
      const state = tracker.registerKill('arrow', 2099);
      expect(state.count).toBe(3);
    });

    it('un kill après le debounce commence un nouveau combo', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200); // combo x2
      // Simuler le joueur au sol pour que le combo se termine
      tracker.notifyGrounded(1200);
      tracker.registerKill('arrow', 1200 + COMBO_DEBOUNCE + 100); // hors debounce
      expect(cb.ends).toContain(2); // ancien combo terminé
      expect(tracker.getState().count).toBe(1);
    });
  });

  describe('registerKill — combo par rebond (airborne)', () => {
    it('un kill maintient airborne → combo même si debounce expiré', () => {
      tracker.registerKill('stomp', 1000);
      // Pas de notifyGrounded → airborne = true
      const state = tracker.registerKill('stomp', 1000 + COMBO_DEBOUNCE + 100);
      expect(state.count).toBe(2);
      expect(state.active).toBe(true);
    });
  });

  describe('types mixables', () => {
    it('arrow puis stomp dans le debounce forment un combo', () => {
      tracker.registerKill('arrow', 1000);
      const state = tracker.registerKill('stomp', 1300);
      expect(state.count).toBe(2);
      expect(state.lastKillType).toBe('stomp');
    });

    it('stomp puis arrow (airborne) forment un combo même hors debounce', () => {
      tracker.registerKill('stomp', 1000);
      // airborne, pas de grounded
      const state = tracker.registerKill('arrow', 2000);
      expect(state.count).toBe(2);
    });
  });

  describe('kills simultanés (même frame)', () => {
    it('deux kills au même timestamp forment un combo', () => {
      tracker.registerKill('arrow', 1000);
      const state = tracker.registerKill('arrow', 1000);
      expect(state.count).toBe(2);
    });
  });

  describe('notifyGrounded + update — rupture du combo', () => {
    it('grounded + debounce expiré → combo terminé', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200);
      // Le joueur atterrit après le debounce
      tracker.notifyGrounded(1200 + COMBO_DEBOUNCE);
      expect(cb.ends).toContain(2);
    });

    it('grounded pendant le debounce → combo survit', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200);
      tracker.notifyGrounded(1300); // debounce pas encore expiré
      expect(cb.ends).toHaveLength(0);
    });

    it('update détecte la fin si déjà grounded et debounce expiré', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200);
      tracker.notifyGrounded(1300); // grounded mais debounce actif
      tracker.update(1200 + COMBO_DEBOUNCE); // debounce expire
      expect(cb.ends).toContain(2);
    });

    it('update ne termine pas le combo si airborne', () => {
      tracker.registerKill('stomp', 1000);
      tracker.registerKill('stomp', 1200);
      // Pas de notifyGrounded → airborne
      tracker.update(1200 + COMBO_DEBOUNCE + 500);
      expect(cb.ends).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('reset termine un combo actif et émet onComboEnd', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200);
      tracker.reset();
      expect(cb.ends).toContain(2);
      expect(tracker.getState().count).toBe(0);
    });

    it('reset sans combo actif ne déclenche pas onComboEnd', () => {
      tracker.registerKill('arrow', 1000); // count=1, pas un combo
      tracker.reset();
      expect(cb.onComboEnd).not.toHaveBeenCalled();
    });
  });

  describe('progression des tiers', () => {
    it('les tiers progressent correctement au fil des kills', () => {
      const tiers: string[] = [];
      for (let i = 0; i < 8; i++) {
        const state = tracker.registerKill('arrow', 1000 + i * 100);
        tiers.push(state.tier);
      }
      expect(tiers).toEqual([
        'none', 'good', 'good', 'great', 'great', 'great', 'amazing', 'amazing',
      ]);
    });
  });

  describe('edge cases', () => {
    it('un nouveau combo après un combo terminé fonctionne', () => {
      tracker.registerKill('arrow', 1000);
      tracker.registerKill('arrow', 1200);
      tracker.notifyGrounded(1200 + COMBO_DEBOUNCE); // fin combo x2
      // Nouveau combo
      tracker.registerKill('arrow', 3000);
      tracker.registerKill('arrow', 3200);
      expect(tracker.getState().count).toBe(2);
      expect(cb.ends).toHaveLength(1); // seul le premier combo est terminé
    });

    it('registerKill après debounce mais airborne → combo continue', () => {
      tracker.registerKill('stomp', 1000);
      // airborne, debounce expiré
      const state = tracker.registerKill('arrow', 1000 + COMBO_DEBOUNCE + 500);
      expect(state.count).toBe(2);
    });
  });
});
