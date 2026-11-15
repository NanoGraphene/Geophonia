// The tour observes successful application actions; it never simulates them.
export const TUTORIAL_STEPS = [
  {id:'welcome',title:'Explore Earth with sound',text:'This tour explains the map, spoken readings, dates, datasets and sound controls. Each practice step waits for your action. Choose Next after completing it, or Skip to move on. Tab moves between controls; Enter or Space activates them. Alt+N goes next, Alt+P goes back, and Alt+R repeats these instructions. Escape silences all audio without leaving the tour.'},
  {id:'audio',title:'Start the map audio',text:'Right-click anywhere on the map to start the continuous data sound. Keyboard and touch users can activate Start audio instead. Use headphones for spatial sound. If the frame is still loading, wait for it before trying again.',target:'#map',alternate:'#start-audio',actions:['audio-started'],already:context=>context.audioEnabled},
  {id:'move',title:'Move the listening point',text:'Move your pointer across the map, or focus it and press Up or Down to move north or south. Shift+Left and Shift+Right move west and east. Sound position follows the listening point. Higher values raise a soft warp-engine pitch from two hundred to two thousand hertz by default, and make its beating faster. Density controls loudness. The harmonic character identifies the dataset; missing data is not treated as zero. Try moving now.',target:'#map',actions:['location-moved']},
  {id:'place',title:'1 · Read the place',text:'Focus the map and press the number 1, or activate the Read place button. Phonon says the country, ocean or sea at the listening point. After hearing the answer, choose Next or press Alt+N.',target:'#map',alternate:'[data-read="place"]',actions:['read-place']},
  {id:'value',title:'2 · Read the value',text:'With the map focused, press the number 2, or activate Read value. Listen for the value and unit. Image-derived estimates are identified separately from calibrated measurements, and a missing sample is reported explicitly. After hearing the answer, choose Next.',target:'#map',alternate:'[data-read="value"]',actions:['read-value']},
  {id:'date',title:'3 · Read the date',text:'With the map focused, press the number 3, or activate Read date. This reads the selected data date, not today’s date. A new reading replaces the previous reading. Try it, listen, then choose Next.',target:'#map',alternate:'[data-read="date"]',actions:['read-date']},
  {id:'time',title:'Travel through time',text:'Focus the map and press Left or Right to select another date. You can also use the time slider or Previous and Next date buttons below the map. Wait for the selected frame to finish loading, then choose Next. Shift+Left and Shift+Right still move in space.',target:'#timeline',alternate:'#map',actions:['time-changed'],unavailable:context=>context.frameCount<2?'This dataset has no time sequence available. Choose Next, or revisit this lesson with a dataset that has several dates.':''},
  {id:'tabs',title:'Find the dataset controls',text:'The controls use four tabs: Navigate, Data, Sound and speech, and Help. Tab to a tab name, use Left or Right to choose another name, then Enter or Space to open it. Open the Data tab now. Show controls restores the tabs if they are hidden.',target:'#tab-data',actions:['tab-data'],already:context=>context.activeTab==='data'},
  {id:'dataset',title:'Choose a different dataset',text:'Change the Dataset selection in the Data tab and wait for its map to load. Variable selects what is measured when several channels are available. Scales and units follow the dataset. Source details explain scientific limits. Add your own 2D grid accepts a local latitude, longitude and value CSV, with optional dates and units.',tab:'data',target:'#dataset',actions:['dataset-changed']},
  {id:'navigate',title:'Jump to a location',text:'The Navigate tab has coordinate entry, compass buttons, spatial step size and test locations. Try the Atlantic test point, a compass button, or enter coordinates and activate Move listening point. Return to start, or Home while on the map, resets your location.',tab:'navigate',target:'#water-test',actions:['location-moved']},
  {id:'sound',title:'Adjust the sound',text:'Sound and speech has separate map and speech volumes. Shoreline and boundary cues can be toggled separately. Advanced mapping changes the data range and curve. Loudness always follows data density. Restore automatic mapping uses one range across the dataset’s sequence. Pitch range adjusts the frequency limits up to two thousand hertz. Nearby tones create beating from a slow swell at low values to a faster flutter at high values. Sound character automatically chooses a harmonic profile for temperature, gases or particle types, and can be overridden. Hear low, middle and high values previews the selected sound. Inspect these controls, then choose Next.',tab:'sound',target:'#volume'},
  {id:'automatic',title:'Choose when the app speaks',text:'Toggle Automatic speech once. It controls automatic focus and control announcements. The 1, 2 and 3 readings stay available when automatic speech is off. This guided tour has its own Speak tutorial checkbox. Phonon speech and Speech volume remain the overall voice controls.',target:'[data-auto-announcements]',actions:['automatic-toggled']},
  {id:'coast',title:'Recognize land and water',text:'Help contains sound examples you can replay. Activate Entering land and Entering water to hear both short transition cues. During exploration they sound only when crossing a shoreline; they do not continuously change the map tone. Listen to both, then choose Next.',tab:'help',targets:['[data-legend="coast-land"]','[data-legend="coast-water"]'],actions:['legend-coast-land','legend-coast-water']},
  {id:'edge',title:'Recognize map boundaries',text:'Play the Right map edge example. Edge and corner sounds tell you where the map ends, with spatial placement. The other examples in Help let you compare directions, increasing mapped value, warp beating, density loudness and missing data. Listen to this example, then choose Next.',tab:'help',target:'[data-legend="edge-right"]',actions:['legend-edge-right']},
  {id:'expand',title:'Use the expanded map',text:'Activate Expand map. The world fills the available view; the bottom transparent display shows place, value and time. Map controls opens the floating menu. Browser fullscreen may need permission; expanded view still works without it. The tutorial stays available. Choose Next to return to the standard view.',target:context=>context.expanded?'#close-expanded':'#expand-map',actions:['map-expanded']},
  {id:'silence',title:'Silence everything',text:'Press Escape or activate Silence all audio now. This stops the data sound, examples and speech. The tour stays open and quiet. Choose Repeat instructions to hear this step again, or Next to finish. You can restart map audio and request new readings afterward.',standardView:true,target:'#silence',actions:['silenced']},
  {id:'finish',title:'Ready to explore',text:'You have reached the end of the tour. Right-click starts map audio. The number keys 1, 2 and 3 read place, value and date. Left and Right change dates; Shift+Left and Shift+Right move west and east. Help contains keyboard references and sound examples. Finish closes the tour; Guided tutorial starts it again whenever you need it.'}
];

