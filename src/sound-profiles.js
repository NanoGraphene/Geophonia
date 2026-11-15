// Designed auditory metaphors. Value is always pitch; the variable selects timbre.
// Manifests may supply sonification.profile (or categoryProfiles) for new sources.
export const SOUND_PROFILES = {
  harmonic:{name:'Harmonic ensemble',description:'Balanced harmonic tone for an unspecified variable.',partials:[0,1,.32,.18,.1,.05]},
  temperature:{name:'Temperature · warm strings',description:'Rounded string-like harmonics; higher temperature means higher pitch.',partials:[0,1,.55,.25,.12,.05]},
  ozone:{name:'Ozone · glass harmonics',description:'Clear glass-like tone with a bright third and fifth harmonic.',partials:[0,1,.08,.55,.04,.24]},
  particles:{name:'Fine particles · dry reed',description:'Dry reed-like tone with a dense mix of upper harmonics.',partials:[0,1,.18,.65,.28,.34,.13,.1]},
  dust:{name:'Dust · grainy reed',description:'Grainy, nasal harmonic texture for dust.',partials:[0,1,.36,.72,.15,.42,.08,.2]},
  smoke:{name:'Smoke · soft organ',description:'Soft, hollow organ-like harmonics for smoke.',partials:[0,1,.05,.32,.02,.12,.01,.04]},
  'sea-salt':{name:'Sea salt · rounded shimmer',description:'Rounded, shimmering harmonics for sea-salt particles.',partials:[0,1,.65,.08,.26,.03,.1]},
  sulfates:{name:'Sulfates · airy flute',description:'Light flute-like tone for sulfate particles.',partials:[0,1,.16,.07,.02,.01]},
  'carbon-monoxide':{name:'Carbon monoxide · hollow woodwind',description:'Hollow woodwind-like tone, distinct from ozone and fine particles.',partials:[0,1,.02,.48,.01,.2,.01,.08]},
  'nitrogen-oxides':{name:'Nitrogen oxides · bright brass',description:'Bright brass-like harmonics for nitrogen oxides.',partials:[0,1,.7,.44,.31,.22,.15]},
  nightlights:{name:'Night lights · crystalline organ',description:'Clear, luminous organ-like harmonics for night-light brightness.',partials:[0,1,.15,.08,.48,.02,.23]},
  lightning:{name:'Lightning · electric harmonics',description:'Sharp, bright harmonic texture for lightning-mark strength.',partials:[0,1,.45,.68,.12,.36,.05,.22]}
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
