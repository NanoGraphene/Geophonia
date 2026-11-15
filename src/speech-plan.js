import { measurementValue } from './narration-text.js';
const YEARS=new Set([2007,2012,2018,2020,2021,2022,2023,2025,2026]);
const SMALL=['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19'];
function integer(value) {
  if(value<20)return ['number:'+SMALL[value]];
  if(value<100)return ['number:'+Math.floor(value/10)*10,...(value%10?integer(value%10):[])];
  for(const [size,name]of [[1e9,'billion'],[1e6,'million'],[1000,'thousand'],[100,'hundred']])if(value>=size)return [...integer(Math.floor(value/size)),'phrase:'+name,...(value%size?integer(value%size):[])];
  return [];
}
export function numberPlan(value,decimals=2,significantDigits) {
  if(!Number.isFinite(value))return ['phrase:noValue'];
  const rounded=significantDigits?Number(value.toPrecision(significantDigits)):Number(value.toFixed(Math.min(10,Math.max(0,decimals))));
  const text=Math.abs(rounded).toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:10});
  const [whole,fraction]=text.split('.');
  const words=Number(whole)<1e12?integer(Number(whole)):[...whole].map(d=>'number:'+d);
  return [...(rounded<0?['phrase:minus']:[]),...words,...(fraction?['phrase:point',...[...fraction].map(d=>'number:'+d)]:[])];
}
const UNITS={
  'degrees celsius':'celsius','degree celsius':'celsius','celsius':'celsius','°c':'celsius',
  'micrograms per cubic meter':'micrograms','µg/m³':'micrograms','μg/m³':'micrograms','ug/m3':'micrograms',
  'parts per billion by volume':'ppb','parts per billion':'ppb','ppbv':'ppb','ppb':'ppb',
  'parts per million':'ppm','ppm':'ppm','ppmv':'ppm',
  'percent image brightness':'brightness','percent visual color strength':'color','percent visual yellow-mark brightness':'lightning','percent visual yellow mark brightness':'lightning',
  'meters':'meters','meter':'meters','metres':'meters','m':'meters','kilometers':'kilometers','kilometres':'kilometers','km':'kilometers','percent':'percent','%':'percent',
  'source units unspecified':'unspecified','':'unspecified','demo units':'demo'
};
export function spellingPlan(text) {
  const clean=String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const tokens=[];
  for(const c of clean) {
    if(/[a-z]/.test(c))tokens.push('letter:'+c);
    else if(/[0-9]/.test(c))tokens.push('number:'+c);
    else if(c==='/')tokens.push('phrase:per');
    else if(c==='-')tokens.push('phrase:minus');
    else if(c==='.')tokens.push('phrase:point');
    else if(c==='°')tokens.push('letter:°');
    else if(c==='µ'||c==='μ')tokens.push('letter:µ');
    else if(c==='%')tokens.push('unit:percent');
  }
  return tokens.length?tokens:['unit:unspecified'];
}
export function unitPlan(unit='') {
  const known=UNITS[unit.trim().toLowerCase()];
  return known?['unit:'+known]:spellingPlan(unit);
}
function yearPlan(year) {
  if(YEARS.has(year))return ['year:'+year];
  if(year>=2010&&year<=2099)return [...integer(Math.floor(year/100)),...integer(year%100)];
  if(year>=1900&&year<=1999)return ['number:19',...(year%100?integer(year%100):['phrase:hundred'])];
  return integer(year);
}
function dateParts(year,month,day) {return ['ordinal:'+day,'month:'+month,...yearPlan(year)];}
export function readingPlan(kind,{state={},manifest,frame,place,placeStatus='ready'}={}) {
  if(kind==='test')return ['phrase:test'];
  if(kind==='place') {
    if(place?.name)return ['place:'+place.name];
    const prefix=placeStatus==='loading'?'namesLoading':placeStatus==='error'?'namesUnavailable':'unmapped';
    if(!state.location)return ['phrase:'+prefix];
    return ['phrase:'+prefix,...numberPlan(Math.abs(state.location.lat),2),'phrase:degrees','phrase:'+(state.location.lat<0?'south':'north'),...numberPlan(Math.abs(state.location.lon),2),'phrase:degrees','phrase:'+(state.location.lon<0?'west':'east')];
  }
  if(state.validity==='load-error')return ['phrase:loadError'];
  if(kind==='value') {
    if(!state.sample)return ['phrase:loading'];
    const value=measurementValue(state.sample,manifest);
    if(value===null)return ['phrase:'+(state.sample.validity==='outside-coverage'?'outside':'noValue')];
    const scale=manifest.valueScale??{},category=manifest.feature?.categories?.find(c=>c.id===state.variable);
    return [...(category?['category:'+category.id]:[]),...(manifest.feature?.estimate===false?[]:['phrase:approximately']),...numberPlan(value,scale.decimals??0,scale.significantDigits),...unitPlan(scale.unit??manifest.feature?.unit)];
  }
  if(!frame)return ['phrase:loading'];
  if(frame.timestamp&&Number.isFinite(Date.parse(frame.timestamp))) {
    const date=new Date(frame.timestamp),hour=date.getUTCHours(),minute=date.getUTCMinutes();
    return [...dateParts(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()),'phrase:at',...integer(hour),...(minute===0?['phrase:oclock']:minute<10?['phrase:oh',...integer(minute)]:integer(minute)),'phrase:utc'];
  }
  if(Number.isInteger(frame.year))return [...yearPlan(frame.year),...(/annual average/i.test(frame.timeLabel)?['phrase:annualAverage']:[])];
  if(Number.isInteger(frame.originalFrame)&&/unverified/i.test(frame.timeLabel??''))return ['phrase:animationFrame',...integer(frame.originalFrame),'phrase:dateUnverified'];
  const label=frame.timeLabel??'';
  if(/^\d{4}$/.test(label))return yearPlan(Number(label));
  const calendar=/^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  if(calendar&&Number(calendar[2])>=1&&Number(calendar[2])<=12&&Number(calendar[3])>=1&&Number(calendar[3])<=31)return dateParts(Number(calendar[1]),Number(calendar[2]),Number(calendar[3]));
  return !label||/undated/i.test(label)?['phrase:noDate']:['phrase:period',...spellingPlan(label)];
}
