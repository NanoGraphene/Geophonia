import{mkdir,copyFile,writeFile}from'node:fs/promises';
const directory=new URL('../public/tts-data/',import.meta.url);await mkdir(directory,{recursive:true});
for(const file of ['manifest.json','core.bin.gz','en_dict.gz'])await copyFile(new URL('../node_modules/@spelling-creator/spellophone/espeak-ng-data/'+file,import.meta.url),new URL(file,directory));
await copyFile(new URL('../node_modules/@spelling-creator/spellophone/LICENSE',import.meta.url),new URL('LICENSE',directory));
console.log('Prepared English synthesis data (no speech recordings).');

await writeFile(new URL('NOTICE.txt',directory),'eSpeak NG 1.52.0 via Spellophone 0.2.1, GPL-3.0-or-later.\nSource and build instructions: https://github.com/Spelling-Creator/spellophone/tree/6d51a872d54a773e4969d7130fdaed665b2d6d18\nUpstream eSpeak NG: https://github.com/espeak-ng/espeak-ng\nApplication source: https://github.com/NanoGraphene/Geophonia/tree/arbitrary-text-speech\nThe browser synthesizes new audio from text; there are no speech recordings.\n');
