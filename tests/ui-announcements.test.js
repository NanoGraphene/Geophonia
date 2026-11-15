import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createUIAnnouncements,describeControl} from '../src/ui-announcements.js';

function fixture(html='<button id="start">Start audio</button>',options={}){
 const dom=new JSDOM(`<main>${html}</main>`,{url:'https://example.test/'}),document=dom.window.document,spoken=[],stops=[],timers=new Map();let timerId=0;
 const announcements=createUIAnnouncements({document,speak:(text,meta)=>{spoken.push({text,meta});},stop:()=>stops.push(true),schedule(fn){const id=++timerId;timers.set(id,fn);return id;},unschedule:id=>timers.delete(id),...options});
 const flush=()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}};
 return {dom,document,spoken,stops,timers,announcements,flush,$:id=>document.getElementById(id),event:(el,type)=>el.dispatchEvent(new dom.window.Event(type,{bubbles:true})),close(){announcements.destroy();dom.window.close();}};
}

test('does not speak on construction; focus announces accessible label and native role',()=>{
 const f=fixture();assert.equal(f.spoken.length,0);f.$('start').focus();f.flush();assert.equal(f.spoken[0].text,'Start audio. Button.');assert.equal(f.spoken[0].meta.kind,'interface');assert.equal(f.spoken[0].meta.element,f.$('start'));f.close();
});
test('accessible name prefers labelledby then aria-label and excludes decorative and nested control text',()=>{
 const f=fixture('<span id="name">Listen now</span><button id="b" aria-labelledby="name" aria-label="Ignored">Other</button><label for="v">Map volume <output for="v">25%</output><input id="v" type="range" value="25"></label>');
 assert.equal(describeControl(f.$('b')),'Listen now. Button.');assert.equal(describeControl(f.$('v')),'Map volume. Slider. 25%.');f.close();
});
test('rapid focus changes speak only the last still-focused control',()=>{
 const f=fixture('<button id="a">Start</button><button id="b">Silence</button>');f.$('a').focus();f.$('b').focus();f.flush();assert.deepEqual(f.spoken.map(s=>s.text),['Silence. Button.']);f.close();
});
test('tab focus announces selected state and later activation reads updated state',()=>{
 const f=fixture('<button id="tab" role="tab" aria-selected="false">Sound and speech</button>');f.$('tab').focus();f.flush();assert.equal(f.spoken.at(-1).text,'Sound and speech. Tab. Not selected.');f.$('tab').setAttribute('aria-selected','true');f.event(f.$('tab'),'click');f.flush();assert.equal(f.spoken.at(-1).text,'Sound and speech. Tab. Selected.');f.close();
});
test('checkbox input and change events coalesce and announce current state once',()=>{
 const f=fixture('<label for="c">Spoken interface</label><input id="c" type="checkbox">');f.$('c').focus();f.flush();assert.match(f.spoken.at(-1).text,/Off/);f.$('c').checked=true;f.event(f.$('c'),'input');f.event(f.$('c'),'change');f.flush();assert.equal(f.spoken.length,2);assert.equal(f.spoken.at(-1).text,'Spoken interface. Checkbox. On.');f.close();
});
test('select reads option label rather than internal value and coalesces input/change',()=>{
 const f=fixture('<label for="d">Dataset</label><select id="d"><option value="a">Ocean temperature</option><option value="b">Forest height</option></select>');f.$('d').focus();f.flush();f.$('d').value='b';f.event(f.$('d'),'input');f.event(f.$('d'),'change');f.flush();assert.equal(f.spoken.length,2);assert.equal(f.spoken.at(-1).text,'Dataset. Selection. Forest height. Use Up and Down to change.');f.close();
});
test('range changes keep only latest value and prefer aria-valuetext',()=>{
 const f=fixture('<label for="r">Time</label><input id="r" type="range" aria-valuetext="March 2007, frame 1 of 3">');f.$('r').focus();f.flush();for(const text of ['April 2007, frame 2 of 3','May 2007, frame 3 of 3']){f.$('r').setAttribute('aria-valuetext',text);f.event(f.$('r'),'input');}f.flush();assert.equal(f.spoken.length,2);assert.match(f.spoken.at(-1).text,/May 2007, frame 3 of 3/);f.close();
});
test('text and number typing are not echoed; password contents are never spoken',()=>{
 const f=fixture('<label for="t">Grid name</label><input id="t" value="New grid"><label for="n">Latitude</label><input id="n" type="number" value="30"><label for="p">Secret</label><input id="p" type="password" value="DO NOT SPEAK">');
 f.$('t').focus();f.flush();assert.equal(f.spoken.at(-1).text,'Grid name. Text field. New grid.');f.$('t').value='Typing new words';f.event(f.$('t'),'input');f.event(f.$('t'),'change');f.flush();assert.equal(f.spoken.length,1);
 f.$('n').focus();f.flush();assert.match(f.spoken.at(-1).text,/Latitude. Number field. 30/);f.$('n').value='31';f.event(f.$('n'),'input');f.flush();assert.equal(f.spoken.length,2);
 f.$('p').focus();f.flush();assert.equal(f.spoken.at(-1).text,'Secret. Password field.');assert.ok(!f.spoken.some(s=>s.text.includes('DO NOT SPEAK')));f.close();
});
test('long editable text is summarized rather than reciting a full reading on focus',()=>{
 const f=fixture('<label for="t">Text to speak</label><textarea id="t"></textarea>');f.$('t').value='x'.repeat(500);assert.equal(describeControl(f.$('t')),'Text to speak. Multiline text field. Contains 500 characters.');f.close();
});
test('hidden, inert, aria-hidden, closed details/dialog and native audio controls are skipped',()=>{
 const f=fixture('<div hidden><button id="h">Hidden</button></div><div inert><button id="i">Inert</button></div><div aria-hidden="true"><button id="a">Decorative</button></div><details><summary id="s">Advanced</summary><button id="d">Concealed</button></details><dialog><button id="g">Closed modal</button></dialog><audio tabindex="0" id="audio"></audio><div style="display:none"><button id="css">CSS hidden</button></div>');
 for(const id of ['h','i','a','d','g','audio','css'])assert.equal(describeControl(f.$(id)),'');assert.match(describeControl(f.$('s')),/Advanced. Section. Collapsed/);f.close();
});
test('a panel hidden before debounce fires never speaks stale focus',()=>{
 const f=fixture('<div id="panel"><button id="b">Panel button</button></div>');f.$('b').focus();f.$('panel').hidden=true;f.flush();assert.equal(f.spoken.length,0);f.close();
});
test('summary state updates are announced without a duplicate focus plus click reading',()=>{
 const f=fixture('<details id="details"><summary id="s">Advanced sound</summary><p>Settings</p></details>');f.$('s').focus();f.$('details').open=true;f.event(f.$('details'),'toggle');f.flush();assert.equal(f.spoken.length,1);assert.match(f.spoken[0].text,/Advanced sound. Section. Expanded/);f.close();
});
test('map gets a concise exploration hint rather than its long describedby subtree',()=>{
 const f=fixture('<div id="map" role="application" tabindex="0" aria-label="Earth map" aria-describedby="help"></div><p id="help">'+ 'Very long instructions '.repeat(50)+'</p>');f.$('map').focus();f.flush();assert.match(f.spoken[0].text,/1 reads place, 2 value, 3 date/);assert.ok(!f.spoken[0].text.includes('Very long'));f.close();
});
test('readiness and externally disabled narration gate announcements; ready parent may explicitly announce focused',()=>{
 let ready=false,on=true;const f=fixture(undefined,{isReady:()=>ready,enabled:()=>on});f.$('start').focus();f.flush();assert.equal(f.spoken.length,0);ready=true;f.announcements.announceFocused();f.flush();assert.equal(f.spoken.length,1);on=false;f.announcements.announceFocused();f.flush();assert.equal(f.spoken.length,1);f.close();
});
test('cancel, disable and destroy remove pending announcements and do not resume them',()=>{
 const f=fixture();f.$('start').focus();f.announcements.cancel();f.flush();assert.equal(f.spoken.length,0);f.announcements.announceFocused();f.flush();assert.equal(f.spoken.length,1);f.announcements.setEnabled(false);assert.equal(f.stops.length,1);f.announcements.announceFocused();f.flush();assert.equal(f.spoken.length,1);f.announcements.setEnabled(true);f.announcements.destroy();f.flush();assert.equal(f.spoken.length,1);f.close();
});
test('change events from an unfocused control never interrupt current navigation',()=>{
 const f=fixture('<button id="b">Start</button><input id="r" type="range" aria-label="Volume">');f.$('b').focus();f.flush();f.event(f.$('r'),'input');f.flush();assert.equal(f.spoken.length,1);f.close();
});
test('disabling while the next focus reading is pending stops the preceding interface speech',()=>{
 const f=fixture('<button id="a">Start</button><button id="b">Silence</button>');f.$('a').focus();f.flush();f.$('b').focus();f.announcements.setEnabled(false);f.flush();assert.equal(f.stops.length,1);assert.equal(f.spoken.length,1);f.close();
});
test('cancel before a data reading relinquishes interface ownership so disabling cannot stop that data reading',()=>{
 const f=fixture();f.$('start').focus();f.flush();f.announcements.cancel();f.announcements.setEnabled(false);assert.equal(f.stops.length,0);f.close();
});
test('synchronous and asynchronous speaker failures do not throw or leave unhandled rejections',async()=>{
 const f=fixture(undefined,{speak:()=>Promise.reject(new Error('No audio device'))});f.$('start').focus();f.flush();await Promise.resolve();f.close();const g=fixture(undefined,{speak:()=>{throw new Error('Unavailable');}});g.$('start').focus();assert.doesNotThrow(g.flush);g.close();
});

