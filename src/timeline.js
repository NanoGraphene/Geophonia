export function timeLabel(timestamp) {
 return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(timestamp))+' UTC';
}
export function timeStep(index, key, count) {
 const wanted=key==='Home'?0:key==='End'?count-1:index+(key==='ArrowLeft'?-1:1);
 return Math.max(0,Math.min(count-1,wanted));
}
// Shared by dataset and temporal selection: newest request owns every commit/failure.
export class FrameSelection {
 constructor(load){this.load=load;this.serial=0;this.target={dataset:null,index:0};}
 async select(dataset,index,{pending,commit,failed}) {
  const serial=++this.serial;this.target={dataset,index};pending?.(this.target);
  try {const source=await this.load(dataset,index);if(serial!==this.serial)return 'stale';commit(source);return 'committed';}
  catch(error){if(serial!==this.serial)return 'stale';failed(error);return 'failed';}
 }
}
export function createFrameCache(load,limit=4){
 const cache=new Map();
 return (id,index=0)=>{
  const key=`${id}:${index}`;
  if(cache.has(key)){const promise=cache.get(key);cache.delete(key);cache.set(key,promise);return promise;}
  const promise=Promise.resolve().then(()=>load(id,index)).catch(error=>{if(cache.get(key)===promise)cache.delete(key);throw error;});
  cache.set(key,promise);while(cache.size>limit)cache.delete(cache.keys().next().value);return promise;
 };
}
