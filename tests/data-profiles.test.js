import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{valueFromPosition,sourcePixel,frameLabel,recommendedMapping}from'../src/data-profiles.js';
import{sampleFeatures}from'../src/feature-sampling.js';
import{mapAudio}from'../src/audio-mapping.js';
import{parseCSV,createGridDataset}from'../src/csv-grid.js';
import{gridPixels}from'../src/grid-renderer.js';
import{valueText,formattedValue,dateText}from'../src/narration-text.js';
import catalog from '../public/data/catalog.json' with {type:'json'};
const prefs={minHz:160,maxHz:800,volume:.25};
test('nonlinear legends interpolate actual labeled tick anchors, including logarithmic and nonuniform scales',async()=>{
  for(const id of ['air-5151','air-5152','air-5153','air-5154']){
    const m=JSON.parse(await readFile(`public/data/${id}-manifest.json`));
    for(const anchor of m.valueScale.anchors)assert.ok(Math.abs(valueFromPosition(anchor.position,m.valueScale)-anchor.value)<1e-8);
    const [a,b]=m.valueScale.anchors;const middle=valueFromPosition((a.position+b.position)/2,m.valueScale);
    assert.ok(Math.abs(middle-(m.valueScale.interpolation==='log'?Math.sqrt(a.value*b.value):(a.value+b.value)/2))<1e-8);
    assert.equal(recommendedMapping(m).curve,m.mapping.curve);
  }
});
test('regional geography rejects outside points, does not wrap a partial grid and preserves source cells',()=>{
  const manifest={width:2,height:2,geo:{extent:[10,-10,30,10],projection:'equirectangular'}};
  assert.deepEqual(sourcePixel(manifest,{lon:15,lat:5}),{x:0,y:0});assert.deepEqual(sourcePixel(manifest,{lon:25,lat:-5}),{x:1,y:1});
  assert.equal(sourcePixel(manifest,{lon:-15,lat:5}),null);
  const source={manifest:{...manifest,feature:{method:'grid'},valueScale:{min:0,max:30}},gridData:[0,10,20,30]};
  const corner=sampleFeatures(source,{lon:10,lat:10},1);assert.equal(corner.totalPixels,4);assert.equal(corner.measurement,15);
  assert.equal(sampleFeatures(source,{lon:0,lat:0},1).validity,'outside-coverage');
});
test('web mercator and clipped grid-center indexing preserve projection, poles and date-line endpoints',()=>{
  const m={width:100,height:100,geo:{extent:[-180,-85.0511287798066,180,85.0511287798066],projection:'web-mercator'}};
  assert.deepEqual(sourcePixel(m,{lon:0,lat:0}),{x:50,y:50});assert.ok(sourcePixel(m,{lon:0,lat:60}).y<30);
  const table=parseCSV('lat,lon,value\n-90,-180,0\n-90,180,1\n90,-180,2\n90,180,3');
  const data=createGridDataset(table,{lat:'lat',lon:'lon',value:'value'});
  assert.deepEqual(sourcePixel(data.manifest,{lon:180,lat:90}),{x:1,y:0});
  assert.equal(sampleFeatures({...data,gridData:data.grids[0]},{lon:-180,lat:-90},0).measurement,0);
});
test('brightness has valid black zero; category colors select species without ranking categories',()=>{
  const imageData={width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,255,255,255,255])};
  const manifest={width:2,height:1,valueScale:{min:0,max:100},feature:{method:'brightness'}};
  const black=sampleFeatures({manifest,imageData},{lon:-90,lat:0},0);assert.equal(black.value,0);assert.equal(black.validity,'valid');
  assert.ok(Math.abs(sampleFeatures({manifest,imageData},{lon:90,lat:0},0).measurement-100)<1e-10);
  manifest.feature={method:'categories',categories:[{id:'green',hue:[65,165]},{id:'red',hue:[0,45]}]};imageData.data=new Uint8ClampedArray([0,255,0,255,255,0,0,255]);
  assert.equal(sampleFeatures({manifest,imageData},{lon:-90,lat:0},0,{variable:'green'}).value,1);
  assert.equal(sampleFeatures({manifest,imageData},{lon:-90,lat:0},0,{variable:'red'}).value,0);
});
test('annotation masks and dark neutral backgrounds cannot become high-value palette measurements',()=>{
  const manifest={width:1,height:1,feature:{method:'palette',matching:'rgb',background:{maxChroma:12,maxBrightness:235}},valueScale:{min:0,max:100}};
  const source={manifest,palette:[[255,255,255],[0,30,0]],imageData:{width:1,height:1,data:new Uint8ClampedArray([5,5,5,255])}};
  assert.equal(sampleFeatures(source,{lon:0,lat:0},0).value,null);
  source.imageData.data.set([255,255,255,255]);assert.equal(sampleFeatures(source,{lon:0,lat:0},0).value,0);
  manifest.masks=[[0,0,1,1]];assert.equal(sampleFeatures(source,{lon:0,lat:0},0).value,null);
});
test('pitch and amplitude use chosen range/channel with clipping, log and square-root response',()=>{
  const sample={value:.25,measurement:10,density:.5,intensity:.8,validity:'valid'};
  const mapping={min:1,max:100,curve:'log',amplitude:'value'};
  const output=mapAudio(sample,{...prefs,mapping});assert.ok(Math.abs(output.frequency-Math.sqrt(160*800))<1e-8);assert.equal(output.gain,.015);
  assert.equal(mapAudio(sample,{...prefs,mapping:{...mapping,amplitude:'coverage'}}).gain,.015);
  assert.equal(mapAudio(sample,{...prefs,mapping:{...mapping,amplitude:'intensity'}}).gain,.024);
  assert.equal(mapAudio({...sample,measurement:1000},{...prefs,mapping}).frequency,800);
  assert.equal(mapAudio(sample,{...prefs,mapping:{...mapping,min:0}}).frequency,null);
  assert.equal(mapAudio(sample,{...prefs,mapping:{min:0,max:40,curve:'sqrt',amplitude:'value'}}).frequency,Math.sqrt(160*800));
  assert.equal(mapAudio(sample,{...prefs,volume:0,mapping}).gain,0);
});
test('imported grid rendering and sampling refer to identical geographic cells, with missing pixels transparent',()=>{
  const data=createGridDataset(parseCSV('lat,lon,time,value\n-45,-90,2020,0\n-45,90,2020,10\n45,-90,2020,20\n45,90,2020,\n-45,-90,2021,30\n-45,90,2021,40\n45,-90,2021,50\n45,90,2021,60'),{lat:'lat',lon:'lon',value:'value',time:'time',unit:'meters'});
  const pixels=gridPixels(data.manifest,data.grids[0],4);
  assert.equal(pixels[3],255);assert.equal(pixels[(0*4+3)*4+3],0);
  const zero=sampleFeatures({manifest:data.manifest,gridData:data.grids[0]},{lat:-45,lon:-90},0);assert.equal(zero.measurement,0);assert.equal(zero.validity,'valid');
  assert.equal(data.manifest.valueScale.max,60);
  assert.match(valueText({sample:zero},data.manifest),/0 meters/);assert.doesNotMatch(valueText({sample:zero},data.manifest),/Celsius|image color/);
});
test('catalog assets preserve integrity and date precision instead of inventing instants',async()=>{
  assert.equal(catalog.datasets.length,9);
  for(const d of catalog.datasets){
    const m=JSON.parse(await readFile('public/'+d.manifest.slice(2)));
    for(const frame of m.frames)for(const [path,hash]of [[frame.local,frame.localSha256],[frame.display,frame.displaySha256]]){
      const bytes=await readFile('public/'+path.slice(2));if(hash)assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
    }
    if(d.id==='nightlights'){assert.ok(m.frames.every(f=>f.timestamp===null));assert.equal(frameLabel(m.frames[0],dateText),'2012 annual average');}
    if(d.id==='lightning'){assert.ok(m.frames.every(f=>f.timestamp===null));assert.match(frameLabel(m.frames[0],dateText),/unverified/i);}
  }
});
test('real NASA patches decode finite units and visible city lights, across all prepared profiles',async()=>{
  const patches=JSON.parse(await readFile('tests/fixtures/additional-patches.json'));
  for(const id of ['air-5151','air-5152','air-5153','air-5154','aerosols','nightlights','lightning']){
    const manifest=JSON.parse(await readFile(`public/data/${id}-manifest.json`));
    const palette=manifest.feature.paletteUrl?JSON.parse(await readFile('public/'+manifest.feature.paletteUrl.slice(2))).rgb:[];
    let valid=0;
    for(const patch of patches.filter(p=>p.dataset===id)){
      const sample=sampleFeatures({manifest:{...manifest,masks:[]},palette,imageData:patch},{lon:0,lat:0},2);
      if(sample.value!==null){assert.ok(Number.isFinite(sample.measurement));valid++;if(id==='nightlights')assert.ok(sample.measurement>0,patch.name);}
    }
    assert.ok(valid>0,id);
  }
});

test('dataset metadata rejects unsupported projections, reversed ranges and invalid calibration',async()=>{
  const {validateManifest}=await import('../src/data-profiles.js');
  const base={width:2,height:2,frames:[{}],geo:{projection:'equirectangular',extent:[-180,-90,180,90]},feature:{method:'grid'},valueScale:{min:0,max:1}};
  assert.equal(validateManifest(base),base);
  assert.throws(()=>validateManifest({...base,geo:{...base.geo,projection:'rotating-globe'}}),/Reproject/);
  assert.throws(()=>validateManifest({...base,valueScale:{min:10,max:1}}),/finite value range/);
  assert.throws(()=>validateManifest({...base,valueScale:{min:1,max:10,interpolation:'log',anchors:[{position:0,value:0},{position:1,value:10}]}}),/positive/);
});
