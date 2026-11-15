export function stepFrame(index,direction,count) {
  if(count<1)return 0;
  return Math.max(0,Math.min(count-1,index+direction));
}
// In-flight requests are shared; failed entries can be retried and memory stays bounded.
export function frameCache(load,limit=4) {
  const entries=new Map();
  return (id,index=0)=>{
    const key=`${id}:${index}`;
    if(entries.has(key)){const cached=entries.get(key);entries.delete(key);entries.set(key,cached);return cached;}
    const promise=Promise.resolve().then(()=>load(id,index)).catch(error=>{if(entries.get(key)===promise)entries.delete(key);throw error;});
    entries.set(key,promise);while(entries.size>limit)entries.delete(entries.keys().next().value);
    return promise;
  };
}
export function keyboardCommand(event,{timeline=false,editing=false,otherRange=false,speech=true}={}) {
  if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||editing||otherRange)return null;
  if(['1','2','3'].includes(event.key)&&!event.repeat)return speech?['place','value','date'][Number(event.key)-1]:null;
  if(event.shiftKey)return null;
  if(event.key==='ArrowLeft')return 'previous';
  if(event.key==='ArrowRight')return 'next';
  if(timeline&&event.key==='Home')return 'first';
  if(timeline&&event.key==='End')return 'last';
  return null;
}
