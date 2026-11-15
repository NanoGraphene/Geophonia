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

test('three short steps are opt-in and wait only for the essential actions',()=>{
  const f=fixture();try{
    assert.equal(TUTORIAL_STEPS.length,3);assert.ok(TUTORIAL_STEPS.every(step=>step.text.split(/\s+/).length<=40));
    assert.equal(f.tour.active,false);assert.equal(f.$('tutorial').hidden,true);assert.deepEqual(f.spoken,[]);
    f.document.querySelector('[data-start-tutorial]').click();assert.equal(f.tour.stepId,'explore');assert.match(f.spoken[0],/Step 1 of 3/);
    assert.match(f.spoken[0],/Press 9/);assert.equal(f.$('tutorial-next').disabled,true);
    f.tour.notify('read-place');assert.equal(f.$('tutorial-next').disabled,true);
    f.tour.notify('audio-started');assert.equal(f.$('tutorial-next').disabled,true,'movement is still required');
    const count=f.spoken.length;f.tour.notify('location-moved');assert.equal(f.$('tutorial-next').disabled,false);assert.equal(f.spoken.length,count,'success cannot interrupt data sound');
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'read');assert.equal(f.document.activeElement,f.$('tutorial-title'));
  }finally{f.close();}
});

test('all three readings share one step and finish requires no additional practice',()=>{
  const f=fixture();try{
    f.tour.start();f.skipTo('read');f.$('tutorial-practice').click();assert.equal(f.document.activeElement,f.$('map'));
    for(const action of ['read-place','read-value']){f.tour.notify(action);assert.equal(f.$('tutorial-next').disabled,true);}
    f.tour.notify('read-value');assert.match(f.$('tutorial-feedback').textContent,/2 of 3/,'repeating a reading cannot count twice');
    f.tour.notify('read-date');assert.equal(f.$('tutorial-next').disabled,false);
    f.$('tutorial-next').click();assert.equal(f.tour.stepId,'finish');assert.equal(f.$('tutorial-next').disabled,false);assert.match(f.$('tutorial-instructions').textContent,/Press 9/);
    f.$('tutorial-next').click();assert.equal(f.tour.active,false);assert.equal(f.document.querySelectorAll('.tutorial-target').length,0);
  }finally{f.close();}
  const playing=fixture({audioEnabled:true});try{playing.tour.start();assert.equal(playing.$('tutorial-next').disabled,true);playing.tour.notify('location-moved');assert.equal(playing.$('tutorial-next').disabled,false);}finally{playing.close();}
});

test('speech is optional and only the explicit enable control unmutes the master voice',()=>{
  const f=fixture({speechEnabled:false,speechVolume:0});try{
    f.tour.start();assert.equal(f.spoken.length,0);assert.equal(f.$('tutorial-enable-audio').hidden,false);
    f.$('tutorial-enable-audio').click();assert.equal(f.spoken.length,1);assert.equal(f.$('tutorial-enable-audio').hidden,true);
    f.$('tutorial-voice').click();const count=f.spoken.length;f.$('tutorial-skip').click();assert.equal(f.spoken.length,count);
    f.$('tutorial-voice').click();assert.equal(f.spoken.length,count+1);
    f.tour.pause();assert.match(f.$('tutorial-speech-status').textContent,/silenced/);assert.equal(f.tour.active,true);assert.equal(f.spoken.length,count+1);
  }finally{f.close();}
});

test('tour remains reachable in expanded view and restores focus and highlights on exit',()=>{
  const f=fixture();try{
    const launcher=f.document.querySelector('[data-start-tutorial]');launcher.focus();f.tour.start();
    f.c.expanded=true;f.$('expanded-dialog').setAttribute('open','');f.tour.relocate();assert.ok(f.$('expanded-dialog').contains(f.$('tutorial')));
    f.c.expanded=false;f.tour.relocate();assert.equal(f.$('expanded-dialog').contains(f.$('tutorial')),false);
    f.tour.exit();assert.equal(f.$('tutorial').hidden,true);assert.equal(f.document.querySelectorAll('.tutorial-target').length,0);assert.equal(f.document.activeElement,launcher);assert.equal(f.calls.exits,1);
  }finally{f.close();}
});

test('Back, Skip and Repeat stay available and tour shortcuts leave reading digits alone',()=>{
  const f=fixture();try{
    const key=(value,options={})=>{const e=new f.dom.window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options});f.document.dispatchEvent(e);return e;};
    key('t',{altKey:true});assert.equal(f.tour.active,true);assert.equal(f.tour.stepId,'explore');
    for(const value of ['1','2','3','9','ArrowRight'])assert.equal(key(value).defaultPrevented,false);
    key('n',{altKey:true});assert.equal(f.tour.stepId,'explore');f.$('tutorial-skip').click();assert.equal(f.tour.stepId,'read');
    key('p',{altKey:true});assert.equal(f.tour.stepId,'explore');const count=f.spoken.length;key('r',{altKey:true});assert.equal(f.spoken.length,count+1);
    key('t',{altKey:true});assert.equal(f.tour.active,false);assert.equal(f.$('tutorial-progress-bar').max,3);
  }finally{f.close();}
});
