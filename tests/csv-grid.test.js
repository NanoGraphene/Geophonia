import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, inferColumns, createGridDataset } from '../src/csv-grid.js';
const columns = { lat:'lat', lon:'lon', value:'value', time:'time', unit:'metres' };
const basic = rows => ({ headers:['lat','lon','value','time'], rows });

test('CSV parser handles BOM, quoted commas/newlines, escaped quotes and CRLF', () => {
  const table = parseCSV('\uFEFFlat,lon,value,note\r\n1,2,0,"a,b"\r\n2,3,4,"line 1\nline ""2"""\r\n\r\n');
  assert.deepEqual(table.headers,['lat','lon','value','note']);
  assert.equal(table.rows[0][3],'a,b'); assert.equal(table.rows[1][3],'line 1\nline "2"');
  assert.throws(()=>parseCSV('lat,lat\n1,2'),/unique/);
  assert.throws(()=>parseCSV('a,b\n1'),/columns/);
  assert.throws(()=>parseCSV('a\n"unclosed'),/not closed/);
  assert.throws(()=>parseCSV('a\n"ok"wrong'),/Unexpected/);
});

test('column inference detects coordinates/time and selects a numeric scientific value',()=>{
  const table=parseCSV('Longitude,Latitude,Date,label,Temperature\n10,30,2020,name,0\n11,31,2021,name,25');
  assert.deepEqual(inferColumns(table),{lon:'Longitude',lat:'Latitude',time:'Date',value:'Temperature'});
});

test('grids preserve zero, null and sparse cells; rows are north-to-south and ranges span all years',()=>{
  const table=basic([['0','10','0','2023'],['1','11','20','2023'],['0','11','null','2023'],['0','10','-10','2012'],['1','11','5','2012']]);
  const {manifest,grids}=createGridDataset(table,columns);
  assert.deepEqual(manifest.frames.map(f=>f.timeLabel),['2012','2023']);
  assert.deepEqual(manifest.frames.map(f=>f.timestamp),[null,null]);
  assert.deepEqual(grids,[[null,5,-10,null],[null,20,0,null]]);
  assert.deepEqual(manifest.geo.extent,[9.5,-.5,11.5,1.5]);
  assert.deepEqual(manifest.geo.gridCenters,{lon:[10,11],lat:[1,0]});
  assert.deepEqual(manifest.actualRange,{min:-10,max:20});assert.equal(manifest.valueScale.min,-10);assert.equal(manifest.valueScale.max,20);
  assert.equal(manifest.feature.unit,'metres');
});

test('ISO timestamps sort by actual instant, including different timezone offsets',()=>{
  const table=basic([['0','10','1','2024-01-01T01:00:00+02:00'],['1','11','2','2023-12-31T23:30:00Z']]);
  const result=createGridDataset(table,columns);
  assert.deepEqual(result.manifest.frames.map(f=>f.timestamp),['2023-12-31T23:00:00.000Z','2023-12-31T23:30:00.000Z']);
  assert.throws(()=>createGridDataset(basic([['0','10','1','2024-02-30T00:00:00Z'],['1','11','2','2024-01-01T00:00:00Z']]),columns),/Invalid ISO/);
});

test('calendar-date labels and undated data never invent exact timestamps or units',()=>{
  const table=basic([['0','10','3','2024-01-02'],['1','11','3','2024-01-01']]);
  const result=createGridDataset(table,{...columns,unit:''});
  assert.deepEqual(result.manifest.frames.map(f=>f.timeLabel),['2024-01-01','2024-01-02']);
  assert.ok(result.manifest.frames.every(f=>f.timestamp===null));assert.equal(result.manifest.feature.unit,'source units unspecified');
  assert.deepEqual(result.manifest.actualRange,{min:3,max:3});assert.equal(result.manifest.valueScale.min,2.5);assert.equal(result.manifest.valueScale.max,3.5);
  const undated=createGridDataset(table,{...columns,time:''});assert.equal(undated.manifest.frames[0].timeLabel,'Undated grid');
});

test('explicit numeric no-data markers match equivalent numeric strings without losing real zeros',()=>{
  const table=basic([['0','10','-9999.0','2020'],['1','11','0','2020']]);
  const result=createGridDataset(table,{...columns,noData:'-9999'});
  assert.deepEqual(result.grids[0],[null,0,null,null]);assert.equal(result.manifest.actualRange.min,0);
});

test('invalid coordinates, nonfinite values, irregular axes, duplicate cells and all-missing data are rejected',()=>{
  const build=rows=>createGridDataset(basic(rows),columns);
  assert.throws(()=>build([['91','10','1','2020'],['1','11','2','2020']]),/bounds/);
  assert.throws(()=>build([['0','181','1','2020'],['1','11','2','2020']]),/bounds/);
  assert.throws(()=>build([['0','10','Infinity','2020'],['1','11','2','2020']]),/finite/);
  assert.throws(()=>build([['0','10','NaN','2020'],['1','11','2','2020']]),/finite/);
  assert.throws(()=>build([['0','10','1','2020'],['1','11','2','2020'],['3','12','3','2020']]),/regular grid/);
  assert.throws(()=>build([['0','10','1','2020'],['1','11','2','2020'],['0','10','','2020']]),/duplicate/);
  assert.throws(()=>build([['0','10','','2020'],['1','11','null','2020']]),/no valid/);
  assert.throws(()=>build([['0','10','1','2020'],['0','11','2','2020']]),/two distinct latitude/);
});

test('world-edge centers retain actual axes while geographic extent clips to the world',()=>{
  const result=createGridDataset(basic([['-90','-180','1','2020'],['90','180','2','2020']]),columns);
  assert.deepEqual(result.manifest.geo.extent,[-180,-90,180,90]);
  assert.deepEqual(result.manifest.geo.gridCenters,{lon:[-180,180],lat:[90,-90]});
});

test('sparse input cannot allocate an oversized full grid across coordinates and dates',()=>{
  const rows=Array.from({length:1420},(_,i)=>[String(i/10-71),String(i/10-71),'1','2020']);
  assert.throws(()=>createGridDataset(basic(rows),columns),/two-million-cell/);
});

test('equivalent timestamp offsets share one frame and duplicates use canonical time',()=>{
  const rows=[['0','10','1','2024-01-01T01:00:00+01:00'],['1','11','2','2024-01-01T00:00:00Z']];
  const result=createGridDataset(basic(rows),columns);
  assert.equal(result.manifest.frames.length,1);assert.equal(result.manifest.frames[0].timestamp,'2024-01-01T00:00:00.000Z');
  rows.push(['0','10','3','2024-01-01T00:00:00Z']);assert.throws(()=>createGridDataset(basic(rows),columns),/duplicate/);
});
