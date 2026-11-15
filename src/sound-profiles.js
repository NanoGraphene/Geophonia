// Designed auditory metaphors. Value is always pitch; the variable selects timbre.
// Manifests may supply sonification.profile (or categoryProfiles) for new sources.
export const SOUND_PROFILES = {
  harmonic:{name:'Warp engine · balanced',description:'Soft, broad harmonic engine hum for an unspecified variable.',partials:[0,1,.22,.1,.05,.02]},
  temperature:{name:'Temperature · warm warp drive',description:'Warm rounded engine harmonics; higher temperature raises pitch and beating speed.',partials:[0,1,.32,.12,.05,.02]},
  ozone:{name:'Ozone · glass harmonics',description:'Soft glass-like overtones over a rounded warp-engine hum.',partials:[0,1,.04,.27,.02,.1]},
  particles:{name:'Fine particles · dry reed',description:'Textured engine hum with subdued reed-like harmonics.',partials:[0,1,.12,.3,.12,.12,.05,.03]},
  dust:{name:'Dust · grainy reed',description:'Soft grainy harmonic texture for dust.',partials:[0,1,.22,.35,.06,.18,.03,.08]},
  smoke:{name:'Smoke · soft organ',description:'Soft, hollow organ-like harmonics for smoke.',partials:[0,1,.03,.16,.01,.05,.005,.02]},
  'sea-salt':{name:'Sea salt · rounded shimmer',description:'Rounded, shimmering harmonics for sea-salt particles.',partials:[0,1,.38,.04,.12,.01,.04]},
  sulfates:{name:'Sulfates · airy flute',description:'Light flute-like tone for sulfate particles.',partials:[0,1,.1,.04,.015,.005]},
  'carbon-monoxide':{name:'Carbon monoxide · hollow woodwind',description:'Hollow woodwind-like tone, distinct from ozone and fine particles.',partials:[0,1,.01,.24,.005,.08,.005,.03]},
  'nitrogen-oxides':{name:'Nitrogen oxides · bright brass',description:'Rounded brass-like harmonics for nitrogen oxides.',partials:[0,1,.38,.2,.13,.09,.05]},
  nightlights:{name:'Night lights · crystalline organ',description:'Clear, luminous organ-like harmonics for night-light brightness.',partials:[0,1,.09,.04,.25,.01,.11]},
  lightning:{name:'Lightning · electric harmonics',description:'Soft electric harmonic texture for lightning-mark strength.',partials:[0,1,.23,.3,.05,.15,.02,.09]}
};

export function resolveSoundProfile(manifest,variable,override='auto'){
  if(SOUND_PROFILES[override])return override;
  const declared=manifest?.sonification?.categoryProfiles?.[variable]??manifest?.sonification?.profile;
  if(SOUND_PROFILES[declared])return declared;
  const category=manifest?.feature?.categories?.find(item=>item.id===variable);
  if(category&&SOUND_PROFILES[category.id])return category.id;
  const name=[manifest?.title,manifest?.feature?.name,manifest?.valueScale?.unit].filter(Boolean).join(' ').toLowerCase();
  for(const [pattern,profile] of [[/temperature|celsius|fahrenheit|kelvin|°[cf]/,'temperature'],[/ozone|\bo3\b/,'ozone'],[/pm2|pm10|particulate|aerosol/,'particles'],[/carbon monoxide|\bco\b/,'carbon-monoxide'],[/nitrogen oxide|\bnox\b/,'nitrogen-oxides'],[/night.?light|black marble/,'nightlights'],[/lightning/,'lightning']])if(pattern.test(name))return profile;
  return 'harmonic';
}
