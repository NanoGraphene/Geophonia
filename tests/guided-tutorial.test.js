import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {setupGuidedTutorial,TUTORIAL_STEPS} from '../src/guided-tutorial.js';
import {setupWorkspaceUI} from '../src/workspace-ui.js';

function fixture(overrides={}){
  const dom=new JSDOM(readFileSync('index.html','utf8'),{pretendToBeVisual:true}),{document}=dom.window;
  const c={dataset:'svs-3912',timeIndex:0,frameCount:3,audioEnabled:false,speechEnabled:true,speechVolume:1,expanded:false,...overrides};
  const spoken=[],calls={stops:0,exits:0};
  const workspace=setupWorkspaceUI(document);
  const tour=setupGuidedTutorial({document,getContext:()=>({...c,activeTab:workspace.activeTab}),
    speak:async text=>{spoken.push(text);return true;},stop:()=>calls.stops++,
    showTab:name=>name?workspace.showTab(name):workspace.setCollapsed(false),
    standardView:()=>{c.expanded=false;tour.relocate();},
    enableSpeech:()=>{c.speechEnabled=true;c.speechVolume=1;},onExit:()=>calls.exits++});
  const $=id=>document.getElementById(id);
  const skipTo=id=>{while(tour.stepId!==id){assert.ok(tour.active);const before=tour.stepId;if(!$('tutorial-skip').hidden)$('tutorial-skip').click();else $('tutorial-next').click();assert.notEqual(tour.stepId,before);}};
  const close=()=>{tour.destroy();workspace.destroy();dom.window.close();};
  return {dom,document,c,spoken,calls,workspace,tour,$,skipTo,close};
}

test('tour is opt-in, has no startup speech, and waits for successful actions without auto-advancing',()=>{
  const f=fixture();try{
    assert.equal(f.tour.active,false);assert.equal(f.$('tutorial').hidden,true);assert.deepEqual(f.spoken,[]);
    f.document.querySelector('[data-start-tutorial]').click();assert.equal(f.tour.stepId,'welcome');assert.match(f.spoken[0],/Step 1/);
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'audio');assert.equal(f.$('tutorial-next').disabled,true);
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'audio');
    f.tour.notify('location-moved');assert.equal(f.$('tutorial-next').disabled,true,'unrelated actions do not complete a lesson');
    const voiceCount=f.spoken.length;f.tour.notify('audio-started');assert.equal(f.$('tutorial-next').disabled,false);assert.equal(f.tour.stepId,'audio');assert.equal(f.spoken.length,voiceCount,'success cannot cut off actual data audio');
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'move');assert.equal(f.document.activeElement,f.$('tutorial-title'));
  }finally{f.close();}
});

test('practice reveals actual controls; tab and two shoreline lessons require the requested actions',()=>{
  const f=fixture();try{
    f.tour.start();f.workspace.setCollapsed(true);f.skipTo('tabs');assert.equal(f.workspace.isCollapsed,false);assert.equal(f.$('tutorial-next').disabled,true);
    f.$('tutorial-practice').click();assert.equal(f.document.activeElement,f.$('tab-data'));assert.equal(f.workspace.activeTab,'navigate');
    f.$('tab-data').click();assert.equal(f.$('tutorial-next').disabled,false);
    f.skipTo('coast');assert.equal(f.workspace.activeTab,'help');
    const land=f.document.querySelector('[data-legend="coast-land"]');assert.equal(land.closest('details').open,true);assert.ok(land.classList.contains('tutorial-target'));
    f.$('tutorial-practice').click();assert.equal(f.document.activeElement,land);
    f.tour.notify('legend-coast-land');assert.equal(f.$('tutorial-next').disabled,true);
    f.$('tutorial-practice').click();assert.equal(f.document.activeElement,f.document.querySelector('[data-legend="coast-water"]'));
    f.tour.notify('legend-coast-water');assert.equal(f.$('tutorial-next').disabled,false);
  }finally{f.close();}
});

