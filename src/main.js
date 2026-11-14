import './styles.css';
import { formatLocation, geoToMercator, geoToSource, moveLocation, pointerToGeo, mercatorToGeo, MAX_LAT } from './coordinates.js';
import { createStore, START_LOCATION } from './state.js';
import { DATASETS, sampleDataset, createSelectionGate } from './datasets.js';
import { mapViewport, toView, fromView } from './map-view.js';
import { loadSource } from './sources.js';
import { sampleNeighborhood } from './sampling.js';
import { mapAudio, validatePitchRange } from './audio-mapping.js';
import { AudioEngine } from './audio.js';
import { loadGeography } from './geography.js';
import { BoundaryTracker, clipExitPoint } from './navigation-cues.js';
const $ = id => document.getElementById(id);
const store = createStore();
const audio = new AudioEngine();
const audioSupported = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
let source = null, geography = null, spatialTimer, active = false, legendPlaying = false, legendTimer, starting = false, pointerInside = false;
const boundaryTracker = new BoundaryTracker();
const selectionGate = createSelectionGate();
let pendingDataset = 'svs-3912', expanded = false;
let viewport = mapViewport(1,1,false);
function announce(text, immediate = false) {
  clearTimeout(spatialTimer);
  spatialTimer = setTimeout(() => { $('status').textContent = text; }, immediate ? 0 : 450);
}
function surfaceDescription(state) {
  return state.surface === 'unknown' ? 'Surface unavailable' : `${state.surface === 'land' ? 'Land' : 'Water'}${state.nearCoast ? ', near mapped shoreline' : ''}`;
}
function sampleDescription(state) {
  if (!state.sample) return 'Source is not ready.';
  if (state.sample.value === null) return 'No interpretable visual sample. This is not a scientific zero or verified no-data flag.';
  return `Image-derived temperature-color position ${Math.round(state.sample.value * 100)} of 100. ${DATASETS[state.dataset].density} ${Math.round(state.sample.density * 100)} percent.`;
}
function render(state) {
  const projected = geoToMercator(state.location.lon, state.location.lat);
  if(projected.y < viewport.top || projected.y > viewport.bottom) layoutMap();
  const point = toView(projected, viewport);
  $('cursor').style.left = `${point.x * 100}%`;
  $('cursor').style.top = `${point.y * 100}%`;
  const definition = DATASETS[state.dataset];
  $('feature-label').textContent = definition.feature;
  $('density-label').textContent = definition.density;
  $('session-topic').textContent = definition.topic;
  const timestamp = source?.manifest.frames[0].timestamp;
  const timeLabel = timestamp ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(timestamp))+' UTC' : 'Dataset not ready';
  $('selected-time').textContent = timeLabel; $('session-date').textContent = timeLabel;
  $('expanded-readout').textContent = `${formatLocation(state.location)} · ${state.surface} · ${state.sample?.value != null ? Math.round(state.sample.value*100)+'/100 visual' : 'No visual sample'}`;
  $('expanded-audio').textContent = state.audio.enabled ? 'Pause audio' : 'Start audio';
  $('location').textContent = formatLocation(state.location);
  // Do not replace a user's partially typed coordinate while editing the form.
  if (document.activeElement !== $('latitude')) $('latitude').value = state.location.lat.toFixed(2);
  if (document.activeElement !== $('longitude')) $('longitude').value = state.location.lon.toFixed(2);
  const pixel = source ? geoToSource(state.location.lon, state.location.lat, source.manifest.width, source.manifest.height) : null;
  $('pixel').textContent = pixel ? `Source pixel ${pixel.x}, ${pixel.y}` : 'Source pixels unavailable';
  const sample = state.sample;
  const mapped = mapAudio(sample, state.audio);
  $('feature').replaceChildren(document.createTextNode(sample?.value != null ? String(Math.round(sample.value * 100)) : '—'));
  const unit = document.createElement('small'); unit.textContent = ' / 100'; $('feature').append(unit);
  $('palette-marker').hidden = sample?.value == null;
  $('palette-marker').style.left = `${(sample?.value ?? 0) * 100}%`;
  $('density').textContent = sample ? `${Math.round(sample.density * 100)}% · ${sample.matchedPixels}/${sample.totalPixels} pixels` : '—';
  $('pitch').textContent = mapped.frequency === null ? 'No data tone' : `${Math.round(mapped.frequency)} Hz`;
  $('sample-note').textContent = sample?.value != null ? 'Mean source-palette position · image-derived' : source ? 'No interpretable visual sample' : 'Waiting for the NASA frame';
  $('surface').textContent = surfaceDescription(state);
  $('surface').dataset.surface = state.surface;
  $('navigation-cue').textContent = state.lastCue;
  $('geography-status').textContent = state.geographyStatus === 'ready' ? 'Approximate land/water geometry · Natural Earth 1:50m' : state.geographyStatus === 'loading' ? 'Loading land/water geometry…' : 'Surface geometry unavailable. Data tones and map-edge cues still work.';
  $('start-audio').innerHTML = state.audio.enabled ? '<span aria-hidden="true">Ⅱ</span> Pause audio' : '<span aria-hidden="true">▶</span> Start audio';
  $('start-audio').disabled = !audioSupported || !source || starting;
  $('expanded-audio').disabled = $('start-audio').disabled;
  if (!audioSupported) $('audio-status').textContent = 'Web Audio is unavailable. Map navigation and text remain available.';
  else if (!state.audio.enabled) $('audio-status').textContent = 'Audio is off. Start when you’re ready.';
  else if (legendPlaying) $('audio-status').textContent = 'Playing an audio legend example.';
  else if (!active) $('audio-status').textContent = 'Audio paused outside the map. Move or focus the map to continue.';
  else $('audio-status').textContent = sample?.value != null ? 'Audio on · exploring the selected location' : state.audio.surfaceGuide && state.surface !== 'unknown' ? `No data tone · quiet ${state.surface} guide at 140 Hz` : 'Audio on · no visual sample; continuous tone is silent';
  audio.update(sample, state.audio, active && !legendPlaying, state.surface);
}
store.subscribe(render);
function resample(location = store.get().location, extra = {}) {
  const sample = source ? sampleDataset(source, location, store.get().radius, sampleNeighborhood) : null;
  const surface = geography?.mask.classify(location) ?? { surface: 'unknown', nearCoast: false };
  return store.update({ ...extra, location, sample, validity: sample?.validity ?? 'loading', surface: surface.surface, nearCoast: surface.nearCoast });
}
function stopLegend() {
  clearTimeout(legendTimer); audio.cancelLegend(); legendPlaying = false; $('legend-status').textContent = '';
}
function select(location, immediate = false, mode = 'relocate') {
  if (legendPlaying) stopLegend();
  active = true;
  pointerInside = mode === 'pointer';
  if (mode === 'relocate') boundaryTracker.reset();
  const boundary = boundaryTracker.update(toView(geoToMercator(location.lon, location.lat), viewport), $('map').getBoundingClientRect());
  const preferences = store.get().audio;
  const parts = [];
  if (boundary && preferences.boundaryCues) parts.push(`${boundary.replace('-', ' ')} map boundary`);
  const cue = parts.join('. ');
  const state = resample(location, cue ? { lastCue: cue } : {});
  audio.navigationCue({ boundary }, preferences);
  announce(`${formatLocation(location)}. ${surfaceDescription(state)}. ${sampleDescription(state)}${cue ? ' ' + cue + '.' : ''}`, immediate);
}
function silence(message = 'All application audio is silent.') {
  active = false; starting = false; pointerInside = false; stopLegend(); audio.stop();
  boundaryTracker.reset();
  store.update({ audio: { ...store.get().audio, enabled: false } });
  $('audio-status').textContent = message; announce(message, true);
}
audio.onInterrupted = () => silence('Audio was interrupted. Select Start audio to resume.');
$('map').addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); select(moveLocation(store.get().location, event.key, store.get().spatialStep), false, 'keyboard');
  } else if (event.key === 'Home') {
    event.preventDefault(); select({ ...START_LOCATION }, true);
  }
});
$('map').addEventListener('focus', () => {
  stopLegend(); active = true; pointerInside = false; boundaryTracker.reset(); render(store.get());
});
$('map').addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' && event.buttons === 0) return;
  const location = pointerLocation(event);
  if (location) select(location, false, 'pointer');
});
$('map').addEventListener('pointerdown', event => {
  $('map').focus({ preventScroll: true });
  const location = pointerLocation(event);
  if (location) select(location, true, 'pointer');
});
function leaveMap(event) {
  if (event.type === 'pointercancel') audio.cancelTones();
  if (pointerInside && event.type === 'pointerleave') {
    const rect = $('map').getBoundingClientRect();
    if (rect.width && rect.height && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const from = toView(geoToMercator(store.get().location.lon, store.get().location.lat), viewport);
      const to = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
      if (to.x < 0 || to.x > 1 || to.y < 0 || to.y > 1) {
        const exit = clipExitPoint(from, to);
        const globalExit = fromView(exit,viewport);
        select(mercatorToGeo(globalExit.x, globalExit.y), false, 'pointer');
      }
    }
  }
  active = false; pointerInside = false; stopLegend(); audio.cancelTones('missing'); render(store.get());
  boundaryTracker.reset();
}
$('map').addEventListener('pointerleave', leaveMap);
$('map').addEventListener('pointercancel', leaveMap);
$('reset').addEventListener('click', () => select({ ...START_LOCATION }, true));
$('step').addEventListener('change', event => store.update({ spatialStep: Number(event.target.value) }));
for (const button of document.querySelectorAll('[data-direction]')) button.addEventListener('click', () => select(moveLocation(store.get().location, button.dataset.direction, store.get().spatialStep), true, 'keyboard'));
$('coordinate-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('coordinate-form').reportValidity()) return;
  select({ lat: Number($('latitude').value), lon: Number($('longitude').value) }, true);
});
$('latitude').min = -MAX_LAT; $('latitude').max = MAX_LAT;
$('radius').addEventListener('change', event => {
  stopLegend(); store.update({ radius: Number(event.target.value) });
  const state = resample(); announce(sampleDescription(state), true);
});
$('volume').addEventListener('input', event => {
  stopLegend(); const volume = Number(event.target.value) / 100;
  $('volume-value').textContent = `${Math.round(volume * 100)}%`;
  store.update({ audio: { ...store.get().audio, volume } });
});
for (const [id, preference] of [['surface-guide', 'surfaceGuide'], ['boundary-cues', 'boundaryCues']]) {
  $(id).addEventListener('change', event => {
    stopLegend(); audio.cancelTones('navigation');
    store.update({ audio: { ...store.get().audio, [preference]: event.target.checked } });
  });
}
$('surface-contrast').addEventListener('input', event => {
  stopLegend(); const surfaceContrast = Number(event.target.value) / 100;
  $('contrast-value').textContent = `${Math.round(surfaceContrast * 100)}%`;
  store.update({ audio: { ...store.get().audio, surfaceContrast } });
});
$('apply-pitch').addEventListener('click', () => {
  const min = Number($('min-hz').value), max = Number($('max-hz').value);
  if (!$('min-hz').value || !$('max-hz').value || !validatePitchRange(min, max)) {
    $('pitch-error').textContent = 'Use 80–2000 Hz, with low pitch below high pitch.';
    return;
  }
  stopLegend(); $('pitch-error').textContent = `Pitch range set to ${min}–${max} Hz.`;
  store.update({ audio: { ...store.get().audio, minHz: min, maxHz: max } });
});
async function startAudio() {
  if (starting || !source || !audioSupported) return false;
  starting = true; render(store.get());
  try {
    const started = await audio.start();
    starting = false;
    if (!started) { render(store.get()); return false; }
    active = true; pointerInside = false; boundaryTracker.reset();
    store.update({ audio: { ...store.get().audio, enabled: true } });
    return true;
  } catch (error) {
    silence('Audio could not start. Try again or use the text readout.');
    console.error(error); return false;
  }
}
$('start-audio').addEventListener('click', async () => {
  stopLegend();
  if (store.get().audio.enabled) silence('Audio paused. Your location is preserved.');
  else await startAudio();
});
$('silence').addEventListener('click', () => silence());
document.addEventListener('keydown', event => { if (event.key === 'Escape') silence(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) silence('Audio paused while this tab is inactive. Select Start audio to resume.'); });
window.addEventListener('pagehide', () => silence());
for (const button of document.querySelectorAll('[data-legend]')) button.addEventListener('click', async () => {
  if (!source || !audioSupported || starting) return;
  stopLegend();
  if (!store.get().audio.enabled && !await startAudio()) return;
  active = false; legendPlaying = true;
  const duration = audio.legend(button.dataset.legend, store.get().audio);
  render(store.get());
  $('legend-status').textContent = `Playing: ${button.querySelector('strong').textContent}.`;
  legendTimer = setTimeout(() => {
    legendPlaying = false; render(store.get());
    $('legend-status').textContent = 'Example finished. Move or refocus the map to explore.';
  }, duration + 50);
});
async function initializeGeography() {
  if ($('retry-geography').disabled) return;
  $('retry-geography').disabled = true; $('retry-geography').hidden = true;
  geography = null; resample(store.get().location, { geographyStatus: 'loading' });
  try {
    geography = await loadGeography();
    resample(store.get().location, { geographyStatus: 'ready' });
    announce(`Surface geometry ready. ${surfaceDescription(store.get())}.`, true);
  } catch (error) {
    resample(store.get().location, { geographyStatus: 'unavailable' });
    $('retry-geography').hidden = false;
    announce('Surface geometry could not load. Data sonification and map-edge cues remain available.', true);
    console.error(error);
  } finally { $('retry-geography').disabled = false; }
}
async function initialize(id = pendingDataset) {
  pendingDataset = id; const ticket = selectionGate.next();
  active = false; stopLegend(); audio.cancelTones(); audio.fade(); source = null;
  store.update({sample:null,validity:'loading'});
  $('retry').hidden = true; $('map').setAttribute('aria-busy', 'true');
  $('load-message').hidden = false; $('load-message').textContent = 'Loading NASA dataset…';
  for (const b of document.querySelectorAll('[data-legend]')) b.disabled = true;
  try {
    const candidate = await loadSource(id);
    const image = new Image(); image.src = candidate.manifest.frames[0].display; await image.decode();
    if (!selectionGate.current(ticket)) return;
    source = candidate; $('frame').src = image.src; $('frame').alt = DATASETS[id].alt;
    $('source-link').href = source.manifest.sourcePage; $('credit-text').textContent = source.manifest.credit;
    $('manifest-link').href = DATASETS[id].manifest;
    $('source-legend').src = source.manifest.legend.local;
    $('source-legend').alt = id === 'svs-5147' ? 'NASA near-surface temperature colorbar, minus 40 to plus 40 degrees Celsius. Application values are visual estimates.' : 'NASA sea surface temperature source colorbar, 0 to 32 degrees Celsius. Application values are visual estimates.';
    $('dataset-description').textContent = `${source.manifest.title}. ${source.manifest.representedInterval} ${source.manifest.limitations ?? 'Ocean traces are colored by temperature; gaps are not scientific zeros.'}`;
    $('matching-description').textContent = source.manifest.matching === 'rgb' ? 'This non-monotonic temperature palette is matched in literal RGB space, not hue. Terrain shading and repeated colors make values approximate; no scientific Celsius values are reported. Annotation rectangles are masked. Coverage is the fraction of neighborhood pixels matching the source legend.' : 'Ocean traces use chromatic source-palette matching. Mean visual palette position controls pitch; trace coverage controls amplitude. These are image-derived features, not measured temperature or current speed.';
    $('palette-track').style.background = source.manifest.matching === 'rgb' ? `linear-gradient(90deg,${source.palette.map(c=>'rgb('+c.join(',')+')').join(',')})` : '';
    $('load-message').hidden = true; $('map').setAttribute('aria-busy','false');
    resample(store.get().location,{dataset:id,variable:source.manifest.variable??'temperature-color',timestamp:source.manifest.frames[0].timestamp});
    for (const b of document.querySelectorAll('[data-legend]')) b.disabled = !audioSupported;
    announce(`${source.manifest.title} ready. ${sampleDescription(store.get())}`,true);
    if (!geography && store.get().geographyStatus !== 'loading') await initializeGeography();
  } catch(error) {
    if (!selectionGate.current(ticket)) return;
    source = null; store.update({validity:'load-error',sample:null});
    $('map').setAttribute('aria-busy','false'); $('load-message').hidden=false;
    $('load-message').textContent='Selected dataset could not load. Retry or choose another dataset.';
    $('retry').hidden=false; announce($('load-message').textContent,true); console.error(error);
  }
}
$('retry').addEventListener('click',()=>initialize());
$('dataset').addEventListener('change',event=>initialize(event.target.value));
for(const [id,location] of [['land-test',{lon:15,lat:23}],['water-test',{lon:-45,lat:30}]]) {
 $(id).addEventListener('click',()=>{
  select(location,true);
  if(pendingDataset!=='svs-5147'){$('dataset').value='svs-5147';initialize('svs-5147');}
 });
}
$('retry-geography').addEventListener('click', initializeGeography);
function pointerLocation(event){
 const local = pointerToGeo(event.clientX,event.clientY,$('map').getBoundingClientRect());
 if(!local)return null;
 const position=fromView(geoToMercator(local.lon,local.lat),viewport);
 return mercatorToGeo(position.x,position.y);
}
function layoutMap(){
 const stage=$('map-stage');
 if(expanded){$('map').style.height=`${Math.min(stage.clientHeight,stage.clientWidth)}px`;}
 else $('map').style.height='';
 const rect=$('map').getBoundingClientRect();
 const center=geoToMercator(store.get().location.lon,store.get().location.lat).y;
 viewport=mapViewport(rect.width,rect.height,expanded,center);
 $('frame').style.objectPosition=`50% ${viewport.span<1?viewport.top/(1-viewport.span)*100:50}%`;
 boundaryTracker.reset();
}
const panel=$('map-panel'), placeholder=document.createComment('map panel position');panel.before(placeholder);
$('expand-map').addEventListener('click',()=>{
 pointerInside=false; expanded=true; $('expanded-content').append(panel); $('expanded-dialog').showModal();
 document.body.classList.add('map-expanded'); layoutMap(); render(store.get()); $('map').focus();
});
function closeExpanded(){
 pointerInside=false;
 if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 expanded=false; placeholder.after(panel); $('expanded-dialog').close();
 document.body.classList.remove('map-expanded'); layoutMap(); render(store.get()); $('expand-map').focus();
}
$('close-expanded').addEventListener('click',closeExpanded);
$('expanded-dialog').addEventListener('cancel',event=>{event.preventDefault();silence();closeExpanded();});
$('expanded-audio').addEventListener('click',()=>$('start-audio').click());
$('expanded-silence').addEventListener('click',()=>silence());
$('browser-fullscreen').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('expanded-dialog').requestFullscreen();}
 catch{announce('Browser fullscreen is unavailable. Expanded map remains available.',true);}
});
document.addEventListener('fullscreenchange',()=>{layoutMap();render(store.get());if(!document.fullscreenElement)silence('Browser fullscreen exited. Audio paused.');});
new ResizeObserver(()=>{layoutMap();render(store.get());}).observe($('map-stage'));
render(store.get()); initialize(); initializeGeography();
