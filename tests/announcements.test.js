import test from 'node:test';
import assert from 'node:assert/strict';
import { spokenLocation, spokenValue } from '../src/announcements.js';

test('location is spelled out', () => {
  assert.match(spokenLocation({ lat: -12.5, lon: -45 }), /12\.50 degrees south.*45\.00 degrees west/);
});
test('null sample is not reported as zero', () => {
  assert.match(spokenValue({ value: null }), /not a scientific zero/);
});
test('value is out of 100', () => {
  assert.match(spokenValue({ value: 0.426, density: 0.5 }), /43 out of 100/);
});