test('time and dataset steps wait for a different successfully loaded frame, not merely an input event',()=>{
  const f=fixture();try{
    f.tour.start();f.skipTo('time');f.tour.notify('frame-ready',{dataset:f.c.dataset,index:0});assert.equal(f.$('tutorial-next').disabled,true);
    f.tour.notify('frame-ready',{dataset:f.c.dataset,index:1});assert.equal(f.$('tutorial-next').disabled,false);
    f.skipTo('dataset');f.tour.notify('frame-ready',{dataset:f.c.dataset,index:2});assert.equal(f.$('tutorial-next').disabled,true);
    f.tour.notify('frame-ready',{dataset:'svs-5147',index:0});assert.equal(f.$('tutorial-next').disabled,false);
  }finally{f.close();}
  const single=fixture({frameCount:1});try{single.tour.start();single.skipTo('time');assert.equal(single.$('tutorial-next').disabled,false);assert.match(single.$('tutorial-feedback').textContent,/no time sequence/);}finally{single.close();}
});

test('speech is optional, respects master mute, and only the explicit enable control unmutes it',()=>{
  const f=fixture({speechEnabled:false,speechVolume:0});try{
    f.tour.start();assert.equal(f.spoken.length,0);assert.equal(f.$('tutorial-enable-audio').hidden,false);
    f.$('tutorial-enable-audio').click();assert.equal(f.spoken.length,1);assert.equal(f.$('tutorial-enable-audio').hidden,true);
    f.$('tutorial-voice').click();const count=f.spoken.length;f.$('tutorial-next').click();assert.equal(f.spoken.length,count);
    f.$('tutorial-voice').click();assert.equal(f.spoken.length,count+1);
    f.tour.pause();assert.match(f.$('tutorial-speech-status').textContent,/silenced/);assert.equal(f.tour.active,true);assert.equal(f.spoken.length,count+1);
  }finally{f.close();}
});

test('tour stays inside expanded dialog, returns to standard view and cleans highlights and focus on exit',()=>{
  const f=fixture();try{
    const launcher=f.document.querySelector('[data-start-tutorial]');launcher.focus();f.tour.start();f.skipTo('expand');
    f.c.expanded=true;f.$('expanded-dialog').setAttribute('open','');f.tour.relocate();f.tour.notify('map-expanded');
    assert.ok(f.$('expanded-dialog').contains(f.$('tutorial')));assert.equal(f.$('tutorial-next').disabled,false);
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'silence');assert.equal(f.$('expanded-dialog').contains(f.$('tutorial')),false);assert.equal(f.$('tutorial-next').disabled,true,'closing expanded view cannot count as deliberate silence');
    f.tour.notify('silenced');f.$('tutorial-next').click();assert.equal(f.tour.stepId,'finish');f.$('tutorial-next').click();
    assert.equal(f.tour.active,false);assert.equal(f.$('tutorial').hidden,true);assert.equal(f.document.querySelectorAll('.tutorial-target').length,0);assert.equal(f.document.activeElement,launcher);assert.equal(f.calls.exits,1);
  }finally{f.close();}
});

test('dedicated shortcuts leave digits and map keys alone; Back, Skip and Repeat never trap the user',()=>{
  const f=fixture();try{
    const key=(value,options={})=>{const e=new f.dom.window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options});f.document.dispatchEvent(e);return e;};
    key('t',{altKey:true});assert.equal(f.tour.active,true);key('n',{altKey:true});assert.equal(f.tour.stepId,'audio');
    assert.equal(key('1').defaultPrevented,false);assert.equal(key('ArrowRight').defaultPrevented,false);
    key('n',{altKey:true});assert.equal(f.tour.stepId,'audio');f.$('tutorial-skip').click();assert.equal(f.tour.stepId,'move');
    key('p',{altKey:true});assert.equal(f.tour.stepId,'audio');const count=f.spoken.length;key('r',{altKey:true});assert.equal(f.spoken.length,count+1);
    key('t',{altKey:true});assert.equal(f.tour.active,false);
    assert.equal(f.$('tutorial-progress-bar').max,TUTORIAL_STEPS.length);
  }finally{f.close();}
});
