import type { MainScreenView } from "@civ/renderer-api";

/** The web game's camera glide (`CAMERA_MS` in apps/web/src/main.ts): a pan let go glides back over the same time and ease. */
export const RELEASE_MS = 280;

/**
 * A finger dragging the map. The web game knows nothing of it: its camera stays where it was, and
 * the map is drawn (and hit-tested) that many tiles further on. When the game takes the camera
 * back (it moves the camera, another unit comes into play, a key is pressed on the map) the pan
 * glides out while the game's own glide plays, so the two together go straight from where the
 * player was looking to where the game looks.
 */
export class MapPan {
  /** Tiles the drawn map sits east and south of the game's camera. */
  x = 0;
  y = 0;
  private dragging = false;
  private release: { x: number; y: number; start: number } | null = null;
  private seen: { x: number; y: number; active: number | null } | null = null;

  get panned(): boolean {
    return this.x !== 0 || this.y !== 0;
  }

  grab(): void {
    this.dragging = true;
    this.release = null;
  }

  drag(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  drop(): void {
    this.dragging = false;
  }

  /** Glide back to the game's camera. */
  letGo(now: number): void {
    if (this.release || this.dragging || !this.panned) return;
    this.release = { x: this.x, y: this.y, start: now };
  }

  /** The game's view of the map as it is to be drawn: moved by the pan, within the world's top and bottom. */
  shift(view: MainScreenView, map: { width: number; height: number }, viewTilesY: number, active: number | null, now: number): MainScreenView {
    const gx = view.originX + (view.panX ?? 0);
    const gy = view.originY + (view.panY ?? 0);
    const s = this.seen;
    if (s && (Math.abs(s.x - gx) > 1e-6 || Math.abs(s.y - gy) > 1e-6 || s.active !== active)) this.letGo(now);
    this.seen = { x: gx, y: gy, active };
    if (this.release) {
      const t = Math.min(1, (now - this.release.start) / RELEASE_MS);
      const keep = Math.pow(1 - t, 3);
      this.x = this.release.x * keep;
      this.y = this.release.y * keep;
      if (t >= 1) {
        this.x = 0;
        this.y = 0;
        this.release = null;
      }
    } else {
      // Round the world any number of times, the way back is never more than half of it.
      this.x -= map.width * Math.round(this.x / map.width);
    }
    const maxY = Math.max(0, map.height - viewTilesY);
    this.y = Math.max(-gy, Math.min(maxY - gy, this.y));
    if (!this.panned) return view;
    const x = gx + this.x;
    const y = gy + this.y;
    const ox = Math.floor(x);
    const oy = Math.floor(y);
    return { ...view, originX: ((ox % map.width) + map.width) % map.width, panX: x - ox, originY: oy, panY: y - oy };
  }
}
