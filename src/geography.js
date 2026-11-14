import { clamp, geoToMercator, mercatorToGeo, wrapLongitude } from './coordinates.js';

export function createSurfaceMask({ width, height, bytes }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !(bytes instanceof Uint8Array) || bytes.length !== Math.ceil(width * height / 8)) throw new Error('Invalid geographic mask dimensions or bytes.');
  const cell = (x, y) => {
    x = ((x % width) + width) % width;
    y = clamp(y, 0, height - 1);
    const index = y * width + x;
    return (bytes[index >> 3] >> (7 - (index & 7))) & 1;
  };
  const classify = location => {
    if (!location || !Number.isFinite(location.lon) || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90) return { surface: 'unknown', nearCoast: false, confident: false };
    const x = clamp(Math.floor((wrapLongitude(location.lon) + 180) / 360 * width), 0, width - 1);
    const y = clamp(Math.floor((90 - location.lat) / 180 * height), 0, height - 1);
    const land = cell(x, y);
    let nearCoast = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cell(x + dx, y + dy) !== land) nearCoast = true;
    return { surface: land ? 'land' : 'water', nearCoast, confident: !nearCoast, cell: { x, y } };
  };
  return { width, height, cell, classify };
}

export async function loadGeography() {
  const response = await fetch('./geography/manifest.json');
  if (!response.ok) throw new Error('Geographic metadata could not load.');
  const manifest = await response.json();
  const binary = await fetch(manifest.mask.url);
  if (!binary.ok) throw new Error('Geographic surface mask could not load.');
  const bytes = new Uint8Array(await binary.arrayBuffer());
  if (!globalThis.crypto?.subtle) throw new Error('Geographic mask integrity cannot be checked in this browser.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== manifest.mask.sha256) throw new Error('Geographic surface mask failed integrity validation.');
  return { mask: createSurfaceMask({ ...manifest.mask, bytes }), manifest };
}

// Visit every raster cell crossed by a straight segment in the displayed Mercator map.
// Testing row/column boundary fractions avoids skipping narrow mapped features on fast moves.
export function traceSurfacePath(mask, from, to, { wrap = false } = {}) {
  const a = geoToMercator(from.lon, from.lat), b = geoToMercator(to.lon, to.lat);
  let dx = b.x - a.x;
  if (wrap && Math.abs(dx) > .5) dx -= Math.sign(dx);
  const dy = b.y - a.y;
  const times = [0, 1];
  if (dx !== 0) {
    const x0 = a.x * mask.width, x1 = (a.x + dx) * mask.width;
    for (let column = Math.floor(Math.min(x0, x1)) + 1; column < Math.max(x0, x1); column++) times.push((column / mask.width - a.x) / dx);
  }
  if (dy !== 0) {
    const row0 = (90 - from.lat) / 180 * mask.height, row1 = (90 - to.lat) / 180 * mask.height;
    for (let row = Math.floor(Math.min(row0, row1)) + 1; row < Math.max(row0, row1); row++) {
      const latitude = 90 - row / mask.height * 180;
      times.push((geoToMercator(0, latitude).y - a.y) / dy);
    }
  }
  const sorted = [...new Set(times.filter(t => t >= 0 && t <= 1))].sort((x, y) => x - y);
  const points = [mask.classify(from)];
  for (let i = 1; i < sorted.length; i++) {
    const t = (sorted[i - 1] + sorted[i]) / 2;
    const location = { lon: wrapLongitude((a.x + dx * t) * 360 - 180), lat: mercatorToGeo(0, a.y + dy * t).lat };
    points.push(mask.classify(location));
  }
  points.push(mask.classify(to));
  return points;
}

export class SurfaceTransitionTracker {
  constructor(mask, location) { this.mask = mask; this.reset(location); }
  reset(location) { this.stable = this.mask.classify(location).surface; }
  move(from, to, options) {
    if (from.lon === to.lon && from.lat === to.lat) return [];
    const crossings = [];
    for (const point of traceSurfacePath(this.mask, from, to, options)) {
      // Spatial hysteresis: no new cue until a full 3×3 neighborhood is on the new side.
      if (!point.confident || point.surface === this.stable) continue;
      if (this.stable !== 'unknown') crossings.push({ from: this.stable, to: point.surface });
      this.stable = point.surface;
    }
    return crossings;
  }
}
