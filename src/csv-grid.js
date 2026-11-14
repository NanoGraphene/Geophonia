const MAX_CELLS = 2_000_000;
const MAX_TEXT = 16 * 1024 * 1024;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

// Parse CSV locally, including quoted delimiters, escaped quotes and embedded newlines.
export function parseCSV(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Choose a CSV file smaller than 16 MB.');
  text = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', quoted = false, closed = false;
  function finishField() { row.push(field); field = ''; closed = false; }
  function finishRow() {
    finishField();
    if (row.some(value => value.trim() !== '')) records.push(row);
    row = [];
    if (records.length > MAX_CELLS + 1) throw new Error('The CSV contains too many records.');
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
      continue;
    }
    if (c === ',') finishField();
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; finishRow(); }
    else if (c === '"') {
      if (field.length || closed) throw new Error('A CSV quote must begin a field.');
      quoted = true;
    } else {
      if (closed) {
        if (!/\s/.test(c)) throw new Error('Unexpected text after a quoted CSV field.');
      } else field += c;
    }
  }
  if (quoted) throw new Error('A quoted CSV field is not closed.');
  if (field.length || row.length || closed) finishRow();
  if (!records.length) throw new Error('The CSV is empty.');
  const headers = records.shift().map(value => value.trim());
  if (!headers.length || headers.length > 256 || headers.some(value => !value || value.length > 128)) throw new Error('CSV columns need nonempty names of at most 128 characters.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV column names must be unique.');
  if (!records.length) throw new Error('The CSV has no data rows.');
  for (const [index, record] of records.entries()) if (record.length !== headers.length) throw new Error(`CSV row ${index + 2} has a different number of columns.`);
  return { headers, rows: records };
}

export function inferColumns({ headers, rows }) {
  const normalized = name => name.toLowerCase().trim().replace(/[\s_()\[\]°-]+/g, '');
  const find = pattern => headers.find(name => pattern.test(normalized(name))) ?? '';
  const lat = find(/^(lat|latitude|latitudedeg|latitudedegrees|y)$/);
  const lon = find(/^(lon|long|lng|longitude|longitudedeg|longitudedegrees|x)$/);
  const time = find(/^(time|timestamp|datetime|date|year|period)$/);
  const excluded = new Set([lat, lon, time]);
  const candidates = headers.filter(name => !excluded.has(name));
  const numeric = name => {
    const index = headers.indexOf(name);
    const values = rows.slice(0, 100).map(row => String(row[index] ?? '').trim()).filter(value => value && !/^(null|na|n\/a)$/i.test(value));
    return values.length > 0 && values.every(value => NUMBER.test(value) && Number.isFinite(Number(value)));
  };
  const value = candidates.find(name => /^(value|temperature|temp|height|intensity|concentration|radiance|density|amplitude|precipitation|pm25)$/i.test(normalized(name)) && numeric(name))
    ?? candidates.find(numeric) ?? candidates[0] ?? '';
  return { lat, lon, value, time };
}

function finiteNumber(value, description) {
  const text = String(value ?? '').trim();
  if (!NUMBER.test(text) || !Number.isFinite(Number(text))) throw new Error(`${description} must be a finite number.`);
  return Number(text);
}

function regularStep(axis, label) {
  if (axis.length < 2) throw new Error(`At least two distinct ${label} centers are required.`);
  const step = (axis.at(-1) - axis[0]) / (axis.length - 1);
  const tolerance = Math.max(1e-8, Math.abs(step) * 1e-6);
  if (!(step > 0) || axis.some((value, index) => Math.abs(value - axis[0] - index * step) > tolerance)) throw new Error(`${label} centers must form a regular grid. Regrid irregular observations before importing.`);
  return step;
}

function instant(label) {
  // A year or calendar date is a period label, not an invented midnight instant.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/i.exec(label);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', zone] = match;
  const leap = Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneParts = zone === 'Z' || zone === 'z' ? null : zone.slice(1).split(':').map(Number);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days[Number(month) - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (zoneParts && (zoneParts[0] > 23 || zoneParts[1] > 59)) || !Number.isFinite(Date.parse(label))) throw new Error(`Invalid ISO timestamp: ${label}`);
  return new Date(label).toISOString();
}

