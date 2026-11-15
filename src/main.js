import './styles.css';
import { formatLocation, geoToMercator, geoToSource, moveLocation, pointerToGeo, mercatorToGeo, MAX_LAT } from './coordinates.js';
import { createStore, START_LOCATION } from './state.js';
import { canUseBrowserFullscreen, enterBrowserFullscreen } from './fullscreen.js';
import { DATASETS, UNAVAILABLE_DATASETS, registerDataset, sampleDataset, createSelectionGate } from './datasets.js';
import { fitMap, mapViewport, toView, fromView } from './map-view.js';
import { loadSource, getManifest, registerLocalSource } from './sources.js';
import { sampleNeighborhood } from './sampling.js';
import { mapAudio, validatePitchRange } from './audio-mapping.js';
import { AudioEngine } from './audio.js';
import { loadGeography, SurfaceTransitionTracker } from './geography.js';
import { BoundaryTracker, clipExitPoint } from './navigation-cues.js';
import { ClipSpeech } from './clip-speech.js';
import { readingPlan } from './speech-plan.js';
import { InstantSpeech } from './instant-speech.js';
import { loadPlaceNames } from './place-names.js';
import { stepFrame, keyboardCommand } from './timeline.js';
import { placeText, valueText, dateText, formattedValue } from './narration-text.js';
import { featureProfile, sourcePixel, frameLabel, recommendedMapping } from './data-profiles.js';
import { parseCSV, inferColumns, createGridDataset } from './csv-grid.js';
const $ = id => document.getElementById(id);
const store = createStore();
const audio = new AudioEngine();
const audioSupported = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
let source = null, geography = null, surfaceTracker = null, spatialTimer, active = false, legendPlaying = false, legendTimer, starting = false, pointerInside = false;
const boundaryTracker = new BoundaryTracker();
const selectionGate = createSelectionGate();
let pendingDataset = 'svs-3912', expanded = false;
let viewport = mapViewport(1,1,false);
let placeLookup = null, placeStatus = 'loading', pendingIndex = 0;
const catalogs = new Map(), mappingSettings = new Map(), variableSettings = new Map();
let importTable=null, localCounter=0, importSerial=0;
function populateDatasets(selected=$('dataset').value) {
  $('dataset').replaceChildren();
  for(const [id,definition] of Object.entries(DATASETS)) $('dataset').add(new Option(definition.label,id));
  $('dataset').value=DATASETS[selected]?selected:'svs-3912';
}
populateDatasets('svs-3912');
for(const item of UNAVAILABLE_DATASETS) {
  const row=document.createElement('li'),link=document.createElement('a');link.href=item.sourcePage;link.textContent=item.title;link.target='_blank';link.rel='noopener';row.append(link,document.createTextNode(': '+item.reason));$('unavailable-datasets').append(row);
}
function mappingControls(mapping) {
  $('mapping-min').value=mapping.min;$('mapping-max').value=mapping.max;$('mapping-curve').value=mapping.curve;$('mapping-amplitude').value=mapping.amplitude;
}
function applyMapping(mapping) {
  mappingSettings.set(store.get().dataset,mapping);store.update({audio:{...store.get().audio,mapping}});mappingControls(mapping);
}
$('mapping-apply').addEventListener('click',()=>{
  const min=Number($('mapping-min').value),max=Number($('mapping-max').value),curve=$('mapping-curve').value;
  if(!$('mapping-min').value||!$('mapping-max').value||!Number.isFinite(min)||!Number.isFinite(max)||min>=max||(curve==='log'&&min<=0)){$('mapping-status').textContent='Use a finite minimum below the maximum. Logarithmic ranges need a positive minimum.';return;}
  stopLegend();applyMapping({min,max,curve,amplitude:$('mapping-amplitude').value});$('mapping-status').textContent='Mapping applied. The same audio range is used for every frame; values outside it clip.';
});
$('mapping-auto').addEventListener('click',()=>{if(!source)return;applyMapping(recommendedMapping(source.manifest));$('mapping-status').textContent='Automatic metadata/whole-sequence range restored.';});
$('variable').addEventListener('change',event=>{
  stopNarration();variableSettings.set(store.get().dataset,event.target.value);store.update({variable:event.target.value});resample();
});
$('import-file').addEventListener('change',async event=>{
  const ticket=++importSerial,file=event.target.files[0];if(!file)return;importTable=null;$('import-load').disabled=true;
  try {
    if(file.size>16*1024*1024)throw new Error('Choose a CSV smaller than 16 MB.');
    const text=await file.text();if(ticket!==importSerial)return;
    const table=parseCSV(text),inferred=inferColumns(table);importTable=table;
    for(const [id,key]of [['import-lat','lat'],['import-lon','lon'],['import-value','value'],['import-time','time']]) {
      $(id).replaceChildren();if(key==='time')$(id).add(new Option('No time column',''));
      for(const column of table.headers)$(id).add(new Option(column,column));$(id).value=inferred[key];
    }
    $('import-title').value=file.name.replace(/\.csv$/i,'');
    const unitsColumn=table.headers.findIndex(h=>/^units?$/i.test(h));
    const units=unitsColumn<0?[]:[...new Set(table.rows.map(r=>r[unitsColumn]).filter(Boolean))];$('import-unit').value=units.length===1?units[0]:'';
    $('import-load').disabled=false;$('import-status').textContent=`${table.rows.length} rows found. Confirm the columns and units, then add the dataset.`;
  }catch(error){if(ticket===importSerial)$('import-status').textContent=error.message;}
});
$('import-load').addEventListener('click',()=>{
  if(!importTable)return;
  try {
    const dataset=createGridDataset(importTable,{lat:$('import-lat').value,lon:$('import-lon').value,value:$('import-value').value,time:$('import-time').value,unit:$('import-unit').value,title:$('import-title').value,noData:$('import-nodata').value});
    const id=`local-grid-${++localCounter}`;dataset.manifest.id=id;dataset.manifest.limitations='User-supplied regular geographic grid. Units and scientific interpretation are provided by you; the app does not verify them.';
    registerDataset(id,{label:dataset.manifest.title,feature:dataset.manifest.feature.name,density:'Valid cell coverage',topic:'LOCAL GRID',alt:dataset.manifest.title+' rendered as a geographic scalar grid.'});
    registerLocalSource(id,dataset);populateDatasets(id);initialize(id,0);
    $('import-status').textContent=`Added locally: ${dataset.manifest.title}. ${dataset.manifest.frames.length} frame(s); one automatic range across all frames. Your CSV stays in this tab.`;
  }catch(error){$('import-status').textContent=error.message;}
});

