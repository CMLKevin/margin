import * as cheerio from 'cheerio/slim';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { publicUrl } from './public-url.ts';
import { collectionSession, readerSnapshot, snapshotHtml, escapeHtml, boundedText, accessPage, type CollectionSession, type ReaderSnapshot } from './reader.ts';
export {publicUrl} from './public-url.ts';
export {collectionSession} from './reader.ts';
import defaultSources from '../sources/defaults.json' with {type:'json'};
export const starterSources = defaultSources.sources;
const xml = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',removeNSPrefix:true});
const xmlBuilder = new XMLBuilder({ignoreAttributes:false,attributeNamePrefix:'@_'});
const arr = (x:any):any[] => x == null ? [] : Array.isArray(x) ? x : [x];
const str = (x:any):string => typeof x === 'object' ? String(x?.['#text'] ?? '') : String(x ?? '');
const articlePath = /\/(blog|articles|field-notes|data-insights|gradient-updates|research|engineering|post|posts|reports|publications|latest|news|journal|insights|writing)\/.+/;
const utilityPath = /\/(tags?|category|categories|authors?|topics|teams?|careers|about|privacy|legal|contact|data|page)(\/|$)/i;
const sameHost = (a:URL,b:URL) => a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'');
const scopeParams=(url:URL)=>[...url.searchParams.entries()].filter(([key])=>!/^(p|page|offset|cursor|sort|order|per_page|limit)$/i.test(key));
const keepsScope=(target:URL,source:URL)=>scopeParams(source).every(([key,value])=>target.searchParams.getAll(key).includes(value));
const publisherHost = (a:URL,b:URL) => sameHost(a,b)||a.hostname.endsWith('.'+b.hostname.replace(/^www\./,''));
function articleUrl(raw:string,base:string) {
  const url=publicUrl(raw,base),u=new URL(url),origin=new URL(base);
  if(!publisherHost(u,origin)||sameHost(u,origin)&&u.pathname.replace(/\/$/,'')===origin.pathname.replace(/\/$/,'')||utilityPath.test(u.pathname)||/\.(pdf|png|jpe?g|webp|gif|svg|zip|xml|mp4)$/i.test(u.pathname)||u.searchParams.has('page')||u.searchParams.has('category'))return null;
  return url;
}
function ordered(entries:any[]) {
  const seen=new Set();return entries.filter(e=>{const key=e.url.replace(/\/$/,'');if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.published&&b.published?b.published.localeCompare(a.published):a.published?-1:b.published?1:0).slice(0,1500);
}
export async function fetchPage(raw:string) {
  let url=publicUrl(raw);
  for(let i=0;i<5;i++) {
    const r=await fetch(url,{headers:{'User-Agent':'MarginResearch/1.0 (+source monitoring)','Accept':'text/html, application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9'},redirect:'manual',signal:AbortSignal.timeout(18000)});
    if(r.status>=300 && r.status<400 && r.headers.get('location')) {url=publicUrl(r.headers.get('location')!,url);continue;}
    if(!r.ok) throw new Error(`Publisher returned HTTP ${r.status}.${r.status===429?' Rate limited; retry on a later check.':r.status===403?' Browser access may be required.':''}`);
    const html=await boundedText(r);
    if(/<title[^>]*>\s*(Just a moment|Access denied|Attention Required|Robot Check|Sign in to continue)/i.test(html))throw new Error('Publisher returned a browser challenge or access page; article text was not captured.');
    return {html,url,headers:r.headers};
  }
  throw new Error('Too many publisher redirects.');
}
function cleanText(s:string) {const $=cheerio.load(s);$('script,style,nav,footer,header,form,noscript').remove();return $.root().text().replace(/\s+/g,' ').trim();}
function date(s:any) {const value=str(s).trim();if(!value||/^\d{1,4}$/.test(value))return null;const d = new Date(value.replace(/(\d)(st|nd|rd|th)\b/gi,'$1'));return Number.isFinite(d.getTime())?d.toISOString():null;}
function visibleDate(text:string) {
  const iso=text.match(/\b(20\d{2})[.\/-](\d{2})[.\/-](\d{2})\b/);if(iso)return date(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const short=text.match(/\b(\d{2})\.(\d{2})\.(\d{2})(?!\d)/);if(short)return date(`20${short[3]}-${short[1]}-${short[2]}`);
  const written=text.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}(?!\d)/i);
  return written?date(written[0]+' UTC'):null;
}
export function topics(text:string) {
  const rules:[string,RegExp][]=[['Reinforcement learning',/\bRL\b|reinforcement|reward|post.train/i],['Evaluation',/benchmark|evaluat|grader|terminal.bench/i],['Continual learning',/continual|forget|gradient step|iteratively/i],['Inference',/inference|latency|serving|intelligence density/i],['Compute',/comput|chip|data.center|GPU|scaling/i],['Agents',/agent|long.horizon|decision|tool.use/i],['Safety',/safety|alignment|exploit|security|cheat|reward.hack/i]];
  return rules.filter(([,r])=>r.test(text)).map(([t])=>t).slice(0,4);
}
export function feedEntries(body:string,base:string):any[] {
  try {
    const safely=(items:any[],convert:(i:any)=>any)=>ordered(items.slice(0,2000).flatMap(i=>{try{const e=convert(i);return e.title&&e.url?[{...e,fromFeed:true}]:[];}catch{return [];}}));
    if(body.trim().startsWith('{')){const j=JSON.parse(body);if(!Array.isArray(j.items))return [];return safely(j.items,i=>({url:publicUrl(i.url||i.external_url,base),title:cleanText(i.title||''),summary:cleanText(i.summary||i.content_html||i.content_text||'').slice(0,600),feedContent:i.content_html||i.content_text||'',feedContentType:i.content_html?'html':'text',published:date(i.date_published||i.date_modified),author:arr(i.authors||i.author).map(a=>a.name).filter(Boolean).join(', '),categories:arr(i.tags).map(str)}));}
    const j=xml.parse(body);const items=j.rss?.channel?.item ?? j.feed?.entry ?? j.RDF?.item;
    const feedText=(v:any)=>v?.['@_type']==='xhtml'?xmlBuilder.build(v):str(v);
    return safely(arr(items),i=>{const link=typeof i.link==='string'?i.link:arr(i.link).find(l=>(!l['@_rel']||l['@_rel']==='alternate')&&(!l['@_type']||/html/.test(l['@_type'])))?.['@_href'];const full=feedText(i.encoded||i.content);const entryBase=i['@_base']||j.feed?.['@_base'];return {url:publicUrl(link||str(i.guid),entryBase?publicUrl(entryBase,base):base),title:cleanText(feedText(i.title)),summary:cleanText(feedText(i.description||i.summary||full)).slice(0,600),feedContent:full,feedContentType:i.content?.['@_type']==='text'?'text':'html',published:date(i.pubDate||i.published||i.updated||i.date),author:str(i.creator||i.author?.name||i.author),categories:arr(i.category).map(c=>str(c)||c['@_term']).filter(Boolean)};});
  }catch{return [];}
}
export function htmlEntries(html:string,base:string,scoped=false):any[] {
  const $=cheerio.load(html);$('nav,header,footer,[role="navigation"]').remove();if(scoped)$('aside,[role="complementary"]').remove();const origin=new URL(base);const prefix=origin.pathname.replace(/\/$/,'');const out=new Map();
  $('a[href]').each((_,el)=>{
    const a=$(el);let url:string;try{url=publicUrl(a.attr('href')!,base);}catch{return;}
    if(!articleUrl(url,base))return;const u=new URL(url);if(/^\/publications\/?$/.test(u.pathname))return;
    const card=a.closest('article,li,[class*="card"],[class*="Card"]');
    const label=a.text().replace(/\s+/g,' ').trim();
    const published=date(a.find('time[datetime]').first().attr('datetime')||card.find('time[datetime]').first().attr('datetime'))||visibleDate(label)||visibleDate(card.text().slice(0,1000));
    const contextual=!!a.find('h1,h2,h3,h4,h5,h6,[role="heading"],[data-title],.h1,.h2,.h3,.h4,.h5,.h6,[class*="heading"],[class*="Heading"]').length || !!a.closest('article').length || !!published&&articlePath.test(u.pathname);
    const section=prefix && prefix!=='/latest' && prefix!=='/' ? u.pathname.startsWith(prefix+'/') : /\/(blog|articles|field-notes|data-insights|gradient-updates|research|post|reports|publications|latest)\/.+/.test(u.pathname);
    if(!section && !(contextual&&(articlePath.test(u.pathname)||published)))return;
    const imageTitle=a.find('img[alt]').first().attr('alt');
    const title=(a.find('h1,h2,h3,h4,h5,h6,[role="heading"],[class*="title"],[class*="Title"],[data-title],.h1,.h2,.h3,.h4,.h5,.h6,[class*="heading"],[class*="Heading"]').first().text()||a.find('[title]').first().attr('title')||a.attr('aria-label')||(imageTitle&&imageTitle.length>5&&label.includes(imageTitle)?imageTitle:'')||label).replace(/\s+/g,' ').trim();
    if(title.length<4||/^(continue reading|read more|all posts|learn more|view all|next page)/i.test(title))return;
    if(!published&&/^(all|publications?|conclusions?|milestones?|releases?|research|blog|news|company|products?)$/i.test(title))return;
    const old=out.get(url);if(!old)out.set(url,{url,title:title.slice(0,250),published});else if(!old.published&&published)out.set(url,{...old,published});
  });
  // Read structured hydration data as data only; never execute publisher scripts.
  const prefixCounts=new Map<string,number>();for(const e of out.values()){const p=new URL(e.url).pathname.split('/').slice(0,-1).join('/');prefixCounts.set(p,(prefixCounts.get(p)||0)+1);}const inferredPrefix=[...prefixCounts].sort((a,b)=>b[1]-a[1]).find(([,n])=>n>=2)?.[0]||prefix;
  const visit=(v:any,depth=0)=>{if(depth>30||!v||typeof v!=='object')return;
    const type=arr(v['@type']);const structured=type.some(t=>/Article|BlogPosting|ListItem|TechArticle/.test(t));
    const path=typeof v.url==='string'?v.url:structured&&typeof v['@id']==='string'?v['@id']:typeof v.slug==='string'&&prefix&&prefix!=='/latest'&&!v.slug.includes('/')?inferredPrefix+'/'+v.slug:null;
    const title=v.title||(structured&&(v.headline||v.name));
    if(path&&typeof title==='string'&&title.length>=4){try{const visible=typeof v.url!=='string'?[...out.values()].find(e=>e.title.trim().toLowerCase()===cleanText(title).toLowerCase()):null;const url=visible?.url||articleUrl(path,base);if(url&&(!scoped||out.has(url))&&(out.has(url)||articlePath.test(new URL(url).pathname)||structured)){const old=out.get(url);out.set(url,{...old,url,title:cleanText(title).slice(0,250),published:date(v.publishedAt||v.datePublished||v.date)||old?.published,summary:cleanText(str(v.description||v.summary)),author:str(v.authorName)||arr(v.authors||v.author).map(a=>typeof a==='string'?a:a.name).filter(Boolean).join(', ')});}}catch{}}
    for(const child of Object.values(v))if(typeof child==='object')visit(child,depth+1);};
  $('script').each((_,el)=>{const s=$(el).text();try{visit(JSON.parse(s));}catch{}const m=s.match(/self\.__next_f\.push\((\[.*\])\)/s);if(m){try{const text=JSON.parse(m[1])[1];if(typeof text==='string')for(const line of text.split('\n')){try{visit(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}}}catch{}}});
  const unpack=(v:any):any=>{if(Array.isArray(v)&&typeof v[0]==='number'){if(v[0]===1)return arr(v[1]).map(unpack);return unpack(v[1]);}if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,val])=>[k,unpack(val)]));return v;};
  $('astro-island[props]').each((_,el)=>{try{visit(unpack(JSON.parse($(el).attr('props')!)));}catch{}});
  return ordered([...out.values()]).slice(0,300);
}
export function readerEntries(snapshot:ReaderSnapshot,base:string){
  const $=cheerio.load(snapshotHtml(snapshot));const blocks=$('main').children().toArray();const cards:string[]=[];
  for(let i=0;i<blocks.length;i++){
    const block=$(blocks[i]);
    const nearby=blocks.slice(Math.max(0,i-2),i).reverse().map(el=>$(el).text()).join(' ');
    block.find('a[href]').each((_,el)=>{const a=$(el);const label=a.text().trim();if(!label||a.find('img').length)return;
      const context=a.closest('li').length?a.closest('li').text():block.text();const published=visibleDate(context)||visibleDate(nearby);
      try{const path=new URL(publicUrl(a.attr('href')!,base)).pathname,prefix=new URL(base).pathname.replace(/\/$/,'');if(!published&&(!prefix||!path.startsWith(prefix+'/')))return;}catch{return;}
      cards.push(`<article>${published?`<time datetime="${published}"></time>`:''}<a href="${escapeHtml(a.attr('href')!)}"><h3>${escapeHtml(label)}</h3></a></article>`);
    });
  }
  return htmlEntries(cards.join(''),base);
}
async function readerDiscovery(raw:string,session:CollectionSession):Promise<Discovery>{
  const snapshot=await readerSnapshot(raw,session),entries=readerEntries(snapshot,raw);
  if(!entries.length)throw new Error('Reader loaded the page but found no article links.');
  return {entries,method:'Reader discovery',feedUrl:null,name:snapshot.metadata['og:site_name']||snapshot.title||new URL(raw).hostname};
}
function hfTaggedPage(html:string,url:URL){
 const $=cheerio.load(html);let props:any;try{props=JSON.parse($('[data-target="Articles"][data-props]').attr('data-props')||'null');}catch{}
 const tag=url.searchParams.get('tag');if(!props||props.selectedTag!==tag||!Array.isArray(props.allBlogs))return {entries:[],next:null};
 const entries=props.allBlogs.flatMap((p:any)=>{try{if(!p.slug||!p.title)return [];return [{url:publicUrl('/blog/'+p.slug,url.href),title:cleanText(p.title),published:date(p.publishedAt),summary:cleanText(p.description||p.subtitle||''),author:arr(p.authorsData).map(a=>a.fullname||a.name).filter(Boolean).join(', ')}];}catch{return [];}});
 const next=$('a[href]').filter((_,e)=>/^next\s*[→›»]?$/i.test($(e).text().trim())).first().attr('href');return {entries,next};
}
async function huggingFaceTaggedEntries(html:string,url:URL){
 let current=hfTaggedPage(html,url);const entries=[...current.entries];let currentUrl=url;const visited=new Set([url.href]);
 for(let i=0;i<2&&current.next;i++){try{const next=new URL(publicUrl(current.next,currentUrl.href));if(!sameHost(next,url)||next.pathname!==url.pathname||!keepsScope(next,url)||visited.has(next.href))break;visited.add(next.href);const page=await fetchPage(next.href);current=hfTaggedPage(page.html,next);entries.push(...current.entries);currentUrl=next;}catch{break;}}
 return ordered(entries);
}
export type Discovery = {entries:any[];method:string;feedUrl:string|null;name:string|null;notice?:string};
export async function discover(raw:string,knownFeed?:string|null,session=collectionSession()):Promise<Discovery> {
  // This publisher's general news feed is reachable even when its research index
  // rejects server requests. Keep its narrower scope explicit on every refresh.
  const requested=new URL(publicUrl(raw));
  if(requested.hostname.replace(/^www\./,'')==='openai.com'&&/^\/research(?:\/index)?\/?$/.test(requested.pathname)){
    // Access varies by execution region. Prefer the actual index whenever it is
    // readable, and retry it on future checks even if RSS was previously used.
    try{const page=await fetchPage(raw);const entries=htmlEntries(page.html,page.url);if(entries.length)return {entries,method:'Research index',feedUrl:null,name:'OpenAI Research'};}catch{}
    try{return {...await readerDiscovery(raw,session),name:'OpenAI Research'};}catch{}
    const feed=await fetchPage('https://openai.com/news/rss.xml');
    const entries=feedEntries(feed.html,feed.url).filter(e=>e.categories.some((c:string)=>/^(research|publication)$/i.test(c)));
    if(!entries.length)throw new Error('OpenAI’s research index blocks server access, and its RSS feed currently exposes no research-category entries.');
    return {entries,method:'Research RSS subset',feedUrl:feed.url,name:'OpenAI Research',notice:'Limited coverage: Research and Publication categories from OpenAI’s news RSS, not the complete research index. Articles blocked by the publisher are shown as RSS excerpts.'};
  }
  const scoped=scopeParams(requested).length>0;
  let page;let accessError='';
  try{page=await fetchPage(!scoped&&knownFeed?knownFeed:raw);}catch(e:any){accessError=e.message;try{return await readerDiscovery(raw,session);}catch{}page={html:'',url:publicUrl(raw),headers:new Headers()};}
  let entries=feedEntries(page.html,page.url);
  if(entries.length)return {entries,method:page.html.trim().startsWith('{')?'JSON Feed':'RSS / Atom',feedUrl:page.url,name:null};
  const $=cheerio.load(page.html);const name=$('meta[property="og:site_name"]').attr('content')||$('title').text().split(/[|—–\\]|\s+-\s+/).map(s=>s.trim()).filter(s=>s&&!/^(blog|research|articles|latest|news|home|field notes)$/i.test(s)).pop()||new URL(raw).hostname.replace(/^www\./,'');
  const links=[...new Set([...$('link[type*="rss"],link[type*="atom"],link[type="application/feed+json"]').map((_,e)=>$(e).attr('href')).get(),...$('a[href]').filter((_,e)=>/\b(rss|atom|json feed)\b/i.test($(e).text().trim())||/\/(feed|rss|atom)(\.xml|\.json|\/)?$/.test($(e).attr('href')||'')).map((_,e)=>$(e).attr('href')).get()])].slice(0,4);
  // Hugging Face ships its filtered list and an unrelated community carousel in
  // separate Svelte props. Read only the actual filtered collection as data.
  if(requested.hostname==='huggingface.co'&&requested.pathname.replace(/\/$/,'')==='/blog'&&requested.searchParams.has('tag')){
    const entries=await huggingFaceTaggedEntries(page.html,requested);
    if(entries.length)return {entries,method:'Filtered research index',feedUrl:null,name:'Hugging Face · '+requested.searchParams.get('tag')};
  }
  const indexEntries=htmlEntries(page.html,page.url,scoped);
  for(const link of links){try{const feed=new URL(publicUrl(link,page.url));if(scoped&&!keepsScope(feed,requested))continue;const p=await fetchPage(feed.href);entries=feedEntries(p.html,p.url);if(entries.length){const listed=new Set(indexEntries.map(e=>e.url.replace(/\/$/,'')));const sample=entries.slice(0,10);const matches=sample.filter(e=>listed.has(e.url.replace(/\/$/,''))).length;
    // A section page can advertise the whole company feed. Preserve the user's
    // chosen index when the feed's recent records mostly fall outside it.
    if(indexEntries.length>=2&&sample.length>=2&&matches/sample.length<.6)continue;
    return {entries,method:p.html.trim().startsWith('{')?'JSON Feed':'RSS / Atom',feedUrl:p.url,name};}}catch{}}
  entries=indexEntries;
  if(entries.length){
    // Follow only explicit same-section pagination, with a strict two-page bound.
    let current=$,currentUrl=page.url;const visited=new Set([page.url]);
    for(let i=0;i<2;i++){
      const next=current('link[rel="next"],a[rel="next"],a').filter((_,e)=>current(e).attr('rel')==='next'||/^(next|next page|older posts|older entries)\s*[→›»]?$/i.test(current(e).text().trim())).first().attr('href');
      if(!next)break;
      try{const url=publicUrl(next,currentUrl);const u=new URL(url),start=new URL(page.url);if(!sameHost(u,start)||!u.pathname.startsWith(start.pathname.replace(/\/$/,''))||!keepsScope(u,requested)||visited.has(url))break;visited.add(url);const p=await fetchPage(url);entries.push(...htmlEntries(p.html,p.url,scoped));current=cheerio.load(p.html);currentUrl=p.url;}catch{break;}
    }
    return {entries:ordered(entries),method:'HTML discovery',feedUrl:null,name};
  }
  try{return await readerDiscovery(raw,session);}catch{}
  if(scoped)throw new Error('The filtered page could not be read after direct and reader attempts. The subscription was kept filtered; no unfiltered feed or sitemap was imported.');
  // A few well-established conventions help JS-only pages with no advertised feed.
  for(const path of [requested.pathname.replace(/\/$/,'')+'/feed.xml',requested.pathname.replace(/\/$/,'')+'/rss.xml','/feed/']){try{const p=await fetchPage(new URL(path,page.url).href);entries=feedEntries(p.html,p.url);if(entries.length)return {entries,method:'RSS / Atom',feedUrl:p.url,name};}catch{}}
  for(const path of ['/sitemap.xml','/sitemap_index.xml']){try{const p=await fetchPage(new URL(path,page.url).href);const j=xml.parse(p.html);let urls=arr(j.urlset?.url).map(x=>str(x.loc));for(const sub of arr(j.sitemapindex?.sitemap).slice(0,4)){const sp=await fetchPage(publicUrl(str(sub.loc),page.url));urls.push(...arr(xml.parse(sp.html).urlset?.url).map(x=>str(x.loc)));}const fake=urls.map(u=>`<a href="${u.replace(/"/g,'&quot;')}">${u.split('/').filter(Boolean).pop()?.replace(/-/g,' ')}</a>`).join('');entries=htmlEntries(fake,page.url);if(entries.length)return {entries,method:'Sitemap discovery',feedUrl:null,name};}catch{}}
  throw new Error((accessError?accessError+' ':'')+'No article links found after direct, reader, feed and sitemap attempts. This source may need a publisher adapter.');
}
export function feedFallback(entry:any,reason:string) {
  if(!entry.fromFeed||!entry.title||!(entry.summary||entry.feedContent))throw new Error(reason);
  if(entry.feedContent){
    const a=extractCapture(entry,entry.feedContentType==='text'?`<article></article>`:entry.feedContent,entry.url);
    return {...a,content:entry.feedContentType==='text'?String(entry.feedContent).slice(0,50000):a.content,capture:'feed content only · original unavailable'};
  }
  return {url:entry.url,title:entry.title,summary:entry.summary,content:'',published:entry.published||null,author:entry.author||null,media:'[]',tags:JSON.stringify(topics(entry.title+' '+entry.summary)),capture:'RSS excerpt only · original unavailable'};
}
export async function capture(entry:any,session=collectionSession()) {
  let direct:any;let reason='';
  try{const {html,url,headers}=await fetchPage(entry.url);direct=extractCapture(entry,html,url,headers);if(direct.content.length>200&&!accessPage(direct.title,direct.content))return {...direct,url:publicUrl(entry.url)};reason='Publisher returned too little readable article text.';}catch(e:any){reason=e.message;}
  try{
    const snapshot=await readerSnapshot(entry.url,session);
    const html=snapshotHtml(snapshot);const a=extractCapture(entry,html,snapshot.url);
    // Default Reader output may express videos/audio as ordinary Markdown links.
    const $=cheerio.load(html),media=JSON.parse(a.media);const seen=new Set(media.map((m:any)=>m.url));
    $('a[href]').each((_,el)=>{const href=$(el).attr('href')!;try{const url=publicUrl(href,snapshot.url);const kind=/\.(mp4|webm|mov)(\?|$)|youtube\.com\/watch|youtu\.be\/|vimeo\.com\//i.test(url)?'video':/\.(mp3|wav|ogg)(\?|$)/i.test(url)?'audio':null;if(kind&&!seen.has(url)){seen.add(url);media.push({kind,url,alt:$(el).text(),caption:''});}}catch{}});
    if(a.content.length>200&&!accessPage(a.title,a.content))return {...a,url:publicUrl(entry.url),media:JSON.stringify(media.slice(0,40)),capture:`text · reader fallback (${snapshot.provider||'Jina'})`};
    reason+=' Reader also returned too little article text.';
  }catch(e:any){reason+=' '+e.message;}
  if(entry.fromFeed&&entry.feedContent)return feedFallback(entry,reason);
  if(direct&&!accessPage(direct.title,direct.content))return {...direct,url:publicUrl(entry.url)};
  return feedFallback(entry,reason);
}
export function extractCapture(entry:any,html:string,url:string,headers=new Headers()) {
  const $=cheerio.load(html);
  const meta=(k:string)=>$(`meta[property="${k}"],meta[name="${k}"]`).first().attr('content');
  const title=$('main h1,article h1,h1').first().text().trim()||entry.title||meta('og:title');
  let published=date(meta('article:published_time')||meta('datePublished')||meta('date'))||entry.published||date($('main time[datetime],article time[datetime],time[datetime]').first().attr('datetime'))||null;
  let author=meta('author')||entry.author||null;let structuredText='';
  $('script[type="application/ld+json"]').each((_,el)=>{try{const root=JSON.parse($(el).text());for(const j of arr(root['@graph']||root).filter(j=>/Article|BlogPosting|TechArticle|Report/.test(arr(j['@type']).join(' ')))){if(!published)published=date(j.datePublished);if(!author)author=arr(j.author).map(a=>a?.name||str(a)).join(', ')||null;if(typeof j.articleBody==='string'&&j.articleBody.length>structuredText.length)structuredText=cleanText(j.articleBody);}}catch{}});
  if(!published){const embedded=html.match(/(?:publishedAt|datePublished|published_time)\\?"\s*:\s*\\?"(\d{4}-\d{2}-\d{2}[^"\\]*)/);if(embedded)published=date(embedded[1]);}
  if(!published)published=visibleDate($('main,article').first().text().slice(0,2200));
  const textContainers=$('[itemprop="articleBody"],.article-content,.post-content,.markdown-body,.prose').toArray().filter(e=>$(e).text().length>25).sort((a,b)=>$(b).text().length-$(a).text().length);
  let contentRoot=textContainers.length?$(textContainers[0]):$('article').first().length?$('article').first():$('main').first().length?$('main').first():$('body');
  // Multimodal essays often alternate prose islands, demos and captions. Select
  // their common container rather than silently keeping only the longest island.
  if(textContainers.length>1){while(contentRoot.parent().length&&!textContainers.every(el=>el===contentRoot[0]||$.contains(contentRoot[0],el)))contentRoot=contentRoot.parent();}
  const media:any[]=[];const seen=new Set();
  contentRoot.find('img,video,audio,iframe').each((_,el)=>{const e=$(el);const kind=el.tagName==='img'?'image':el.tagName==='video'?'video':el.tagName==='audio'?'audio':'interactive';const src=e.attr('src')||e.attr('data-src')||e.attr('data-lazy-src')||e.find('source').attr('src')||(e.attr('srcset')||e.attr('data-srcset')||e.closest('picture').find('source').attr('srcset'))?.split(',').pop()?.trim().split(/\s+/)[0];if(kind==='image'&&src&&/headshot|avatar|logo|profile.photo|h%3D128%26w%3D128/i.test(src))return;try{const u=src?publicUrl(src,url):kind!=='image'?url:null;if(!u)return;const key=kind+u;if(seen.has(key))return;seen.add(key);media.push({kind,url:u,alt:e.attr('alt')||e.attr('title')||(src?'':'Browser-loaded media — view at source'),caption:e.closest('figure').find('figcaption').text().trim()});}catch{}});
  contentRoot.find('canvas,svg').each((i,el)=>{const e=$(el);if(el.tagName==='svg'&&!e.find('text').length&&!e.attr('aria-label')&&!e.closest('figure').length)return;media.push({kind:'interactive',url:url+(e.attr('id')?'#'+e.attr('id'):''),alt:e.attr('aria-label')||e.find('title').text()||'Inline visual — view at source',caption:e.closest('figure').find('figcaption').text().trim()});});
  contentRoot.find('script,style,nav,footer,header,form,noscript,button,[aria-hidden="true"]').remove();
  contentRoot.find('.katex').each((_,el)=>{const tex=$(el).find('annotation[encoding="application/x-tex"]').text();if(tex)$(el).replaceWith($('<span>').text(' $'+tex+'$ '));});
  const blocks=contentRoot.find('h1,h2,h3,h4,p,li:not(:has(p)):not(:has(li)),figcaption,pre,tr').filter((_,e)=>!$(e).parents('pre,table').length||e.tagName==='tr').map((_,e)=>e.tagName==='pre'?'```\n'+$(e).text().trim()+'\n```':e.tagName==='tr'?$(e).find('th,td').map((_,cell)=>$(cell).text().replace(/\s+/g,' ').trim()).get().join(' | '):$(e).text().replace(/\s+/g,' ').trim()).get().filter(t=>t.length>2).filter((t,i,a)=>t!==a[i-1]);
  let content=(blocks.length?blocks.join('\n\n'):contentRoot.text().replace(/\s+/g,' ').trim()).slice(0,50000);
  if(content.length<200&&structuredText.length>content.length)content=structuredText.slice(0,50000);
  const description=meta('description')||meta('og:description')||'';
  const genericText=(s:string)=>/working to advance and democratize|research lab and product company|we are a research lab|we.re on a journey to advance|^A Blog post by .+ on Hugging Face$|^Anthropic is an AI safety and research company/i.test(s);
  const generic=genericText(description);
  const intro=contentRoot.find('p').map((_,e)=>$(e).text().trim()).get().find(t=>t.length>65&&!genericText(t));
  const summary=(entry.summary&&!genericText(entry.summary)?entry.summary:(!generic?description:'')||intro||blocks.find(t=>t.length>65)||content.slice(0,600)||'').trim().slice(0,600);
  const frameBlocked=/deny|sameorigin/i.test(headers.get('x-frame-options')||'')||/frame-ancestors\s+(?:'none'|'self')/.test(headers.get('content-security-policy')||'');
  return {url,title:title.trim(),summary,content,published,author,media:JSON.stringify(media.slice(0,40)),tags:JSON.stringify(topics(title+' '+summary+' '+content.slice(0,3000))),capture:content.length>200?(frameBlocked?'text · original opens in tab':'text · media references'):'metadata only'};
}
