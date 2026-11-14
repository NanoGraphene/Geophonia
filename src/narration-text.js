import { valueFromPosition, featureProfile } from './data-profiles.js';
export function locationText({lat,lon}) {
  return `${Math.abs(lat).toFixed(2)} degrees ${lat<0?'south':'north'}, ${Math.abs(lon).toFixed(2)} degrees ${lon<0?'west':'east'}`;
}
export function placeText(place,location,status='ready') {
  if(place)return place.name+'.';
  if(status==='loading')return 'Place names are still loading.';
  if(status==='error')return 'Place names are unavailable. '+locationText(location)+'.';
  return 'No country, ocean or sea name is mapped here. '+locationText(location)+'.';
}
export function measurementValue(sample,manifest) {
  if(sample?.value==null||!Number.isFinite(sample.value))return null;
  if(Number.isFinite(sample.measurement))return sample.measurement;
  return valueFromPosition(sample.value,manifest?.valueScale);
}
// Retained for the original temperature regressions; UI uses the generic formatter.
export function temperatureEstimate(sample,manifest) {
  const value=measurementValue(sample,manifest);return value===null?null:Math.round(value);
}
export function formattedValue(sample,manifest) {
  const value=measurementValue(sample,manifest);if(value===null)return '—';
  const scale=manifest.valueScale??{};
  const number=scale.significantDigits?new Intl.NumberFormat('en-GB',{maximumSignificantDigits:scale.significantDigits}).format(value):new Intl.NumberFormat('en-GB',{maximumFractionDigits:scale.decimals??0}).format(value);
  return `${featureProfile(manifest).estimate===false?'':'≈ '}${number} ${scale.symbol??scale.unit??''}`.trim();
}
export function valueText(state,manifest) {
  if(!state.sample)return 'The selected frame is still loading. No value is available yet.';
  const value=measurementValue(state.sample,manifest);
  if(value===null)return state.sample.validity==='outside-coverage'?'This location is outside the dataset coverage.':'No interpretable value is available at this location.';
  const scale=manifest.valueScale??{},profile=featureProfile(manifest);
  const number=scale.significantDigits?new Intl.NumberFormat('en-GB',{maximumSignificantDigits:scale.significantDigits}).format(value):new Intl.NumberFormat('en-GB',{maximumFractionDigits:scale.decimals??0}).format(value);
  const unit=scale.unit??profile.unit??'units unspecified';
  const category=profile.categories?.find(c=>c.id===state.variable);
  const prefix=category?category.name+': ':'';
  return profile.estimate===false?`${profile.name}: ${number} ${unit}. User-supplied grid value.`:`${prefix}Approximately ${number} ${unit}. An estimate from image color.`;
}
export function dateText(timestamp) {
  if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return 'The selected frame is still loading. No date is available yet.';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(timestamp))+' UTC.';
}
