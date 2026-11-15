// The tour observes successful application actions; it never simulates them.
export const TUTORIAL_STEPS = [
  {id:'explore',title:'Start and move',text:'Right-click the map or use Start audio. Move the pointer, or focus the map and use Up/Down and Shift+Left/Right. Try starting and moving. Press 9 for the full spoken guide.',target:'#map',alternate:'#start-audio',actions:['audio-started','location-moved'],already:context=>context.audioEnabled?['audio-started']:[]},
  {id:'read',title:'Try 1, 2 and 3',text:'With the map focused, press 1 for place, 2 for value and unit, and 3 for date. The Read buttons do the same. Try all three, then choose Next.',target:'#map',alternate:'[data-read="place"]',actions:['read-place','read-value','read-date']},
  {id:'finish',title:'Ready to explore',text:'Left/Right changes dates. Data selects datasets; Sound and speech adjusts sound. Escape silences everything. Press 9 anytime outside typing fields for the complete spoken explanation. Finish, then right-click to resume map audio.'}
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
    for(const action of step().already?.(context())??[])completed.add(action);
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
