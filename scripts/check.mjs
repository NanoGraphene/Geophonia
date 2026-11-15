import { readFile, access, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { DATASETS } from '../src/datasets.js';
import assert from 'node:assert/strict';
const html=await readFile('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'HTML IDs must be unique');
for(const [,id] of html.matchAll(/\bfor="([^"]+)"/g)) for(const part of id.split(' ')) assert.ok(ids.includes(part),`Label target ${part} exists`);
for(const [,list] of html.matchAll(/\baria-(?:labelledby|describedby)="([^"]+)"/g)) for(const id of list.split(' ')) assert.ok(ids.includes(id),`ARIA target ${id} exists`);
const main=await readFile('src/main.js','utf8');
for(const [,id] of main.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id),`UI target ${id} exists`);
for(const file of await readdir('src')) if(file.endsWith('.js')) execFileSync(process.execPath,['--check',`src/${file}`]);
for(const definition of Object.values(DATASETS)){
 const manifest=JSON.parse(await readFile('public/'+definition.manifest.replace(/^\.\//,'')));
 for(const frame of manifest.frames)for(const path of [frame.local,frame.display])await access('public/'+path.replace(/^\.\//,''));
 const palette=manifest.feature?.paletteUrl??manifest.paletteUrl??definition.palette;if(palette)await access('public/'+palette.replace(/^\.\//,''));
}
assert.ok(html.includes('aria-live="polite"'));
assert.ok(html.includes('id="silence"'));
for(const path of ['public/geography/place-names.json','public/geography/place-names-manifest.json','public/phonon-licenses/LICENSE-MIT','public/phonon-licenses/LICENSE-APACHE','public/phonon-licenses/THIRD_PARTY_LICENSES.md']) await access(path);
console.log('Syntax, UI references, accessible label targets, and local source assets checked.');
