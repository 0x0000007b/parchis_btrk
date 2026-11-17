class SoundEffects {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'triangle', gainPeak = 0.08, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playRoll() {
    this.tone(240, 0.06, 'square', 0.04, 0);
    this.tone(310, 0.06, 'square', 0.04, 0.06);
    this.tone(280, 0.07, 'triangle', 0.05, 0.13);
  }

  playMove() {
    this.tone(420, 0.08, 'triangle', 0.09, 0);
    this.tone(540, 0.07, 'sine', 0.06, 0.04);
  }

  playCapture() {
    this.tone(520, 0.09, 'sawtooth', 0.06, 0);
    this.tone(360, 0.14, 'triangle', 0.08, 0.06);
  }

  playPrison() {
    this.tone(210, 0.14, 'sawtooth', 0.06, 0);
    this.tone(160, 0.2, 'triangle', 0.07, 0.08);
  }

  playHouse() {
    this.tone(440, 0.1, 'sine', 0.07, 0);
    this.tone(554, 0.14, 'sine', 0.07, 0.07);
  }

  playRansom() {
    this.tone(400, 0.09, 'triangle', 0.08, 0);
    this.tone(600, 0.12, 'triangle', 0.08, 0.08);
  }

  playFinish() {
    this.tone(523, 0.1, 'sine', 0.08, 0);
    this.tone(659, 0.1, 'sine', 0.08, 0.08);
    this.tone(784, 0.18, 'sine', 0.09, 0.16);
  }

  playWin() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, idx) => this.tone(n, 0.24, 'triangle', 0.09, idx * 0.1));
  }
}

export const soundFX = new SoundEffects();
