// Fresh stable-based narration; intentionally independent of the test TTS branch.
export function locationText({lat,lon}){
 return `${Math.abs(lat).toFixed(2)} degrees ${lat<0?'south':'north'}, ${Math.abs(lon).toFixed(2)} degrees ${lon<0?'west':'east'}`;
}
export function describeCurrent(state){
 if(!state.sample)return 'The selected dataset is not ready yet.';
 const when=new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeStyle:'short',timeZone:'UTC'}).format(new Date(state.timestamp));
 const position=locationText(state.location);
 const prefix=`${when} UTC. At ${position}. `;
 if(state.sample.value==null)return prefix+'No interpretable visual sample is available here.';
 return prefix+`The temperature color is ${Math.round(state.sample.value*100)} out of one hundred. ${state.dataset==='svs-3912'?'Visual trace coverage':'Matched color coverage'} is ${Math.round(state.sample.density*100)} percent. These are image estimates, not measured temperatures.`;
}
export function describeDataset(manifest){return `${manifest.title}. A NASA visualization explored through sound. Higher color position makes a higher note. Coverage controls loudness. A short knock marks entering land, and a droplet marks entering water. Geographic boundaries are approximate.`;}

export function describeValue(state){
 if(!state.sample)return 'The selected dataset is not ready yet.';
 if(state.sample.value==null)return 'No interpretable visual sample is available here.';
 return `Temperature color position ${Math.round(state.sample.value*100)} out of one hundred. `+
  `${state.dataset==='svs-3912'?'Visual trace coverage':'Matched color coverage'} is ${Math.round(state.sample.density*100)} percent. `+
  'This is an image estimate, not a measured temperature.';
}
export function describeMap(manifest){
 return `${manifest.title}. ${manifest.representedInterval ?? ''} ${describeDataset(manifest).replace(manifest.title+'. ','')}`;
}