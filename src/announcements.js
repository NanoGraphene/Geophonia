// Coordinate wording adapted from origin/text_to_speech (2cac0ce).
export function spokenLocation({lat,lon}){
 return `Latitude ${Math.abs(lat).toFixed(2)} degrees ${lat<0?'south':'north'}. Longitude ${Math.abs(lon).toFixed(2)} degrees ${lon<0?'west':'east'}.`;
}
export function currentDataText(state){
 const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeStyle:'short',timeZone:'UTC'}).format(new Date(state.timestamp));
 const value=state.sample?.value;
 return `${date} UTC. ${spokenLocation(state.location)} ${state.variable==='temperature-color'?'Ocean temperature-color position':'Near-surface temperature-color position'}. `+
  (value==null?'No data at this location and time: no interpretable visual sample; this is not a verified scientific missing flag.':`Image-derived palette position ${Math.round(value*100)} out of 100. ${state.dataset==='svs-3912'?'Visual trace coverage':'Matched color coverage'} ${Math.round(state.sample.density*100)} percent. These are visual estimates, not measured degrees Celsius.`);
}