export function createGridDataset(table, { lat, lon, value, time = '', unit = '', title = '', noData = '' } = {}) {
  const { headers, rows } = table;
  if (!Array.isArray(headers) || !Array.isArray(rows) || !rows.length) throw new Error('The CSV needs headers and data rows.');
  if (rows.length > MAX_CELLS) throw new Error('The dataset exceeds the two-million-cell limit.');
  const selected = [lat, lon, value, ...(time ? [time] : [])];
  if (selected.some(name => !headers.includes(name))) throw new Error('Select valid latitude, longitude, value and optional time columns.');
  if (new Set(selected).size !== selected.length) throw new Error('Latitude, longitude, value and time need separate columns.');
  for (const [name, text, max] of [['title', title, 160], ['unit', unit, 80], ['no-data marker', noData, 100]]) if (typeof text !== 'string' || text.length > max) throw new Error(`The ${name} is too long.`);
  const latColumn = headers.indexOf(lat), lonColumn = headers.indexOf(lon), valueColumn = headers.indexOf(value), timeColumn = time ? headers.indexOf(time) : -1;
  const xs = new Set(), ys = new Set(), periods = new Map(), points = [];
  let min = Infinity, max = -Infinity;
  const sentinel = noData.trim();
  const sentinelNumber = NUMBER.test(sentinel) && Number.isFinite(Number(sentinel)) ? Number(sentinel) : null;
  for (const [index, row] of rows.entries()) {
    if (!Array.isArray(row) || row.length !== headers.length) throw new Error(`CSV row ${index + 2} has a different number of columns.`);
    const latitude = finiteNumber(row[latColumn], `Latitude at row ${index + 2}`);
    const longitude = finiteNumber(row[lonColumn], `Longitude at row ${index + 2}`);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error(`Coordinates at row ${index + 2} are outside valid latitude/longitude bounds.`);
    const label = timeColumn < 0 ? '' : String(row[timeColumn] ?? '').trim();
    if (label.length > 160 || (timeColumn >= 0 && !label)) throw new Error(`Supply a time or period label at row ${index + 2}.`);
    const timestamp = label ? instant(label) : null;
    const key = timestamp ?? label;
    if (!periods.has(key)) periods.set(key, { key, label, timestamp });
    const raw = String(row[valueColumn] ?? '').trim();
    const missing = !raw || /^(null|na|n\/a)$/i.test(raw) || (sentinel && raw === sentinel) || (sentinelNumber !== null && NUMBER.test(raw) && Number(raw) === sentinelNumber);
    const measurement = missing ? null : finiteNumber(raw, `Value at row ${index + 2}`);
    if (measurement !== null) { min = Math.min(min, measurement); max = Math.max(max, measurement); }
    xs.add(longitude); ys.add(latitude); points.push({ longitude, latitude, key, measurement });
  }
  if (!Number.isFinite(min)) throw new Error('The selected value column contains no valid measurements.');
  const longitudes = [...xs].sort((a, b) => a - b), latitudes = [...ys].sort((a, b) => a - b);
  const dx = regularStep(longitudes, 'longitude'), dy = regularStep(latitudes, 'latitude');
  const width = longitudes.length, height = latitudes.length;
  if (width * height * periods.size > MAX_CELLS) throw new Error('The full grid across all dates exceeds the two-million-cell limit.');
  let ordered = [...periods.values()];
  if (ordered.every(period => period.timestamp)) ordered.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  else if (ordered.every(period => /^\d{4}$/.test(period.label))) ordered.sort((a, b) => Number(a.label) - Number(b.label));
  else if (ordered.every(period => /^\d{4}-\d{2}-\d{2}$/.test(period.label))) ordered.sort((a, b) => a.label.localeCompare(b.label));
  const frameIndexes = new Map(ordered.map((period, index) => [period.key, index]));
  const xIndexes = new Map(longitudes.map((x, index) => [x, index]));
  const yIndexes = new Map(latitudes.map((y, index) => [y, height - 1 - index]));
  const grids = ordered.map(() => Array(width * height).fill(null));
  const seen = new Set();
  for (const point of points) {
    const frame = frameIndexes.get(point.key), cell = yIndexes.get(point.latitude) * width + xIndexes.get(point.longitude), key = `${frame}:${cell}`;
    if (seen.has(key)) throw new Error('The CSV contains duplicate coordinates at the same time.');
    seen.add(key); grids[frame][cell] = point.measurement;
  }
  const actualMin = min, actualMax = max;
  if (min === max) { min -= .5; max += .5; }
  const units = unit.trim() || 'source units unspecified';
  return {
    manifest: {
      id: 'local-grid', title: title.trim() || 'Imported grid', credit: 'User-supplied local CSV', sourcePage: '', width, height,
      geo: { projection: 'equirectangular', extent: [Math.max(-180, longitudes[0] - dx / 2), Math.max(-90, latitudes[0] - dy / 2), Math.min(180, longitudes.at(-1) + dx / 2), Math.min(90, latitudes.at(-1) + dy / 2)], gridCenters: { lon: longitudes, lat: [...latitudes].reverse() } },
      feature: { method: 'grid', name: value, unit: units, kind: 'quantitative', estimate: false },
      valueScale: { min, max, unit: units, symbol: units, decimals: 2 },
      mapping: { amplitude: 'value', curve: 'linear' },
      actualRange: { min: actualMin, max: actualMax },
      frames: ordered.map(period => ({ timestamp: period.timestamp, timeLabel: period.label || 'Undated grid' }))
    }, grids
  };
}
