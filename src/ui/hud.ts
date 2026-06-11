// Minimal Phase 1 HUD: selection summary + FPS. Grows with later phases.

export class Hud {
  private selectionEl = document.getElementById('selection-info')!;
  private fpsEl = document.getElementById('fps')!;
  private hintEl = document.getElementById('hint-bar')!;
  private defaultHint = this.hintEl.innerHTML;

  /** Temporarily replace the hint bar (null = restore default). */
  setHintOverride(text: string | null): void {
    if (text === null) {
      this.hintEl.innerHTML = this.defaultHint;
      this.hintEl.classList.remove('armed');
    } else {
      this.hintEl.textContent = text;
      this.hintEl.classList.add('armed');
    }
  }

  setSelection(labels: string[]): void {
    if (labels.length === 0) {
      this.selectionEl.textContent = 'Birim seçilmedi';
      return;
    }
    const counts = new Map<string, number>();
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
    const parts = [...counts.entries()].map(([l, n]) => (n > 1 ? `${n}× ${l}` : l));
    this.selectionEl.textContent = `Seçili: ${parts.join(', ')}`;
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = `${fps} fps`;
  }
}
