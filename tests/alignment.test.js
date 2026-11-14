import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('independent geometry alignment report passes empirical acceptance thresholds',async()=>{
 const report=JSON.parse(await readFile(new URL('../docs/alignment.json',import.meta.url)));
 assert.ok(report.agreement>.99);assert.ok(report.comparisonPixelCount>1_000_000);
 assert.equal(report.checkpoints.length,8);assert.ok(report.checkpoints.every(p=>p.agrees));
});
