export type Publication={published:string|null;published_precision?:string;id?:string;title?:string;url?:string};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function publicationPeriod(label:string){
 const text=label.replace(/\s+/g,' ').trim();const match=text.match(/^([a-z]+)\.?\s+((?:19|20)\d{2})$/i);
 if(match){const month=months.findIndex(m=>m.toLowerCase().startsWith(match[1].toLowerCase()));if(month>=0)return {published:`${match[2]}-${String(month+1).padStart(2,'0')}-01T00:00:00.000Z`,published_precision:'month'};}
 if(/^(19|20)\d{2}$/.test(text))return {published:text+'-01-01T00:00:00.000Z',published_precision:'year'};
 return null;
}
export function publicationPrecision(post:Publication){return !post.published?'unknown':['month','year'].includes(post.published_precision||'')?post.published_precision!:'day';}
export function formatPublicationDate(post:Publication,short=false){
 const precision=publicationPrecision(post);if(precision==='unknown')return 'Date unavailable';
 const d=new Date(post.published!);if(!Number.isFinite(d.getTime()))return 'Date unavailable';
 return d.toLocaleDateString('en-US',{timeZone:'UTC',...(precision==='year'?{year:'numeric' as const}:precision==='month'?{month:short?'short' as const:'long' as const,year:'numeric' as const}:{month:short?'short' as const:'long' as const,day:'numeric' as const,...(short?{}:{year:'numeric' as const})})});
}
export function publicationDateTitle(post:Publication){const precision=publicationPrecision(post);return precision==='month'?'Publisher supplies a publication month; exact day is unavailable.':precision==='year'?'Publisher supplies a publication year; exact month and day are unavailable.':precision==='unknown'?'Publication date unavailable; ingestion time is not used for ordering.':'Publisher publication date';}
export function comparePublication(a:Publication,b:Publication,direction:'newest'|'oldest'='newest'){
 const first=a.published?Date.parse(a.published):NaN,second=b.published?Date.parse(b.published):NaN;
 if(!Number.isFinite(first)&&Number.isFinite(second))return 1;if(Number.isFinite(first)&&!Number.isFinite(second))return -1;
 return (Number.isFinite(first)&&Number.isFinite(second)?(first-second)*(direction==='oldest'?1:-1):0)||(a.title||a.url||a.id||'').localeCompare(b.title||b.url||b.id||'');
}
export function publicationGroup(post:Publication){return post.published?formatPublicationDate(post):'Publication date unavailable';}
