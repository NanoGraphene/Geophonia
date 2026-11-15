export function wavBytes(samples,rate){
 if(!Number.isFinite(rate)||rate<8000||!samples?.length)throw new Error('Engine returned empty or invalid audio');
 const buffer=new ArrayBuffer(44+samples.length*2),v=new DataView(buffer);const str=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
 str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
 let peak=0;for(let i=0;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw new Error('Engine returned non-finite audio');const x=Math.max(-1,Math.min(1,samples[i]));peak=Math.max(peak,Math.abs(x));v.setInt16(44+i*2,x<0?x*32768:x*32767,true);}if(peak===0)throw new Error('Engine returned silent audio');return buffer;
}
