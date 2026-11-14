export function locationText({lat,lon}) {
  return `${Math.abs(lat).toFixed(2)} degrees ${lat<0?'south':'north'}, ${Math.abs(lon).toFixed(2)} degrees ${lon<0?'west':'east'}`;
}
export function placeText(place,location,status='ready') {
  if(place)return place.name+'.';
  if(status==='loading')return 'Place names are still loading.';
  if(status==='error')return 'Place names are unavailable. '+locationText(location)+'.';
  return 'No country, ocean or sea name is mapped here. '+locationText(location)+'.';
}
export function temperatureEstimate(sample,manifest) {
  const scale=manifest?.valueScale;
  if(sample?.value==null||!Number.isFinite(sample.value)||!scale)return null;
  const fraction=Math.max(0,Math.min(1,sample.value));
  return Math.round(scale.min+fraction*(scale.max-scale.min));
}
export function valueText(state,manifest) {
  if(!state.sample)return 'The selected frame is still loading. No value is available yet.';
  const value=temperatureEstimate(state.sample,manifest);
  if(value===null)return 'No interpretable temperature value is available at this location.';
  return `Approximately ${Object.is(value,-0)?0:value} degrees Celsius. An estimate from image color.`;
}
export function dateText(timestamp) {
  if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return 'The selected frame is still loading. No date is available yet.';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(timestamp))+' UTC.';
}
