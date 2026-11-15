// The tour stays on the real map; only explicit lesson controls change speech.
export const TUTORIAL_STEPS = [
  {id:'explore',title:'Start and move',text:'Right-click the map or use Start audio. Move the pointer, or use Up/Down and Shift+Left/Right. Alt+N goes next; Alt+R repeats. Press 9 for the full guide.',actions:['audio-started','location-moved']},
  {id:'read',title:'Try 1, 2 and 3',text:'Press 1 for place, 2 for value and unit, and 3 for date. The side buttons do the same. Try all three, then choose Next or press Alt+N.',actions:['read-place','read-value','read-date']},
  {id:'finish',title:'Ready to explore',text:'Left/Right changes dates. Map controls opens settings. Escape silences audio. Press 9 for the complete spoken guide. Finish keeps the map open for exploration.'}
];

export function setupGuidedTutorial({document,speak,stop,getContext,enterMap,enableSpeech,onStart=()=>{},onExit=()=>{}}){
  const byId=id=>document.getElementById(id),panel=byId('tutorial'),anchor=document.createComment('tutorial position');
  panel.before(anchor);byId('tutorial-progress-bar').max=TUTORIAL_STEPS.length;
  const listeners=[],completed=new Set();
  let active=false,index=0,voiceRequest=0;
  const listen=(node,type,handler)=>{node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));};
  const step=()=>TUTORIAL_STEPS[index];
  const ready=()=>!step().actions||step().actions.every(action=>completed.has(action));
  const focusMap=()=>byId('map').focus({preventScroll:true});
  function setDetails(open){
    byId('tutorial-details').hidden=!open;byId('tutorial-details-toggle').setAttribute('aria-expanded',String(open));
    if(open)byId('tutorial-options').open=false;
  }
  function update(){
    if(!active)return;
    byId('tutorial-next').disabled=!ready();byId('tutorial-back').disabled=index===0;
    byId('tutorial-next').textContent=index===TUTORIAL_STEPS.length-1?'Finish':'Next →';
    byId('tutorial-skip').hidden=!step().actions;
    byId('tutorial-reading-buttons').hidden=step().id!=='read';
    byId('tutorial-alternative').hidden=step().id!=='explore';
    byId('tutorial-enable-audio').hidden=getContext().speechEnabled&&getContext().speechVolume>0;
    byId('tutorial-feedback').textContent=ready()?'Ready for Next.':`${completed.size} of ${step().actions.length} actions completed. Skip is in More.`;
    byId('tutorial-progress').textContent=`${index+1} / ${TUTORIAL_STEPS.length}${ready()?' · ready':''}`;
  }
  async function narrate(){
    if(!active||!byId('tutorial-voice').checked)return;
    const request=++voiceRequest,c=getContext();
    if(!c.speechEnabled||!c.speechVolume){byId('tutorial-speech-status').textContent='Speech is muted. Choose Enable voice to hear instructions.';return;}
    byId('tutorial-speech-status').textContent='Preparing instructions…';
    const result=await speak(`Step ${index+1} of ${TUTORIAL_STEPS.length}. ${step().title}. ${step().text}`);
    if(request!==voiceRequest||!active)return;
    if(result===false)byId('tutorial-speech-status').textContent='Speech could not start. Repeat to retry, or open Instructions for text.';
  }
  function relocate(){
    if(!active)return;
    if(!getContext().expanded){exit();return;}
    byId('expanded-root').append(panel);update();
  }
  function render(){
    voiceRequest++;stop();completed.clear();
    if(step().id==='explore'&&getContext().audioEnabled)completed.add('audio-started');
    byId('tutorial-progress-bar').value=index+1;
    byId('tutorial-title').textContent=step().title;byId('tutorial-instructions').textContent=step().text;
    byId('tutorial-options').open=false;setDetails(false);relocate();focusMap();narrate();
  }
  function start(){
    if(active){focusMap();narrate();return;}
    active=true;index=0;panel.hidden=false;document.body.classList.add('tutorial-active');onStart();
    // Synchronous: fullscreen must be requested inside the original user gesture.
    enterMap();render();
  }
  function exit(){
    if(!active)return;
    active=false;voiceRequest++;stop();panel.hidden=true;anchor.after(panel);document.body.classList.remove('tutorial-active');
    setDetails(false);byId('tutorial-options').open=false;focusMap();onExit();
  }
  function next(skip=false){if(!active)return;if(!skip&&!ready()){focusMap();narrate();return;}if(index===TUTORIAL_STEPS.length-1){exit();return;}index++;render();}
  function notify(action){if(active&&step().actions?.includes(action)&&!completed.has(action)){completed.add(action);update();}}
  function pause(){if(active){voiceRequest++;stop();byId('tutorial-speech-status').textContent='Speech paused. Repeat resumes instructions.';}}
  for(const button of document.querySelectorAll('[data-start-tutorial]'))listen(button,'click',start);
  listen(byId('tutorial-next'),'click',()=>next());listen(byId('tutorial-skip'),'click',()=>next(true));
  listen(byId('tutorial-back'),'click',()=>{if(index>0){index--;render();}});
  listen(byId('tutorial-repeat'),'click',()=>{focusMap();narrate();});listen(byId('tutorial-exit'),'click',exit);
  listen(byId('tutorial-practice'),'click',focusMap);
  listen(byId('tutorial-alternative'),'click',()=>{if(!getContext().audioEnabled)byId('expanded-audio').click();focusMap();});
  listen(byId('tutorial-details-toggle'),'click',()=>{setDetails(byId('tutorial-details').hidden);focusMap();});
  listen(byId('tutorial-options'),'toggle',()=>{if(byId('tutorial-options').open)setDetails(false);});
  listen(byId('tutorial-voice'),'change',event=>{event.stopPropagation();if(byId('tutorial-voice').checked){focusMap();narrate();}else{voiceRequest++;stop();byId('tutorial-speech-status').textContent='Tutorial narration off.';}});
  listen(byId('tutorial-enable-audio'),'click',()=>{enableSpeech();byId('tutorial-voice').checked=true;update();focusMap();narrate();});
  listen(document,'keydown',event=>{
    if(event.defaultPrevented||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.repeat)return;
    const key=event.key.toLowerCase();
    if(key==='t'){event.preventDefault();if(active)exit();else start();return;}
    if(!active||!['n','p','r'].includes(key))return;
    event.preventDefault();if(key==='n')next();else if(key==='p'){if(index>0){index--;render();}}else{focusMap();narrate();}
  });
  return {start,exit,notify,relocate,pause,interrupt(){voiceRequest++;},get active(){return active;},get stepId(){return active?step().id:null;},status(message){if(active)byId('tutorial-speech-status').textContent=message;},destroy(){exit();for(const remove of listeners)remove();}};
}
