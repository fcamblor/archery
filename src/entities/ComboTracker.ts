export type KillType = 'arrow' | 'stomp';
export type ComboTier = 'none' | 'good' | 'great' | 'amazing';

export interface ComboState {
  count: number;
  active: boolean;
  lastKillType: KillType | null;
  tier: ComboTier;
}

export interface ComboCallbacks {
  onComboHit: (state: ComboState) => void;
  onComboEnd: (finalCount: number) => void;
}

export const COMBO_DEBOUNCE = 600; // ms entre deux kills pour maintenir le combo

export function getTier(count: number): ComboTier {
  if (count < 2) return 'none';
  if (count <= 3) return 'good';
  if (count <= 6) return 'great';
  return 'amazing';
}

export class ComboTracker {
  private count = 0;
  private lastKillTime = 0;
  private airborne = false;
  private lastKillType: KillType | null = null;
  private callbacks: ComboCallbacks;

  constructor(callbacks: ComboCallbacks) {
    this.callbacks = callbacks;
  }

  registerKill(type: KillType, now: number): ComboState {
    const timeSinceLastKill = now - this.lastKillTime;
    const comboActive = this.count > 0 && (timeSinceLastKill < COMBO_DEBOUNCE || this.airborne);

    if (comboActive) {
      this.count++;
    } else {
      // Terminer le combo précédent s'il existait
      if (this.count >= 2) {
        this.callbacks.onComboEnd(this.count);
      }
      this.count = 1;
    }

    this.lastKillTime = now;
    this.airborne = true;
    this.lastKillType = type;

    const state = this.getState();
    if (this.count >= 2) {
      this.callbacks.onComboHit(state);
    }
    return state;
  }

  notifyGrounded(now: number): void {
    this.airborne = false;
    if (this.count >= 2 && now - this.lastKillTime >= COMBO_DEBOUNCE) {
      this.endCombo();
    }
  }

  update(now: number): void {
    if (this.count < 2) return;
    if (now - this.lastKillTime >= COMBO_DEBOUNCE && !this.airborne) {
      this.endCombo();
    }
  }

  reset(): void {
    if (this.count >= 2) {
      this.callbacks.onComboEnd(this.count);
    }
    this.count = 0;
    this.airborne = false;
    this.lastKillType = null;
    this.lastKillTime = 0;
  }

  getState(): ComboState {
    return {
      count: this.count,
      active: this.count >= 2,
      lastKillType: this.lastKillType,
      tier: getTier(this.count),
    };
  }

  private endCombo(): void {
    if (this.count >= 2) {
      this.callbacks.onComboEnd(this.count);
    }
    this.count = 0;
    this.airborne = false;
    this.lastKillType = null;
  }
}
