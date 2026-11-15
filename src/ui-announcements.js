// Built-in spoken navigation. This uses the same live Phonon engine as readings;
// there is no phrase bank, hover narration, or system screen-reader dependency.
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const controls='button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="tab"], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="slider"], [role="textbox"], [role="application"], [role="dialog"], [tabindex]';

function textOf(element){
 if(!element)return '';
 const copy=element.cloneNode(true);
 for(const node of copy.querySelectorAll('[aria-hidden="true"], input,select,textarea,button,output,audio,video'))node.remove();
 return clean(copy.textContent);
}
function available(element){
 if(!element?.isConnected||element.closest('[hidden],[inert],[aria-hidden="true"],audio,video'))return false;
 for(let node=element;node?.nodeType===1;node=node.parentElement){
  if(node.tagName==='DIALOG'&&!node.open)return false;
  if(node.tagName==='DETAILS'&&!node.open&&element!==node.querySelector('summary')&&!node.querySelector('summary')?.contains(element))return false;
  const style=node.ownerDocument.defaultView?.getComputedStyle(node);
  if(style?.display==='none'||style?.visibility==='hidden')return false;
 }
 return true;
}
function controlFor(element){
 const control=element?.closest?.(controls);
 return control&&available(control)?control:null;
}
function nameOf(element){
 const document=element.ownerDocument;
 const labelled=clean(element.getAttribute('aria-labelledby')).split(' ').filter(Boolean).map(id=>textOf(document.getElementById(id))).filter(Boolean).join(' ');
 if(labelled)return labelled;
 if(clean(element.getAttribute('aria-label')))return clean(element.getAttribute('aria-label'));
 if(element.labels?.length){const labels=[...element.labels].map(textOf).filter(Boolean).join(' ');if(labels)return labels;}
 if(element.tagName==='SUMMARY'||element.tagName==='BUTTON'||element.tagName==='A'||['button','tab'].includes(element.getAttribute('role')))return textOf(element);
 return clean(element.getAttribute('title')||element.getAttribute('placeholder')||element.getAttribute('name'));
}
function boundedValue(value){const text=clean(value);return text.length>120?`Contains ${text.length} characters`:text;}
function stateValue(element){
 const supplied=clean(element.getAttribute('aria-valuetext'));if(supplied)return supplied;
 if(element.id){const output=[...element.ownerDocument.querySelectorAll('output[for]')].find(node=>node.getAttribute('for').split(/\s+/).includes(element.id));if(output&&clean(output.textContent))return clean(output.textContent);}
 return clean(element.getAttribute('aria-valuenow')??element.value);
}
const sentence=parts=>parts.map(clean).filter(Boolean).join('. ')+'.';

export function describeControl(element){
 const control=controlFor(element);if(!control)return '';
 const tag=control.tagName,type=(control.getAttribute('type')||'text').toLowerCase(),role=control.getAttribute('role'),name=nameOf(control);
 if(role==='application'||control.id==='map')return sentence([name||'Map explorer','Arrows navigate space and time. 1 reads place, 2 value, 3 date. 9 reads the full guide. Tab leaves the map']);
 const disabled=control.disabled||control.getAttribute('aria-disabled')==='true'?'Unavailable':'';
 if(role==='tab')return sentence([name,'Tab',control.getAttribute('aria-selected')==='true'?'Selected':'Not selected',disabled]);
 if(role==='dialog')return sentence([name||'Dialog','Dialog']);
 if(tag==='SUMMARY')return sentence([name,'Section',control.parentElement?.open?'Expanded':'Collapsed','Enter toggles',disabled]);
 if(type==='checkbox'||type==='radio'||['checkbox','radio','switch'].includes(role)){
  const checked=control.getAttribute('aria-checked')??String(control.checked);
  return sentence([name,role==='switch'?'Switch':type==='radio'||role==='radio'?'Radio option':'Checkbox',checked==='mixed'?'Mixed':checked==='true'?'On':'Off',disabled]);
 }
 if(tag==='SELECT'||role==='combobox'){
  const selected=tag==='SELECT'?[...control.options].filter(option=>option.selected).map(option=>clean(option.textContent)).join(', '):stateValue(control);
  return sentence([name,'Selection',selected,tag==='SELECT'&&!control.multiple?'Use Up and Down to change':'',disabled]);
 }
 if(type==='range'||role==='slider')return sentence([name,'Slider',stateValue(control),disabled]);
 if(tag==='TEXTAREA'||tag==='INPUT'&&!['button','submit','reset','image','hidden'].includes(type)||role==='textbox'||control.isContentEditable){
  if(type==='password')return sentence([name,'Password field',disabled]);
  if(type==='file')return sentence([name,'File chooser',[...control.files??[]].map(file=>clean(file.name).split(/[\\/]/).at(-1)).join(', ')||'No file selected',disabled]);
  return sentence([name,type==='number'?'Number field':tag==='TEXTAREA'?'Multiline text field':'Text field',boundedValue(control.value??control.textContent)||'Empty',disabled]);
 }
 const expanded=control.hasAttribute('aria-expanded')?(control.getAttribute('aria-expanded')==='true'?'Expanded':'Collapsed'):'';
 return sentence([name,tag==='A'?'Link':tag==='BUTTON'||['button','submit','reset'].includes(type)||role==='button'?'Button':'Region',expanded,disabled]);
}

