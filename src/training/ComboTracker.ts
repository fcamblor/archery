const COMBO_TIMEOUT = 500; // ms — délai max entre deux kills pour maintenir le combo

export class ComboTracker {
  private _count = 0;
  private _bestCombo = 0;
  private timerMs = 0;
  private timerExpired = false;

  get count(): number {
    return this._count;
  }

  get bestCombo(): number {
    return this._bestCombo;
  }

  onKill(): void {
    this._count++;
    this.timerMs = COMBO_TIMEOUT;
    this.timerExpired = false;
  }

  onGrounded(): void {
    if (this.timerExpired) {
      this.reset();
    }
  }

  // Une fois expiré, on ne touche plus au timer : c'est onGrounded() qui décide si le combo doit reset
  update(delta: number, grounded: boolean): void {
    if (this._count === 0) return;
    if (this.timerExpired) return;

    this.timerMs -= delta;
    if (this.timerMs <= 0) {
      this.timerMs = 0;
      this.timerExpired = true;
      if (grounded) {
        this.reset();
      }
    }
  }

  reset(): void {
    if (this._count > this._bestCombo) {
      this._bestCombo = this._count;
    }
    this._count = 0;
    this.timerMs = 0;
    this.timerExpired = false;
  }
}
