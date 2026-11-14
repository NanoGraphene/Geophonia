import test from 'node:test';
import assert from 'node:assert/strict';
import{placeText,valueText,dateText,temperatureEstimate}from'../src/narration-text.js';
const manifest={valueScale:{min:-40,max:40}};
test('value shortcut speaks temperature and unit, preserving real zero and missing values',()=>{
  assert.equal(temperatureEstimate({value:.5},manifest),0);
  assert.match(valueText({sample:{value:.5}},manifest),/Approximately 0 degrees Celsius/);
  assert.match(valueText({sample:{value:0}},manifest),/Approximately -40 degrees Celsius/);
  assert.match(valueText({sample:{value:1}},manifest),/Approximately 40 degrees Celsius/);
  assert.match(valueText({sample:{value:null}},manifest),/No interpretable/);
  assert.match(valueText({sample:null},manifest),/still loading/);
  assert.match(valueText({sample:{value:.75}},manifest),/estimate from image color/);
  assert.equal(temperatureEstimate({value:NaN},manifest),null);
});
test('place readings name the country/sea and explicitly handle unavailable names',()=>{
  assert.equal(placeText({name:'North Sea'},{lat:56,lon:3}),'North Sea.');
  assert.match(placeText(null,{lat:56,lon:3},'loading'),/still loading/);
  assert.match(placeText(null,{lat:56,lon:3},'error'),/unavailable/);
  assert.match(placeText(null,{lat:56,lon:3}),/No country, ocean or sea/);
});
test('date reading uses the selected frame timestamp in UTC and never reads wall-clock time',()=>{
  assert.equal(dateText('2026-10-29T11:00:00Z'),'29 October 2026 at 11:00 UTC.');
  assert.match(dateText(null),/still loading/);assert.match(dateText('invalid'),/No date/);
});