let speechEngine='builtin',voiceWarmTimer;
function speechStatus(message){$('voice-status').textContent=message;$('expanded-voice-status').textContent=message;}
function speechBlocked(blocked){$('speech-help').hidden=!blocked;}
const clipSpeech=new ClipSpeech({onStatus:speechStatus,onActive:active=>audio.setNarrationActive(active),onBlocked:speechBlocked});
const narrator = new InstantSpeech({
  onActive: active => audio.setNarrationActive(active),
  onStatus:speechStatus,onBlocked:speechBlocked,
  onVoices: (voices, selected) => {
    if(speechEngine==='native'&&!voices.length)speechEngine='builtin';
    $('voice-choice').replaceChildren();
    $('voice-choice').add(new Option('Built-in natural voice · works without system voices','builtin'));
    for (const voice of voices) $('voice-choice').add(new Option(`${voice.name} · ${voice.lang}${voice.localService===false?' · online':' · device'}`, 'native:'+voice.voiceURI));
    $('voice-choice').value=speechEngine==='builtin'?'builtin':'native:'+selected;
  }
});
function stopNarration() { narrator.stop();clipSpeech.stop(); }
function readSelection(kind) {
  stopLegend();
  const state = store.get();
  const text = kind === 'place' ? placeText(placeLookup?.(state.location), state.location, placeStatus)
    : kind === 'test' ? 'Speech is ready.'
    : state.validity === 'load-error' ? 'The selected frame could not load. Retry the frame or select another date.'
    : kind === 'date' ? source?frameLabel(source.frame,dateText):dateText(null)
    : valueText(state, source?.manifest);
  $('voice-transcript').textContent = text; $('expanded-voice-transcript').textContent = text;
  stopNarration();
  if(speechEngine==='builtin')clipSpeech.speak(planReading(kind));else narrator.speak(text);
}
function planReading(kind){return readingPlan(kind,{state:store.get(),manifest:source?.manifest,frame:source?.frame,place:placeLookup?.(store.get().location),placeStatus});}
$('voice-test').addEventListener('click',()=>readSelection('test'));
$('map-voice-test').addEventListener('click',()=>readSelection('test'));
$('expanded-voice-test').addEventListener('click',()=>readSelection('test'));
for (const button of document.querySelectorAll('[data-read]')) button.addEventListener('click', () => readSelection(button.dataset.read));
$('voice-stop').addEventListener('click', () => {stopNarration();$('voice-status').textContent='Speech stopped.';});
$('voice-enabled').addEventListener('change', event => {
  narrator.setEnabled(event.target.checked);clipSpeech.setEnabled(event.target.checked);
  for(const id of ['voice-test','map-voice-test','expanded-voice-test'])$(id).disabled=!event.target.checked;
  $('voice-status').textContent = event.target.checked ? 'Ready · 1 place · 2 value · 3 date' : 'Spoken shortcuts are off.';
});
$('voice-choice').addEventListener('change',event=>{stopNarration();speechEngine=event.target.value==='builtin'?'builtin':'native';if(speechEngine==='native')narrator.selectVoice(event.target.value.slice(7));speechStatus(speechEngine==='builtin'?'Built-in natural voice ready. Press 1, 2 or 3.':'Device/browser voice selected. Click Test voice to check it.');});
$('voice-speed').addEventListener('change', event => { stopNarration(); narrator.rate=Number(event.target.value);clipSpeech.rate=Number(event.target.value); });
$('voice-volume').addEventListener('input',event=>{const volume=Number(event.target.value)/100;narrator.setVolume(volume);clipSpeech.setVolume(volume);$('voice-volume-value').textContent=event.target.value+'%';});
async function initializePlaces() {
  if ($('retry-places').disabled) return;
  placeStatus='loading';$('retry-places').disabled=true;$('retry-places').hidden=true;
  try { placeLookup=await loadPlaceNames();placeStatus='ready'; }
  catch(error){placeStatus='error';$('retry-places').hidden=false;console.error(error);}
  finally{$('retry-places').disabled=false;render(store.get());warmCurrentVoice();}
}
$('retry-places').addEventListener('click',initializePlaces);
function syncTimeline() {
  const manifest=catalogs.get(pendingDataset),count=manifest?.frames.length??0;
  for(const id of ['timeline','expanded-timeline']) {
    $(id).min=0;$(id).max=Math.max(0,count-1);$(id).value=pendingIndex;$(id).disabled=count<2;
    $(id).setAttribute('aria-valuetext', count ? `${frameLabel(manifest.frames[pendingIndex],dateText)} Frame ${pendingIndex+1} of ${count}${source?'':' · loading'}` : 'Loading available dates');
  }
  const label=count ? `${frameLabel(manifest.frames[pendingIndex],dateText)} · ${pendingIndex+1} of ${count}${source?'':' · loading'}` : 'Loading available dates…';
  $('timeline-date').textContent=label;$('expanded-timeline-date').textContent=label;
  $('time-previous').disabled=!count||pendingIndex<=0;$('time-next').disabled=!count||pendingIndex>=count-1;
}
function changeTime(index) {
  const count=catalogs.get(pendingDataset)?.frames.length??0;
  const target=stepFrame(0,Number(index),count);
  if(!count||target===pendingIndex)return;
  initialize(pendingDataset,target);
}
for(const id of ['timeline','expanded-timeline']) $(id).addEventListener('input',event=>changeTime(event.target.value));
$('time-previous').addEventListener('click',()=>changeTime(pendingIndex-1));
$('time-next').addEventListener('click',()=>changeTime(pendingIndex+1));
document.addEventListener('keydown',event=>{
  const target=event.target;
  const timeline=target.id==='timeline'||target.id==='expanded-timeline';
  const numeric=['1','2','3'].includes(event.key);
  const typing=!!target.closest('textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
  const selecting=!!target.closest('select');
  const editing=typing||(selecting&&!(pointerInside&&numeric));
  const command=keyboardCommand(event,{editing,timeline,speech:narrator.enabled,otherRange:target.matches('input[type="range"]')&&!timeline});
  if(!command)return;
  event.preventDefault();
  if(['place','value','date'].includes(command)){if(pointerInside&&selecting)$('map').focus({preventScroll:true});readSelection(command);return;}
  const count=catalogs.get(pendingDataset)?.frames.length??0;
  changeTime(command==='first'?0:command==='last'?count-1:pendingIndex+(command==='previous'?-1:1));
});
function announce(text, immediate = false) {
  clearTimeout(spatialTimer);
  spatialTimer = setTimeout(() => { $('status').textContent = text; }, immediate ? 0 : 450);
}
function surfaceDescription(state) {
  return state.surface === 'unknown' ? 'Surface unavailable' : `${state.surface === 'land' ? 'Land' : 'Water'}${state.nearCoast ? ', near mapped shoreline' : ''}`;
}
function sampleDescription(state) {
  if(!state.sample)return 'Source is not ready.';
  if(state.sample.value===null)return state.sample.validity==='outside-coverage'?'Outside this dataset coverage.':'No interpretable sample.';
  return `${featureProfile(source.manifest).name}: ${formattedValue(state.sample,source.manifest)}. ${DATASETS[state.dataset].density} ${Math.round(state.sample.density*100)} percent.`;
}
function render(state) {
  syncTimeline();
  const projected = geoToMercator(state.location.lon, state.location.lat);
  if(projected.y < viewport.top || projected.y > viewport.bottom) layoutMap();
  const point = toView(projected, viewport);
  $('cursor').style.left = `${point.x * 100}%`;
  $('cursor').style.top = `${point.y * 100}%`;
  const definition = DATASETS[state.dataset];
  const profile=source?featureProfile(source.manifest):null;
  const category=profile?.categories?.find(c=>c.id===state.variable);
  $('feature-label').textContent=category?`${category.name} · visual strength`:profile?.name??definition.feature;
  $('density-label').textContent = definition.density;
  $('session-topic').textContent = definition.topic;
  const timeLabel=source?frameLabel(source.frame,dateText):'Dataset not ready';
  $('selected-time').textContent = timeLabel; $('session-date').textContent = timeLabel;
  $('expanded-readout').textContent=`${formatLocation(state.location)} · ${state.surface} · ${source?formattedValue(state.sample,source.manifest):'Loading data'}`;
  $('expanded-audio').textContent = state.audio.enabled ? 'Pause audio' : 'Start audio';
  $('location').textContent = formatLocation(state.location);
  const namedPlace=placeLookup?.(state.location);
  $('place-name').textContent=namedPlace?.name ?? (placeStatus==='loading'?'Loading place names…':placeStatus==='error'?'Place names unavailable':'No mapped place name');
  $('mapping-unit').textContent=source?.manifest.valueScale?.unit??'source value units';
  // Do not replace a user's partially typed coordinate while editing the form.
  if (document.activeElement !== $('latitude')) $('latitude').value = state.location.lat.toFixed(2);
  if (document.activeElement !== $('longitude')) $('longitude').value = state.location.lon.toFixed(2);
  const pixel=source?sourcePixel(source.manifest,state.location):null;
  $('pixel').textContent = pixel ? `Source pixel ${pixel.x}, ${pixel.y}` : 'Source pixels unavailable';
  const sample = state.sample;
  const mapped = mapAudio(sample, state.audio);
  $('feature').textContent=source?formattedValue(sample,source.manifest):'—';
  $('palette-marker').hidden = sample?.value == null;
  $('palette-marker').style.left = `${(sample?.value ?? 0) * 100}%`;
  $('density').textContent = sample ? `${Math.round(sample.density * 100)}% · ${sample.matchedPixels}/${sample.totalPixels} ${profile?.method==='grid'?'cells':'pixels'}` : '—';
  $('pitch').textContent = mapped.frequency === null ? 'No data tone' : `${Math.round(mapped.frequency)} Hz`;
  $('sample-note').textContent=sample?.value!=null?(profile?.estimate===false?'Neighborhood mean · source grid units':'Image-derived visual estimate'):sample?.validity==='outside-coverage'?'Outside dataset coverage':source?'No interpretable sample':'Waiting for the selected frame';
  const extent=source?.manifest.geo?.extent;
  $('dataset-center').hidden=!extent||(extent[2]-extent[0]>=359.999&&extent[3]-extent[1]>=169);
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
  else $('audio-status').textContent = sample?.value != null ? 'Audio on · exploring the selected location' : 'Audio on · no visual sample; data tone is silent';
  audio.update(sample, state.audio, active && !legendPlaying, state.surface);
}
store.subscribe(render);
function warmCurrentVoice(){clearTimeout(voiceWarmTimer);if(speechEngine!=='builtin'||document.hidden||!clipSpeech.enabled)return;voiceWarmTimer=setTimeout(()=>{if(!document.hidden&&clipSpeech.enabled)clipSpeech.warm(['phrase:test',...planReading('place'),...planReading('value'),...planReading('date')]);},180);}
function resample(location = store.get().location, extra = {}) {
  const sample = source ? sampleDataset(source, location, store.get().radius, sampleNeighborhood, {variable:extra.variable??store.get().variable}) : null;
  const surface = geography?.mask.classify(location) ?? { surface: 'unknown', nearCoast: false };
  const state=store.update({ ...extra, location, sample, validity: sample?.validity ?? 'loading', surface: surface.surface, nearCoast: surface.nearCoast });
  warmCurrentVoice();return state;
}
function stopLegend() {
  clearTimeout(legendTimer); audio.cancelLegend(); legendPlaying = false; $('legend-status').textContent = '';
}
function select(location, immediate = false, mode = 'relocate') {
  if (legendPlaying) stopLegend();
  active = true;
  const previous=store.get().location;
  const continuous=mode==='keyboard'||(mode==='pointer'&&pointerInside);
  const crossings=surfaceTracker&&continuous?surfaceTracker.move(previous,location,{wrap:mode==='keyboard'}):[];
  if(!continuous)surfaceTracker?.reset(location);
  pointerInside = mode === 'pointer';
  if (mode === 'relocate') boundaryTracker.reset();
  const boundary = boundaryTracker.update(toView(geoToMercator(location.lon, location.lat), viewport), $('map').getBoundingClientRect());
  const preferences = store.get().audio;
  const parts = [];
  if (boundary && preferences.boundaryCues) parts.push(`${boundary.replace('-', ' ')} map boundary`);
  if(crossings.length&&preferences.coastCues)parts.push(`Entering ${crossings.at(-1).to}`);
  const cue = parts.join('. ');
  const state = resample(location, cue ? { lastCue: cue } : {});
  audio.navigationCue({ boundary, crossings }, preferences);
  announce(`${formatLocation(location)}. ${surfaceDescription(state)}. ${sampleDescription(state)}${cue ? ' ' + cue + '.' : ''}`, immediate);
}
function silence(message = 'All application audio is silent.') {
  stopNarration();
  $('voice-status').textContent='All audio is silent. Press 1, 2 or 3 for another reading.';
  active = false; starting = false; pointerInside = false; stopLegend(); audio.stop();
  boundaryTracker.reset(); surfaceTracker?.reset(store.get().location);
  store.update({ audio: { ...store.get().audio, enabled: false } });
  $('audio-status').textContent = message; announce(message, true);
}
audio.onInterrupted = () => silence('Audio was interrupted. Select Start audio to resume.');
$('map').addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (['ArrowUp', 'ArrowDown'].includes(event.key) || (event.shiftKey && ['ArrowLeft','ArrowRight'].includes(event.key))) {
    event.preventDefault(); select(moveLocation(store.get().location, event.key, store.get().spatialStep), false, 'keyboard');
  } else if (event.key === 'Home') {
    event.preventDefault(); select({ ...START_LOCATION }, true);
  }
});
$('map').addEventListener('focus', () => {
  stopLegend(); active = true; pointerInside = false; boundaryTracker.reset(); surfaceTracker?.reset(store.get().location); render(store.get());
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
$('map').addEventListener('contextmenu', event => {
  event.preventDefault();
  $('map').focus({preventScroll:true});
  const location=pointerLocation(event);
  if(location)select(location,true,'pointer');
  stopLegend();
  if(!source){announce('Wait for the selected dataset to finish loading before starting audio.',true);return;}
  if(!store.get().audio.enabled)startAudio();
  else {active=true;render(store.get());}
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
  boundaryTracker.reset();surfaceTracker?.reset(store.get().location);
}
$('map').addEventListener('pointerleave', leaveMap);
$('map').addEventListener('pointercancel', leaveMap);
$('dataset-center').addEventListener('click',()=>{const e=source?.manifest.geo?.extent;if(e)select({lon:(e[0]+e[2])/2,lat:Math.max(-MAX_LAT,Math.min(MAX_LAT,(e[1]+e[3])/2))},true);});
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
for (const [id, preference] of [['coast-cues', 'coastCues'], ['boundary-cues', 'boundaryCues']]) {
  $(id).addEventListener('change', event => {
    stopLegend(); audio.cancelTones('navigation'); audio.cancelTones('coast');
    store.update({ audio: { ...store.get().audio, [preference]: event.target.checked } });
  });
}
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
    active = true; pointerInside = false; boundaryTracker.reset(); surfaceTracker?.reset(store.get().location);
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
  geography = null; surfaceTracker=null; resample(store.get().location, { geographyStatus: 'loading' });
  try {
    geography = await loadGeography();
    surfaceTracker=new SurfaceTransitionTracker(geography.mask,store.get().location);
    resample(store.get().location, { geographyStatus: 'ready' });
    announce(`Surface geometry ready. ${surfaceDescription(store.get())}.`, true);
  } catch (error) {
    resample(store.get().location, { geographyStatus: 'unavailable' });
    $('retry-geography').hidden = false;
    announce('Surface geometry could not load. Data sonification and map-edge cues remain available.', true);
    console.error(error);
  } finally { $('retry-geography').disabled = false; }
}
async function initialize(id = pendingDataset, index = pendingIndex) {
  stopNarration();
  pendingDataset = id; pendingIndex = index; const ticket = selectionGate.next();
  active = false; stopLegend(); audio.cancelTones(); audio.fade(); source = null;
  store.update({sample:null,validity:'loading'});
  $('retry').hidden = true; $('map').setAttribute('aria-busy', 'true');
  $('load-message').hidden = false; $('load-message').textContent = 'Loading selected frame…';
  for (const b of document.querySelectorAll('[data-legend]')) b.disabled = true;
  try {
    const manifest = await getManifest(id);
    if (!selectionGate.current(ticket)) return;
    catalogs.set(id,manifest); syncTimeline();
    const candidate = await loadSource(id,index);
    if (!selectionGate.current(ticket)) return;
    source = candidate; $('frame').src = source.frame.display; $('frame').alt = DATASETS[id].alt;
    const definition=DATASETS[id],profile=featureProfile(source.manifest);
    $('source-link').hidden=!manifest.sourcePage;$('source-link').href=manifest.sourcePage||'#';$('credit-text').textContent=manifest.credit;
    $('manifest-link').hidden=!definition.manifest;if(definition.manifest)$('manifest-link').href=definition.manifest;
    $('original-frame-link').hidden=!source.frame.original;if(source.frame.original)$('original-frame-link').href=source.frame.original;
    $('asset-kind').textContent=`${profile.method==='grid'?'Numeric grid':'Rendered visualization'} · ${manifest.width} × ${manifest.height}`;
    $('provenance-note').textContent=manifest.provenanceNote??'Sampling uses the source geometry and metadata defined for this dataset.';
    $('provenance-link').hidden=!manifest.provenanceUrl;if(manifest.provenanceUrl)$('provenance-link').href=manifest.provenanceUrl;
    $('source-legend').hidden=!manifest.legend?.local;if(manifest.legend?.local){$('source-legend').src=manifest.legend.local;$('source-legend').alt=manifest.legend.meaning??'Source legend';}
    $('dataset-description').textContent=[manifest.title,manifest.representedInterval,manifest.limitations].filter(Boolean).join('. ');
    $('matching-description').textContent=profile.description??manifest.legend?.meaning??'Image brightness or selected color strength is a visual feature, not a physical concentration.';
    const rgb=profile.matching!=='chromatic'&&source.palette?.length?source.palette:null;
    $('palette-track').style.background=rgb?`linear-gradient(90deg,${rgb.map(c=>'rgb('+c.join(',')+')').join(',')})`:'linear-gradient(90deg,rgb(30,60,110),rgb(250,235,40))';
    $('scale-low').textContent=String(manifest.valueScale?.min??0);$('scale-high').textContent=String(manifest.valueScale?.max??1);
    const variables=profile.categories??[{id:'value',name:profile.name}];
    $('variable').replaceChildren();for(const variable of variables)$('variable').add(new Option(variable.name,variable.id));
    const variable=variableSettings.get(id)??variables[0].id;$('variable').value=variable;
    const mapping=mappingSettings.get(id)??recommendedMapping(manifest);mappingControls(mapping);
    $('mapping-status').textContent='Audio range stays fixed across the sequence. Adjust it below or restore automatic mapping.';
    $('mapping-amplitude').querySelector('[value="intensity"]').disabled=profile.method==='grid';
    $('load-message').hidden = true; $('map').setAttribute('aria-busy','false');
    active = store.get().audio.enabled; surfaceTracker?.reset(store.get().location);
    resample(store.get().location,{dataset:id,variable,timeIndex:index,timestamp:source.frame.timestamp,audio:{...store.get().audio,mapping}});
    for (const b of document.querySelectorAll('[data-legend]')) b.disabled = !audioSupported;
    announce(`${source.manifest.title} ready. ${sampleDescription(store.get())}`,true);
    if (!geography && store.get().geographyStatus !== 'loading') await initializeGeography();
  } catch(error) {
    if (!selectionGate.current(ticket)) return;
    source = null; store.update({validity:'load-error',sample:null});
    $('map').setAttribute('aria-busy','false'); $('load-message').hidden=false;
    $('load-message').textContent='Selected frame could not load. Retry, change time or choose another dataset.';
    $('retry').hidden=false; announce($('load-message').textContent,true); console.error(error);
  }
}
$('retry').addEventListener('click',()=>initialize());
$('dataset').addEventListener('change',event=>initialize(event.target.value,0));
for(const [id,location] of [['land-test',{lon:15,lat:23}],['water-test',{lon:-45,lat:30}]]) {
 $(id).addEventListener('click',()=>{
  select(location,true);
 });
}
$('city-test').addEventListener('click',()=>select({lon:2.35,lat:48.86},true));
$('retry-geography').addEventListener('click', initializeGeography);
function pointerLocation(event){
 const local = pointerToGeo(event.clientX,event.clientY,$('map').getBoundingClientRect());
 if(!local)return null;
 const position=fromView(geoToMercator(local.lon,local.lat),viewport);
 return mercatorToGeo(position.x,position.y);
}
function layoutMap(){
 const stage=$('map-stage');
 if(expanded){
  const fitted=fitMap(stage.clientWidth,stage.clientHeight);
  $('map').style.width=`${fitted.width}px`; $('map').style.height=`${fitted.height}px`;
 } else { $('map').style.width=''; $('map').style.height=''; }
 viewport=mapViewport();
 $('frame').style.objectPosition='50% 50%';
 boundaryTracker.reset();
}
const panel=$('map-panel'), placeholder=document.createComment('map panel position');panel.before(placeholder);
async function requestFullscreenForMap(){
 const result=await enterBrowserFullscreen(document,$('expanded-dialog'));
 if(!expanded){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});return;}
 $('expanded-status').textContent=result.message;
 syncFullscreenControls(); layoutMap();render(store.get());
}
function syncFullscreenControls(){
 const entered=document.fullscreenElement===$('expanded-dialog');
 $('browser-fullscreen').disabled=!entered&&!canUseBrowserFullscreen(document,$('expanded-dialog'));
 $('browser-fullscreen').textContent=entered?'Exit fullscreen':'Enter browser fullscreen';
}
$('expand-map').addEventListener('click',()=>{
 pointerInside=false; expanded=true; $('expanded-content').append(panel); $('expanded-dialog').showModal();
 document.body.classList.add('map-expanded');
 $('expanded-status').textContent='Expanded map view. Requesting browser fullscreen…';
 syncFullscreenControls();layoutMap();render(store.get());$('map').focus();
 // Request during the original click gesture; restrictions fall back to the expanded dialog.
 requestFullscreenForMap();
});
function closeExpanded(){
 if(!expanded)return;
 pointerInside=false;expanded=false;
 if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 placeholder.after(panel);$('expanded-dialog').close();
 document.body.classList.remove('map-expanded');layoutMap();render(store.get());$('expand-map').focus();
 silence('Expanded map closed. Audio paused.');
}
$('close-expanded').addEventListener('click',closeExpanded);
$('expanded-dialog').addEventListener('cancel',event=>{event.preventDefault();closeExpanded();});
$('expanded-audio').addEventListener('click',()=>$('start-audio').click());
$('expanded-silence').addEventListener('click',()=>silence());
$('browser-fullscreen').addEventListener('click',async()=>{
 if(document.fullscreenElement){try{await document.exitFullscreen();}catch{$('expanded-status').textContent='Could not exit browser fullscreen. Use the browser Escape key.';}}
 else requestFullscreenForMap();
});
document.addEventListener('fullscreenchange',()=>{
 syncFullscreenControls();
 if(!document.fullscreenElement&&expanded){closeExpanded();return;}
 layoutMap();render(store.get());
});
new ResizeObserver(()=>{layoutMap();render(store.get());}).observe($('map-stage'));
render(store.get()); initialize(); initializeGeography(); initializePlaces();
