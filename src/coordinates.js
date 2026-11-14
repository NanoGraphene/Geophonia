export const MAX_LAT = 85.0511287798066;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Preserve both visible edges; wrapping occurs only after moving beyond them.
export function wrapLongitude(lon) {
  if (lon >= -180 && lon <= 180) return lon;
  return ((lon + 180) % 360 + 360) % 360 - 180;
}
export function geoToMercator(lon, lat) {
  const radians = clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI / 180;
  return { x: (wrapLongitude(lon) + 180) / 360,
    y: clamp((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2, 0, 1) };
}
export function mercatorToGeo(x, y) {
  return { lon: clamp(x, 0, 1) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * clamp(y, 0, 1)))) * 180 / Math.PI };
}
export function geoToSource(lon, lat, width, height) {
  return { x: clamp(Math.floor((wrapLongitude(lon) + 180) / 360 * width), 0, width - 1),
    y: clamp(Math.floor((90 - clamp(lat, -90, 90)) / 180 * height), 0, height - 1) };
}
export function pointerToGeo(clientX, clientY, rect) {
  if (!rect.width || !rect.height) return null;
  if (clientX < rect.left || clientX > rect.left + rect.width || clientY < rect.top || clientY > rect.top + rect.height) return null;
  return mercatorToGeo((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
}
export function moveLocation(location, key, step) {
  let { lon, lat } = location;
  if (key === 'ArrowLeft') lon -= step;
  if (key === 'ArrowRight') lon += step;
  if (key === 'ArrowUp') lat += step;
  if (key === 'ArrowDown') lat -= step;
  return { lon: wrapLongitude(lon), lat: clamp(lat, -MAX_LAT, MAX_LAT) };
}
export function formatLocation({ lon, lat }) {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;
}
