import { geoToSource } from './coordinates.js';
export const MIN_BRIGHTNESS = 24;
export const MIN_CHROMA = 20;
export const MAX_COLOR_DISTANCE = 0.2;
export function preparePalette(rgb) {
  if (rgb.length < 2) throw new Error('A palette needs at least two colors.');
  return rgb.map((color, index) => {
    const max = Math.max(...color), min = Math.min(...color);
    if (max === min) throw new Error('An achromatic color cannot define an ordered trace color.');
    return { color: color.map(v => (v - min) / (max - min)), position: index / (rgb.length - 1) };
  });
}
export function matchColor(r, g, b, alpha, palette) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (alpha < 255 || max < MIN_BRIGHTNESS || max - min < MIN_CHROMA || (max - min) / max < .3) return null;
  const color = [r, g, b].map(v => (v - min) / (max - min));
  let distance = Infinity, position = null;
  for (const entry of palette) {
    const d = entry.color.reduce((sum, value, i) => sum + (color[i] - value) ** 2, 0);
    if (d < distance) { distance = d; position = entry.position; }
  }
  return distance <= MAX_COLOR_DISTANCE ** 2 ? position : null;
}
export function sampleNeighborhood(image, location, radius, palette) {
  if (!Number.isInteger(radius) || radius < 0 || radius > 10) throw new Error('Sampling radius must be 0–10 source pixels.');
  const { width, height, data } = image;
  const center = geoToSource(location.lon, location.lat, width, height);
  let sum = 0, count = 0, total = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = center.y + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ((center.x + dx) % width + width) % width;
      const i = (y * width + x) * 4;
      const value = matchColor(data[i], data[i + 1], data[i + 2], data[i + 3], palette);
      total++;
      if (value !== null) { sum += value; count++; }
    }
  }
  return { value: count ? sum / count : null, density: total ? count / total : 0,
    validity: count ? 'valid' : 'no-visual-sample', matchedPixels: count, totalPixels: total, pixel: center };
}
