// Camera: world is measured in tiles; TILE px per tile at zoom 1.
// Supports WASD/arrow pan, middle-drag pan, wheel zoom toward cursor.

export const TILE = 32;

export class Camera {
  /** World position (tile units) at the center of the screen. */
  x = 0;
  y = 0;
  zoom = 1;

  viewW = 1;
  viewH = 1;

  constructor(
    private worldW: number,
    private worldH: number,
  ) {}

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  get scale(): number {
    return TILE * this.zoom;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.scale + this.viewW / 2,
      y: (wy - this.y) * this.scale + this.viewH / 2,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.scale + this.x,
      y: (sy - this.viewH / 2) / this.scale + this.y,
    };
  }

  panPixels(dx: number, dy: number): void {
    this.x += dx / this.scale;
    this.y += dy / this.scale;
    this.clamp();
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(0.45, Math.min(2.4, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  /** Keyboard pan, called each frame. */
  update(dt: number, keys: Set<string>): void {
    const speed = 22 / this.zoom; // tiles per second
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * speed * dt;
      this.y += (dy / len) * speed * dt;
      this.clamp();
    }
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  private clamp(): void {
    const halfW = this.viewW / 2 / this.scale;
    const halfH = this.viewH / 2 / this.scale;
    const pad = 2; // allow slight overscroll
    this.x = Math.max(halfW - pad, Math.min(this.worldW - halfW + pad, this.x));
    this.y = Math.max(halfH - pad, Math.min(this.worldH - halfH + pad, this.y));
    // If the map is smaller than the view, just center it.
    if (this.worldW < halfW * 2) this.x = this.worldW / 2;
    if (this.worldH < halfH * 2) this.y = this.worldH / 2;
  }

  /** Visible tile range (clamped to map), for render culling. */
  visibleTiles(): { x0: number; y0: number; x1: number; y1: number } {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.viewW, this.viewH);
    return {
      x0: Math.max(0, Math.floor(tl.x)),
      y0: Math.max(0, Math.floor(tl.y)),
      x1: Math.min(this.worldW - 1, Math.ceil(br.x)),
      y1: Math.min(this.worldH - 1, Math.ceil(br.y)),
    };
  }
}