export function setupGuidedTutorial({document,speak,stop,getContext,showTab,standardView,enableSpeech,onStart=()=>{},onExit=()=>{}}){
  const byId=id=>document.getElementById(id),panel=byId('tutorial'),anchor=document.createComment('tutorial position');
  panel.before(anchor);byId('tutorial-progress-bar').max=TUTORIAL_STEPS.length;
  const listeners=[],completed=new Set();
  let active=false,index=0,baseline=null,highlighted=[],returnFocus=null,voiceRequest=0;
  const listen=(node,type,handler)=>{node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));};
  const step=()=>TUTORIAL_STEPS[index];
  const context=()=>getContext();
  const unavailable=()=>step().unavailable?.(context())||'';
  const ready=()=>!step().actions||!!unavailable()||step().actions.every(action=>completed.has(action));
  function targets(){const current=step(),c=context();return (current.targets??[typeof current.target==='function'?current.target(c):current.target]).filter(Boolean).map(selector=>document.querySelector(selector)).filter(Boolean);}
  function clearHighlights(){for(const element of highlighted)element.classList.remove('tutorial-target');highlighted=[];}
  function reveal(element){
    if(!element)return;
    const tab=element.closest('[role="tabpanel"]');if(tab)showTab(tab.id.replace('panel-',''));
    if(element.matches('[role="tab"]'))showTab(null);
    for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  }
  function highlight(){clearHighlights();for(const target of targets()){reveal(target);target.classList.add('tutorial-target');highlighted.push(target);}}
  function update(){
    if(!active)return;
    const current=step(),c=context();
    byId('tutorial-next').disabled=!ready();byId('tutorial-back').disabled=index===0;
    byId('tutorial-next').textContent=index===TUTORIAL_STEPS.length-1?'Finish tutorial':'Next step';
    byId('tutorial-skip').hidden=index===TUTORIAL_STEPS.length-1||!current.actions;
    byId('tutorial-practice').hidden=!targets().length;
    byId('tutorial-alternative').hidden=!current.alternate;
    byId('tutorial-enable-audio').hidden=c.speechEnabled&&c.speechVolume>0;
    byId('tutorial-feedback').textContent=unavailable()||(ready()?(current.actions?'Action complete. Choose Next step when you are ready.':'Choose Next step when you are ready.'):`Try the highlighted control. ${completed.size?`${completed.size} of ${current.actions.length} actions completed. `:''}Next unlocks when the action succeeds; Skip is always available.`);
  }
  async function narrate(){
    if(!active||!byId('tutorial-voice').checked)return;
    const request=++voiceRequest,c=context();
    if(!c.speechEnabled||!c.speechVolume){byId('tutorial-speech-status').textContent='Speech is disabled or muted. Choose Enable tutorial audio to hear instructions.';return;}
    byId('tutorial-speech-status').textContent='Preparing spoken instructions…';
    const result=await speak(`Step ${index+1} of ${TUTORIAL_STEPS.length}. ${step().title}. ${step().text} ${unavailable()}`);
    if(request!==voiceRequest||!active)return;
    if(result===false)byId('tutorial-speech-status').textContent='Speech could not start. Check Sound & speech, or use the written instructions and Skip.';
  }
  function relocate(){
    if(!active)return;
    if(context().expanded)byId('expanded-dialog').append(panel);else anchor.after(panel);
    highlight();update();
  }
  function render(){
    voiceRequest++;stop();completed.clear();baseline={...context()};
    if(step().standardView)standardView();
    if(step().tab)showTab(step().tab);
    if(step().already?.(context()))for(const action of step().actions??[])completed.add(action);
    byId('tutorial-progress').textContent=`Step ${index+1} of ${TUTORIAL_STEPS.length}`;
    byId('tutorial-progress-bar').value=index+1;
    byId('tutorial-title').textContent=step().title;byId('tutorial-instructions').textContent=step().text;
    relocate();
    byId('tutorial-title').focus({preventScroll:true});
    panel.scrollIntoView?.({block:'nearest',behavior:'instant'});
    narrate();
  }
  function start(){
    if(active){byId('tutorial-title').focus();narrate();return;}
    returnFocus=document.activeElement;standardView();active=true;index=0;panel.hidden=false;document.body.classList.add('tutorial-active');onStart();
    render();
  }
  function exit(){
    if(!active)return;
    active=false;voiceRequest++;stop();clearHighlights();panel.hidden=true;anchor.after(panel);document.body.classList.remove('tutorial-active');
    if(context().expanded)byId('map').focus({preventScroll:true});else (returnFocus?.isConnected?returnFocus:document.querySelector('[data-start-tutorial]'))?.focus({preventScroll:true});
    onExit();
  }
  function next(skip=false){if(!active)return;if(!skip&&!ready()){narrate();return;}if(index===TUTORIAL_STEPS.length-1){exit();return;}index++;render();}
  function notify(action,detail={}){
    if(!active)return;
    if(action==='frame-ready'){
      if(detail.dataset!==baseline.dataset)action='dataset-changed';
      else if(detail.index!==baseline.timeIndex)action='time-changed';
    }
    if(!step().actions?.includes(action)||completed.has(action))return;
    completed.add(action);update();
  }
  function pause(){
    if(!active)return;
    voiceRequest++;stop();byId('tutorial-speech-status').textContent='Audio silenced. Repeat instructions resumes tutorial speech.';
  }
  function practice(alternate=false){
    const current=step(),target=alternate?document.querySelector(current.alternate):targets()[Math.min(completed.size,targets().length-1)];
    if(!target)return;if(context().expanded&&!byId('expanded-dialog').contains(target))standardView();reveal(target);target.scrollIntoView?.({block:'center',behavior:'instant'});target.focus({preventScroll:true});
  }
  for(const button of document.querySelectorAll('[data-start-tutorial]'))listen(button,'click',start);
  listen(byId('tutorial-next'),'click',()=>next());listen(byId('tutorial-skip'),'click',()=>next(true));
  listen(byId('tutorial-back'),'click',()=>{if(index>0){index--;render();}});
  listen(byId('tutorial-repeat'),'click',narrate);listen(byId('tutorial-exit'),'click',exit);
  listen(byId('tutorial-practice'),'click',()=>practice());listen(byId('tutorial-alternative'),'click',()=>practice(true));
  listen(byId('tutorial-voice'),'change',event=>{event.stopPropagation();if(byId('tutorial-voice').checked)narrate();else{voiceRequest++;stop();byId('tutorial-speech-status').textContent='Tutorial narration off. Written instructions remain available.';}});
  listen(byId('tutorial-enable-audio'),'click',()=>{enableSpeech();byId('tutorial-voice').checked=true;update();narrate();});
  listen(document,'workspacechange',event=>notify(`tab-${event.detail.tab}`));
  listen(document,'keydown',event=>{
    if(event.defaultPrevented||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.repeat)return;
    const key=event.key.toLowerCase();
    if(key==='t'){event.preventDefault();if(active)exit();else start();return;}
    if(!active||!['n','p','r'].includes(key))return;
    event.preventDefault();if(key==='n')next();else if(key==='p'){if(index>0){index--;render();}}else narrate();
  });
  return {start,exit,notify,relocate,pause,interrupt(){voiceRequest++;},get active(){return active;},get stepId(){return active?step().id:null;},status(message){if(active)byId('tutorial-speech-status').textContent=message;},destroy(){exit();for(const remove of listeners)remove();}};
}
