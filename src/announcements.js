// Spelled out because text-to-speech reads "N" as "en" and may mangle "°".
export function spokenLocation({ lat, lon }) {
  const ns = lat < 0 ? 'south' : 'north';
  const ew = lon < 0 ? 'west' : 'east';
  return `Latitude ${Math.abs(lat).toFixed(2)} degrees ${ns}. Longitude ${Math.abs(lon).toFixed(2)} degrees ${ew}.`;
}

export function spokenValue(sample) {
  if (!sample) return 'Source is not ready.';
  if (sample.value === null) {
    return 'No interpretable visual sample here. This is not a scientific zero or a no-data flag.';
  }
  return `Temperature color position ${Math.round(sample.value * 100)} out of 100. ` +
    'This is a normalized visual palette position, not a measured temperature. ' +
    `Visual trace coverage ${Math.round(sample.density * 100)} percent.`;
}

export function spokenMapDescription(manifest, timestamp) {
  if (!manifest) return 'Map is not ready.';
  const date = new Date(timestamp ?? manifest.frames?.[0]?.timestamp);
  const when = isNaN(date) ? '' : ` Frame time ${date.toISOString().slice(0, 10)}.`;
  return `${manifest.title}. A world map in Web Mercator projection, from the ${manifest.model} ocean model, ` +
    `credited to ${manifest.credit}.${when} Colored traces show sea surface temperature: ` +
    'blue is coldest, then green, yellow, and red is warmest. Trace density is not current speed. ' +
    'Independent submission, not endorsed by NASA.';
}