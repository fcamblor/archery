const COMBO_TIMEOUT = 500; // ms — délai max entre deux kills pour maintenir le combo

export class ComboTracker {
  count = 0;
  bestCombo = 0;

  private timerMs = 0;
  private timerExpired = false;
  private isGrounded: () => boolean;

  constructor(isGrounded: () => boolean) {
    this.isGrounded = isGrounded;
  }

  onKill(): void {
    this.count++;
    this.timerMs = COMBO_TIMEOUT;
    this.timerExpired = false;
  }

  onGrounded(): void {
    if (this.timerExpired) {
      this.reset();
    }
  }

  update(delta: number): void {
    if (this.count === 0) return;
    if (this.timerExpired) return;

    this.timerMs -= delta;
    if (this.timerMs <= 0) {
      this.timerMs = 0;
      this.timerExpired = true;
      if (this.isGrounded()) {
        this.reset();
      }
    }
  }

  reset(): void {
    if (this.count > this.bestCombo) {
      this.bestCombo = this.count;
    }
    this.count = 0;
    this.timerMs = 0;
    this.timerExpired = false;
  }
}
