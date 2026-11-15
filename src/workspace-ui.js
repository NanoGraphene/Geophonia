// Manual tabs keep the map mounted and expose only the selected controls.
export function setupWorkspaceUI(document,{onChange=()=>{}}={}) {
 const controls=document.getElementById('controls-panel'),toggle=document.getElementById('controls-toggle'),layout=document.getElementById('workspace-layout'),focusMap=document.getElementById('focus-map');
 const tablist=controls?.querySelector('[role="tablist"]'),tabs=Array.from(tablist?.querySelectorAll('[role="tab"]')??[]);
 if(!controls||!toggle||!layout||!tablist||!tabs.length)throw new Error('The explorer workspace controls are incomplete.');
 const panels=new Map(tabs.map(tab=>[tab.dataset.tab,document.getElementById(tab.getAttribute('aria-controls'))]));
 let active=tabs.find(tab=>tab.getAttribute('aria-selected')==='true')?.dataset.tab??tabs[0].dataset.tab,collapsed=controls.hidden;
 const listeners=[];
 const listen=(node,type,handler)=>{node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));};
 const focus=element=>element?.focus({preventScroll:true});
 function roving(tab){for(const other of tabs)other.tabIndex=other===tab?0:-1;}
 function applyCollapsed(){controls.hidden=collapsed;toggle.setAttribute('aria-expanded',String(!collapsed));toggle.textContent=collapsed?'Show controls':'Hide controls';layout.classList.toggle('controls-collapsed',collapsed);}
 function announceChange(){const detail={tab:active,collapsed};onChange(detail);const Event=document.defaultView?.CustomEvent;if(Event)document.dispatchEvent(new Event('workspacechange',{detail}));}
 function showTab(name,{focus:moveFocus=false}={}) {
  const tab=tabs.find(candidate=>candidate.dataset.tab===name);if(!tab)return false;
  const oldPanel=panels.get(active),wasHidden=collapsed,changed=active!==name;
  const focusWouldBeHidden=changed&&oldPanel?.contains(document.activeElement);
  active=name;collapsed=false;applyCollapsed();
  for(const candidate of tabs){const selected=candidate===tab;candidate.setAttribute('aria-selected',String(selected));panels.get(candidate.dataset.tab).hidden=!selected;}
  roving(tab);if(moveFocus||focusWouldBeHidden)focus(tab);
  if(changed||wasHidden)announceChange();return true;
 }
 function setCollapsed(value){const next=!!value;if(next===collapsed)return;const focusInside=controls.contains(document.activeElement);collapsed=next;if(next&&focusInside){toggle.setAttribute('aria-expanded','false');toggle.textContent='Show controls';focus(toggle);}applyCollapsed();if(!next)focus(tabs.find(tab=>tab.dataset.tab===active));announceChange();}
 for(const tab of tabs){
  listen(tab,'click',()=>showTab(tab.dataset.tab));
  listen(tab,'focus',()=>roving(tab));
  listen(tab,'keydown',event=>{
   if(event.altKey||event.ctrlKey||event.metaKey)return;
   const index=tabs.indexOf(tab);let next;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=tabs.length-1;
   else if(event.key==='Enter'||event.key===' '||event.key==='Spacebar'){event.preventDefault();event.stopPropagation();showTab(tab.dataset.tab);return;}
   else return;
   event.preventDefault();event.stopPropagation();roving(tabs[next]);focus(tabs[next]);
  });
 }
 listen(tablist,'focusout',event=>{if(!tablist.contains(event.relatedTarget))roving(tabs.find(tab=>tab.dataset.tab===active));});
 listen(toggle,'click',()=>setCollapsed(!collapsed));
 if(focusMap)listen(focusMap,'click',()=>focus(document.getElementById('map')));
 listen(document,'click',event=>{const trigger=event.target?.closest?.('[data-open-tab]');if(!trigger)return;event.preventDefault();showTab(trigger.dataset.openTab,{focus:true});});
 // Set initial semantics without moving focus or speaking at page load.
 applyCollapsed();for(const tab of tabs){const selected=tab.dataset.tab===active;tab.setAttribute('aria-selected',String(selected));panels.get(tab.dataset.tab).hidden=!selected;}roving(tabs.find(tab=>tab.dataset.tab===active));
 return {showTab,setCollapsed,get activeTab(){return active;},get isCollapsed(){return collapsed;},destroy(){for(const remove of listeners.splice(0))remove();}};
}
