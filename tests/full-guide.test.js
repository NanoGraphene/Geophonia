import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {FULL_GUIDE_TEXT,isFullGuideShortcut} from '../src/full-guide.js';

test('the complete explanation fits one Phonon utterance and covers the essential controls',()=>{
  assert.ok(FULL_GUIDE_TEXT.length<5000);
  for(const topic of ['Right-click','Press 1','Press 2','Press 3','200 to 2000','density alone','Left and Right','CSV','Shoreline'.toLowerCase(),'Automatic speech','Escape','Press 9'])assert.ok(FULL_GUIDE_TEXT.includes(topic),topic);
});

test('9 reads the guide from map, page or buttons, while native editing and browser shortcuts retain their keys',()=>{
  const dom=new JSDOM('<button>Guide</button><div id="map" tabindex="0"></div><input><input type="number"><input type="range"><select><option>Nine</option></select><textarea></textarea><div contenteditable="true"><span>Edit</span></div><audio controls></audio>');
  const {document,KeyboardEvent}=dom.window;
  const shortcut=(target,options={})=>{const e=new KeyboardEvent('keydown',{key:'9',bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return isFullGuideShortcut(e);};
  try{
    for(const selector of ['body','button','#map','input[type="range"]'])assert.equal(shortcut(document.querySelector(selector)),true,selector);
    for(const selector of ['input:not([type])','input[type="number"]','select','textarea','[contenteditable] span','audio'])assert.equal(shortcut(document.querySelector(selector)),false,selector);
    for(const options of [{repeat:true},{altKey:true},{ctrlKey:true},{metaKey:true},{key:'1'},{key:'2'},{key:'3'}])assert.equal(shortcut(document.body,options),false);
    assert.equal(shortcut(document.body,{shiftKey:true}),true,'support keyboards that need Shift to type 9');
    const prevented=new KeyboardEvent('keydown',{key:'9',cancelable:true});prevented.preventDefault();assert.equal(isFullGuideShortcut(prevented),false);
  }finally{dom.window.close();}
});
