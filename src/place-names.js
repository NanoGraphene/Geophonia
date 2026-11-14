// Natural Earth polygons are cut at the antimeridian; retain holes and boundary points.
export function ringContains([x,y], ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,ay]=ring[j], [bx,by]=ring[i];
    const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<1e-10 && x>=Math.min(ax,bx)-1e-10 && x<=Math.max(ax,bx)+1e-10 && y>=Math.min(ay,by)-1e-10 && y<=Math.max(ay,by)+1e-10) return true;
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
export function createPlaceLookup({regions}) {
  const priority=r=>r.kind==='lakes'?0:r.kind==='countries'?1:r.type==='ocean'?3:2;
  const area=r=>(r.bounds[2]-r.bounds[0])*(r.bounds[3]-r.bounds[1]);
  const ordered=[...regions].sort((a,b)=>priority(a)-priority(b)||area(a)-area(b));
  return ({lon,lat})=>{
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90) return null;
    const x=lon===180?180:((lon+180)%360+360)%360-180;
    for(const region of ordered) {
      const [left,bottom,right,top]=region.bounds;
      if(x<left||x>right||lat<bottom||lat>top) continue;
      if(ringContains([x,lat],region.rings[0])&&!region.rings.slice(1).some(hole=>ringContains([x,lat],hole))) {
        const name=region.kind==='lakes'&&!/\blake\b|\bsea\b|\blago\b|\blac\b|\bloch\b/i.test(region.name)?`Lake ${region.name}`:region.name;
        return {name,kind:region.kind};
      }
    }
    return null;
  };
}
export async function loadPlaceNames(fetcher=fetch) {
  const metadata=await fetcher('./geography/place-names-manifest.json');
  if(!metadata.ok) throw new Error('Place-name metadata could not load.');
  const manifest=await metadata.json();
  const response=await fetcher(manifest.url);
  if(!response.ok) throw new Error('Place names could not load.');
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==manifest.sha256) throw new Error('Place-name integrity check failed.');
  return createPlaceLookup(JSON.parse(new TextDecoder().decode(bytes)));
}
