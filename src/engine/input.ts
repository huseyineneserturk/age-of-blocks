// Mouse + keyboard input. Translates raw events into RTS intents:
// point-select, box-select, right-click command, middle-drag pan, wheel zoom.

export interface SelectRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface InputCallbacks {
  onSelectPoint(sx: number, sy: number, additive: boolean): void;
  onSelectRect(rect: SelectRect, additive: boolean): void;
  onCommand(sx: number, sy: number): void;
  onPan(dxPx: number, dyPx: number): void;
  onZoom(sx: number, sy: number, factor: number): void;
}

const DRAG_THRESHOLD = 6; // px before a click becomes a box select

export class Input {
  readonly keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;

  /** Active left-drag selection box (screen px), for the renderer. */
  dragRect: SelectRect | null = null;

  private leftDownAt: { x: number; y: number } | null = null;
  private middleDownAt: { x: number; y: number } | null = null;

  attach(canvas: HTMLCanvasElement, cb: InputCallbacks): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.leftDownAt = { x: e.clientX, y: e.clientY };
      } else if (e.button === 1) {
        e.preventDefault();
        this.middleDownAt = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (this.leftDownAt) {
        const dx = e.clientX - this.leftDownAt.x;
        const dy = e.clientY - this.leftDownAt.y;
        if (this.dragRect || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          this.dragRect = {
            x0: Math.min(this.leftDownAt.x, e.clientX),
            y0: Math.min(this.leftDownAt.y, e.clientY),
            x1: Math.max(this.leftDownAt.x, e.clientX),
            y1: Math.max(this.leftDownAt.y, e.clientY),
          };
        }
      }

      if (this.middleDownAt) {
        cb.onPan(this.middleDownAt.x - e.clientX, this.middleDownAt.y - e.clientY);
        this.middleDownAt = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.leftDownAt) {
        const additive = e.shiftKey;
        if (this.dragRect) {
          cb.onSelectRect(this.dragRect, additive);
        } else {
          cb.onSelectPoint(e.clientX, e.clientY, additive);
        }
        this.leftDownAt = null;
        this.dragRect = null;
      } else if (e.button === 1) {
        this.middleDownAt = null;
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        cb.onCommand(e.clientX, e.clientY);
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        cb.onZoom(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      },
      { passive: false },
    );

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
  }
}
