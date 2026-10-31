import { marked } from 'marked';
import * as cheerio from 'cheerio/slim';
import { publicUrl } from './public-url.ts';

export type ReaderSnapshot={url:string;title:string;description:string;markdown:string;metadata:Record<string,any>;fetchedAt:string;provider?:string};
export type CollectionSession={readerRemaining:number;snapshots:Map<string,Promise<ReaderSnapshot>>;jinaApiKey?:string};
export const collectionSession=(options:{jinaApiKey?:string}={}):CollectionSession=>({readerRemaining:options.jinaApiKey?28:16,snapshots:new Map(),jinaApiKey:options.jinaApiKey});
const backoff=new Map<string,number>();

export async function boundedText(response:Response,limit=4_000_000){
  const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Collection response exceeded the 4 MB limit.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(bytes);
}
export function accessPage(title:string,content:string){
  return /^(just a moment|access denied|attention required|robot check|sign in to continue|security verification|verify you are human|page not found|404\b|application error|internal server error|service unavailable)|^something went wrong(?:\s*[|—–-]|$)|^not found$/i.test(title.trim())||content.length<2000&&/^(?:[\s#*>_-]*)(?:checking your browser|verify you are human|enable javascript and cookies to continue|you have been blocked)/i.test(content.trim());
}
export function readSnapshotPayload(payload:any,requested:string):ReaderSnapshot{
  const d=payload?.data;
  if(payload?.code!==200||!d||typeof d.content!=='string'||d.httpStatus>=400)throw new Error('Reader did not return a readable publisher page.');
  const url=publicUrl(d.finalUrl||d.url||requested);
  if(accessPage(String(d.title||''),d.content))throw new Error('Reader returned an access page, not publisher content.');
  if(d.content.trim().length<60)throw new Error('Reader returned too little content to use.');
  return {url,title:String(d.title||''),description:String(d.description||''),markdown:d.content,metadata:d.metadata||{},fetchedAt:new Date().toISOString()};
}
export function readBrowserPayload(payload:any,requested:string):ReaderSnapshot{
  if(payload?.success!==true||typeof payload.content!=='string')throw new Error('Browser reader did not return publisher content.');
  const front=payload.content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);const metadata:Record<string,string>={};
  if(front)for(const line of front[1].split('\n')){const m=line.match(/^\s*(?:"([^"]+)"|([\w:]+)):\s*("(?:\\.|[^"\\])*")\s*$/);if(m)try{metadata[m[1]||m[2]]=JSON.parse(m[3]);}catch{}}
  const title=metadata['og:title']||String(payload.title||'').split(/\s+\|\s+/)[0];
  const markdown=payload.content.slice(front?.[0].length||0);
  if(accessPage(title,markdown)||markdown.trim().length<60)throw new Error('Browser reader returned an access screen or too little content.');
  return {url:publicUrl(payload.url||requested),title,description:metadata.description||metadata['og:description']||'',markdown,metadata,fetchedAt:new Date().toISOString(),provider:'markdown.new'};
}
export async function readerSnapshot(raw:string,session=collectionSession()):Promise<ReaderSnapshot>{
  const url=publicUrl(raw),cached=session.snapshots.get(url);if(cached)return cached;
  if(session.readerRemaining<=0)throw new Error('Reader budget for this check reached; remaining posts will be retried.');
  session.readerRemaining--;
  const pending=(async()=>{
    // Only the public publisher URL is sent. Never forward Site credentials,
    // browser cookies or caller-supplied request headers to the reader service.
    const errors:string[]=[];
    for(const provider of ['Jina','markdown.new']){
      const bucket=provider==='Jina'&&session.jinaApiKey?'Jina:authenticated':provider;
      if(Date.now()<(backoff.get(bucket)||0)){errors.push(provider+' is rate limited');continue;}
      try{
        const jinaHeaders:Record<string,string>={Accept:'application/json','X-Cache-Tolerance':'300'};
        if(session.jinaApiKey)jinaHeaders.Authorization='Bearer '+session.jinaApiKey;
        const response=await fetch(provider==='Jina'?'https://r.jina.ai/'+url:'https://markdown.new/',provider==='Jina'?{headers:jinaHeaders,redirect:'manual',signal:AbortSignal.timeout(50000)}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,method:'browser',retain_images:true}),redirect:'manual',signal:AbortSignal.timeout(50000)});
        if(response.status===429){const raw=response.headers.get('retry-after'),numeric=Number(raw);const retry=raw&&Number.isFinite(numeric)?numeric:raw?(new Date(raw).getTime()-Date.now())/1000:60;backoff.set(bucket,Date.now()+Math.max(60,Math.min(3600,Number.isFinite(retry)?retry:60))*1000);throw new Error('rate limited (HTTP 429)');}
        if(!response.ok)throw new Error('HTTP '+response.status);
        const payload=JSON.parse(await boundedText(response));
        return provider==='Jina'?{...readSnapshotPayload(payload,url),provider}:readBrowserPayload(payload,url);
      }catch(e:any){errors.push(provider+': '+e.message);}
    }
    throw new Error('Reader recovery failed: '+errors.join('; '));
  })();
  session.snapshots.set(url,pending);return pending;
}
export const escapeHtml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function snapshotHtml(snapshot:ReaderSnapshot){
  const meta=Object.entries(snapshot.metadata).filter(([k,v])=>/^(article:published_time|datePublished|author|description|og:description)$/.test(k)&&typeof v==='string').map(([k,v])=>`<meta name="${escapeHtml(k)}" content="${escapeHtml(v)}">`).join('');
  // Parsed solely for extraction in Cheerio. This HTML is never sent to a browser
  // or inserted into the product DOM; publisher scripts are never executed here.
  const $=cheerio.load('<body>'+marked.parse(snapshot.markdown,{async:false})+'</body>');
  const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');const expected=normalize(snapshot.title);
  const heading=$('h1,h2').filter((_,el)=>normalize($(el).text())===expected).first();
  if(heading.length){let block=heading;while(block.parent().length&&block.parent()[0].tagName!=='body')block=block.parent();block.prevAll().remove();}
  const children=$('body').children().toArray();
  const navLabel=/^(research|latest advancements|company|support|more|terms\s*(?:&|and)\s*policies|api platform|developers|business|products|safety)$/i;
  const navGroup=(i:number)=>{const el=$(children[i]),next=$(children[i+1]);return /^(p|h[2-6])$/.test(children[i]?.tagName||'')&&navLabel.test(el.text().trim())&&next.is('ul,ol')&&next.find('a').length>=2;};
  for(let i=1;i<children.length;i++){
    const el=$(children[i]);const loadMore=el.is('p')&&/^load more$/i.test(el.text().trim());
    if(loadMore||navGroup(i)&&children.slice(i+2,i+12).filter((_,n)=>navGroup(i+2+n)).length>=2){el.nextAll().remove();el.remove();break;}
  }
  return meta+`<main><h1>${escapeHtml(snapshot.title)}</h1>`+$('body').html()+'</main>';
}

export function publisherBoilerplate(text:string){return /working to advance and democratize|research lab and product company|we are a research lab|we.re on a journey to advance|^A Blog post by .+ on Hugging Face$|^Anthropic is an AI safety and research company|^Physical Intelligence is bringing general-purpose AI|^The latest (?:news|research) from/i.test(text);}