function key(f,id,value,modifiers={}){const event=new f.dom.window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...modifiers});f.$(id).dispatchEvent(event);return event;}
const choices='<label for="d">Dataset</label><select id="d"><option value="a">Ocean temperature</option><option disabled value="b">Unavailable source</option><optgroup label="Unavailable group" disabled><option value="c">Unavailable group source</option></optgroup><option value="d" hidden>Hidden source</option><option value="e">Forest height</option><option value="f">Night lights</option></select>';
test('self-voicing select keys skip disabled options/groups and dispatch native application events once',()=>{
 const f=fixture(choices),events=[];f.$('d').addEventListener('input',()=>events.push('input'));f.$('d').addEventListener('change',()=>events.push('change'));f.$('d').focus();f.flush();
 const down=key(f,'d','ArrowDown');assert.equal(down.defaultPrevented,true);assert.equal(f.$('d').value,'e');assert.deepEqual(events,['input','change']);f.flush();assert.match(f.spoken.at(-1).text,/Forest height/);
 key(f,'d','ArrowUp');assert.equal(f.$('d').value,'a');f.flush();assert.match(f.spoken.at(-1).text,/Ocean temperature/);assert.deepEqual(events,['input','change','input','change']);f.close();
});
test('Home/End choose first and last enabled options, without changing again at a boundary',()=>{
 const f=fixture(choices),events=[];f.$('d').focus();f.flush();f.$('d').addEventListener('change',()=>events.push(f.$('d').value));
 key(f,'d','End');assert.equal(f.$('d').value,'f');key(f,'d','ArrowDown');assert.equal(f.$('d').value,'f');key(f,'d','Home');assert.equal(f.$('d').value,'a');key(f,'d','ArrowUp');assert.equal(f.$('d').value,'a');f.flush();assert.deepEqual(events,['f','a']);assert.match(f.spoken.at(-1).text,/Ocean temperature/);f.close();
});
test('Enter and Space keep keyboard selection in-page and repeat the focused value without firing changes',()=>{
 const f=fixture(choices),changes=[];f.$('d').focus();f.flush();f.$('d').addEventListener('change',()=>changes.push(true));
 for(const value of ['Enter',' ']){const event=key(f,'d',value);assert.equal(event.defaultPrevented,true);f.flush();assert.match(f.spoken.at(-1).text,/Ocean temperature/);}assert.equal(changes.length,0);assert.equal(f.spoken.length,3);f.close();
});
test('rapid keyboard selections coalesce; explicit cancel prevents a pending option from interrupting data speech',()=>{
 const f=fixture(choices);f.$('d').focus();f.flush();key(f,'d','ArrowDown');key(f,'d','ArrowDown');assert.equal(f.$('d').value,'f');f.flush();assert.equal(f.spoken.length,2);assert.match(f.spoken.at(-1).text,/Night lights/);
 key(f,'d','Home');f.announcements.cancel();f.flush();assert.equal(f.spoken.length,2);f.close();
});
test('UI voice off preserves native select keyboard handling and normal mouse clicks',()=>{
 let on=false;const f=fixture(choices,{enabled:()=>on});f.$('d').focus();const event=key(f,'d','ArrowDown');assert.equal(event.defaultPrevented,false);assert.equal(f.$('d').value,'a');f.flush();assert.equal(f.spoken.length,0);
 on=true;f.announcements.setEnabled(false);assert.equal(key(f,'d','Enter').defaultPrevented,false);f.announcements.setEnabled(true);const click=new f.dom.window.MouseEvent('click',{bubbles:true,cancelable:true});f.$('d').dispatchEvent(click);assert.equal(click.defaultPrevented,false);f.close();
});
test('modifiers, typing and map-reading digits never become select navigation shortcuts',()=>{
 const f=fixture(choices);f.$('d').focus();f.flush();for(const [value,modifiers] of [['ArrowDown',{altKey:true}],['ArrowDown',{ctrlKey:true}],['Home',{metaKey:true}],['ArrowUp',{shiftKey:true}],['1',{}],['2',{}],['3',{}],['f',{}]])assert.equal(key(f,'d',value,modifiers).defaultPrevented,false);assert.equal(f.$('d').value,'a');f.close();
});
test('multiple, disabled, unfocused and hidden native selects keep their native behavior',()=>{
 const f=fixture(choices+'<select id="m" multiple><option>A</option><option>B</option></select><select id="x" disabled><option>A</option></select><div inert><select id="i"><option>A</option><option>B</option></select></div>');
 f.$('m').focus();assert.equal(key(f,'m','ArrowDown').defaultPrevented,false);f.$('d').focus();assert.equal(key(f,'x','ArrowDown').defaultPrevented,false);assert.equal(key(f,'i','ArrowDown').defaultPrevented,false);assert.equal(key(f,'m','ArrowDown').defaultPrevented,false);f.$('d').parentElement.hidden=true;assert.equal(key(f,'d','ArrowDown').defaultPrevented,false);f.close();
});
test('select event handlers see bubbled input/change; selecting an equal value does not trigger another dataset load',()=>{
 const f=fixture('<label for="d">Dataset</label><select id="d"><option value="a">First label</option><option value="a">Alternate label</option><option value="b">Other source</option></select>'),events=[];f.document.addEventListener('input',()=>events.push('input'));f.document.addEventListener('change',()=>events.push('change'));f.$('d').focus();f.flush();key(f,'d','ArrowDown');f.flush();assert.deepEqual(events,[]);assert.match(f.spoken.at(-1).text,/Alternate label/);key(f,'d','End');assert.deepEqual(events,['input','change']);f.close();
});
