import{mkdir,copyFile,writeFile}from'node:fs/promises';
const directory=new URL('../public/phonon-licenses/',import.meta.url);await mkdir(directory,{recursive:true});
for(const file of ['LICENSE-MIT','LICENSE-APACHE','THIRD_PARTY_LICENSES.md'])await copyFile(new URL('../node_modules/phonon-tts/'+file,import.meta.url),new URL(file,directory));
await writeFile(new URL('NOTICE.txt',directory),'Phonon TTS 0.7.1, MIT OR Apache-2.0. Runtime source: https://github.com/gradium-ai/xn-ptts/tree/main/ptts-wasm/js\nPhonon31m English model, Apache-2.0, revision92741c5b07d085ff840e26fea8ce43110b87852f: https://huggingface.co/gradium/phonon-31m-en/tree/92741c5b07d085ff840e26fea8ce43110b87852f\nApp source: https://github.com/NanoGraphene/Geophonia/tree/main\nModel assets are downloaded at startup; all speech is generated locally from arbitrary text.\n');
console.log('Prepared Phonon licenses; no speech recordings or pre-rendered lines.');