export function createUIAnnouncements({document,speak,stop=()=>{},isReady=()=>true,enabled=()=>true,delay=100,schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id)}={}){
 let locallyEnabled=true,destroyed=false,timer=null,serial=0,pending=null,last=null,ownsSpeech=false;
 const permitted=()=>!destroyed&&locallyEnabled&&enabled();
 function invalidate(clearOwnership=true){serial++;if(timer!==null)unschedule(timer);timer=null;pending=null;if(clearOwnership)ownsSpeech=false;}
 function cancel(){invalidate();}
 function queue(element,{force=false}={}){
  const control=controlFor(element);if(!permitted()||!control)return;
  // Retain the current focus, not an arbitrary changed control elsewhere.
  if(document.activeElement!==control&&!control.contains(document.activeElement))return;
  const text=describeControl(control);if(!text)return;
  if(!force&&(pending?.element===control&&pending.text===text||last?.element===control&&last.text===text))return;
  invalidate(false);pending={element:control,text};const token=serial;
  timer=schedule(()=>{
   timer=null;pending=null;
   if(token!==serial||!permitted()||!isReady()||!available(control)||document.activeElement!==control&&!control.contains(document.activeElement))return;
   const current=describeControl(control);if(!current)return;
   last={element:control,text:current};ownsSpeech=true;
   try{Promise.resolve(speak(current,{kind:'interface',element:control})).catch(()=>{});}catch{}
  },delay);
 }
 const focus=event=>queue(event.target,{force:true});
 const change=event=>{
  const control=controlFor(event.target);if(!control)return;
  const type=(control.getAttribute('type')||'').toLowerCase(),role=control.getAttribute('role');
  if(control.tagName==='SELECT'||['range','checkbox','radio','file'].includes(type)||['combobox','slider','checkbox','radio','switch'].includes(role))queue(control);
 };
 const click=event=>{const control=controlFor(event.target);if(control?.matches('summary,[aria-expanded],[role="tab"]'))queue(control);};
 const toggle=event=>{if(event.target.tagName==='DETAILS')queue(event.target.querySelector('summary'));};
 const selectKey=event=>{
  if(!permitted()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const control=controlFor(event.target);
  if(control?.tagName!=='SELECT'||control.multiple||control.disabled||control.matches(':disabled')||control.getAttribute('aria-disabled')==='true'||document.activeElement!==control)return;
  if(!['ArrowUp','ArrowDown','Home','End','Enter',' ','Spacebar'].includes(event.key))return;
  // Keep keyboard selection inside the page, where Phonon can announce it.
  // Browser/OS dropdown highlights are otherwise unavailable to page scripts.
  event.preventDefault();
  if(['Enter',' ','Spacebar'].includes(event.key)){queue(control,{force:true});return;}
  const options=[...control.options],availableIndices=options.flatMap((option,index)=>{
   const group=option.closest('optgroup');
   return option.disabled||option.hidden||group?.disabled||group?.hidden?[]:[index];
  });
  const previous=control.value,current=control.selectedIndex;
  let next;
  if(event.key==='Home')next=availableIndices[0];
  else if(event.key==='End')next=availableIndices.at(-1);
  else if(event.key==='ArrowDown')next=availableIndices.find(index=>index>current);
  else next=current<0?availableIndices.at(-1):availableIndices.findLast(index=>index<current);
  if(next!==undefined&&next!==current){
   control.selectedIndex=next;
   if(control.value!==previous){
    const Event=document.defaultView.Event;
    control.dispatchEvent(new Event('input',{bubbles:true}));
    control.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
  queue(control,{force:true});
 };
 document.addEventListener('focusin',focus);document.addEventListener('input',change);document.addEventListener('change',change);document.addEventListener('click',click);document.addEventListener('toggle',toggle,true);document.addEventListener('keydown',selectKey);
 return {
  setEnabled(value){const wasSpeaking=ownsSpeech;locallyEnabled=!!value;if(!locallyEnabled){cancel();if(wasSpeaking)stop();}else queue(document.activeElement,{force:true});},
  announceFocused(){queue(document.activeElement,{force:true});},
  cancel,
  destroy(){const wasSpeaking=ownsSpeech;cancel();destroyed=true;document.removeEventListener('focusin',focus);document.removeEventListener('input',change);document.removeEventListener('change',change);document.removeEventListener('click',click);document.removeEventListener('toggle',toggle,true);document.removeEventListener('keydown',selectKey);if(wasSpeaking)stop();}
 };
}
