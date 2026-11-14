import './styles.css';
import { formatLocation, geoToMercator, geoToSource, moveLocation, pointerToGeo, MAX_LAT } from './coordinates.js';
import { createStore, START_LOCATION } from './state.js';
import { loadSource } from './sources.js';
const $ = id => document.getElementById(id);
const store = createStore();
let source = null;
let spatialTimer;
function announce(text, immediate = false) {
  clearTimeout(spatialTimer);
  spatialTimer = setTimeout(() => { $('status').textContent = text; }, immediate ? 0 : 450);
}
function render(state) {
  const point = geoToMercator(state.location.lon, state.location.lat);
  $('cursor').style.left = `${point.x * 100}%`;
  $('cursor').style.top = `${point.y * 100}%`;
  $('location').textContent = formatLocation(state.location);
  $('latitude').value = state.location.lat.toFixed(2);
  $('longitude').value = state.location.lon.toFixed(2);
  const pixel = source ? geoToSource(state.location.lon, state.location.lat, source.manifest.width, source.manifest.height) : null;
  $('pixel').textContent = pixel ? `Source pixel ${pixel.x}, ${pixel.y}` : 'Loading source pixels…';
}
store.subscribe(render);
function select(location, immediate = false) {
  store.update({ location });
  announce(`${formatLocation(location)}.`, immediate);
}
$('map').addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.key.startsWith('Arrow')) {
    event.preventDefault(); select(moveLocation(store.get().location, event.key, store.get().spatialStep));
  } else if (event.key === 'Home') {
    event.preventDefault(); select({ ...START_LOCATION }, true);
  }
});
$('map').addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' && event.buttons === 0) return;
  const location = pointerToGeo(event.clientX, event.clientY, $('map').getBoundingClientRect());
  if (location) select(location);
});
$('map').addEventListener('pointerdown', event => {
  $('map').focus({ preventScroll: true });
  const location = pointerToGeo(event.clientX, event.clientY, $('map').getBoundingClientRect());
  if (location) select(location, true);
});
$('reset').addEventListener('click', () => select({ ...START_LOCATION }, true));
$('step').addEventListener('change', event => store.update({ spatialStep: Number(event.target.value) }));
for (const button of document.querySelectorAll('[data-direction]')) button.addEventListener('click', () => select(moveLocation(store.get().location, button.dataset.direction, store.get().spatialStep), true));
$('coordinate-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('coordinate-form').reportValidity()) return;
  select({ lat: Number($('latitude').value), lon: Number($('longitude').value) }, true);
});
$('latitude').min = -MAX_LAT; $('latitude').max = MAX_LAT;
async function initialize() {
  $('retry').hidden = true; $('map').setAttribute('aria-busy', 'true');
  $('load-message').textContent = 'Loading NASA frame…';
  try {
    source = await loadSource();
    const display = $('frame'); display.src = source.manifest.frames[0].display;
    await display.decode();
    $('load-message').hidden = true;
    store.update({ validity: 'ready' });
    $('map').setAttribute('aria-busy', 'false');
    announce('NASA frame ready. Focus the map and use arrow keys to explore.', true);
  } catch (error) {
    source = null; store.update({ validity: 'load-error' });
    $('map').setAttribute('aria-busy', 'false'); $('load-message').hidden = false;
    $('load-message').textContent = 'The NASA frame could not load. Try again.';
    $('retry').hidden = false; announce($('load-message').textContent, true);
    console.error(error);
  }
}
$('retry').addEventListener('click', initialize);
render(store.get()); initialize();
