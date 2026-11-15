import { clamp } from './coordinates.js';
export const BOUNDARY_NAMES = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
export function boundaryZone(point, size, pixels = 12) {
  if (!size.width || !size.height || !point || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  const zone = Math.min(pixels, size.width / 4, size.height / 4);
  const horizontal = point.x * size.width <= zone ? 'left' : (1 - point.x) * size.width <= zone ? 'right' : null;
  const vertical = point.y * size.height <= zone ? 'top' : (1 - point.y) * size.height <= zone ? 'bottom' : null;
  return vertical && horizontal ? `${vertical}-${horizontal}` : vertical || horizontal;
}
export class BoundaryTracker {
  constructor() { this.zone = null; }
  reset() { this.zone = null; }
  update(point, size) {
    const inner = boundaryZone(point, size, 12), outer = boundaryZone(point, size, 18);
    if (this.zone && outer === this.zone) return null;
    if (!inner) { if (!outer) this.zone = null; return null; }
    if (inner === this.zone) return null;
    // Leaving a corner along one of its edges needs no second edge announcement.
    if (this.zone?.includes('-') && !inner.includes('-') && this.zone.split('-').includes(inner)) { this.zone = inner; return null; }
    this.zone = inner;
    return inner;
  }
}
export function clipExitPoint(from, to) {
  let t = 1;
  if (to.x < 0) t = Math.min(t, (0 - from.x) / (to.x - from.x));
  if (to.x > 1) t = Math.min(t, (1 - from.x) / (to.x - from.x));
  if (to.y < 0) t = Math.min(t, (0 - from.y) / (to.y - from.y));
  if (to.y > 1) t = Math.min(t, (1 - from.y) / (to.y - from.y));
  return { x: clamp(from.x + (to.x - from.x) * t, 0, 1), y: clamp(from.y + (to.y - from.y) * t, 0, 1) };
}

// Every boundary uses the same single-note pattern; spatial placement identifies the edge or corner.
const EDGES = {
  left: [{ hz: 330, delay: 0, duration: .22 }],
  right: [0, .12, .24].map(delay => ({ hz: 660, delay, duration: .065 })),
  top: [{ hz: 660, delay: 0, duration: .12 }, { hz: 880, delay: .17, duration: .12 }],
  bottom: [{ hz: 440, delay: 0, duration: .12 }, { hz: 330, delay: .17, duration: .12 }]
};
export function boundaryPattern(zone) {
  return BOUNDARY_NAMES.includes(zone) ? EDGES.left.map(n => ({ ...n })) : [];
}
export function patternDuration(pattern) { return pattern.reduce((max, n) => Math.max(max, n.delay + n.duration), 0); }
