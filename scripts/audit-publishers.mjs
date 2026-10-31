// Read-only live publisher audit. No private library, credentials, or state changes.
// Run with Node 24+: node scripts/audit-publishers.mjs
import {mkdir,writeFile} from 'node:fs/promises';
import {discover,capture,collectionSession} from '../lib/crawler.ts';
import defaults from '../sources/defaults.json' with {type:'json'};
const directory=new URL('../outputs/compatibility/',import.meta.url);
await mkdir(directory,{recursive:true});
const originalFetch=globalThis.fetch,requests=[];
globalThis.fetch=async(input,options)=>{const url=String(input);try{const r=await originalFetch(input,options);requests.push({url,status:r.status,frame:r.headers.get('x-frame-options'),csp:r.headers.get('content-security-policy')});return r;}catch(e){requests.push({url,error:e.message});throw e;}};
const results=[];let cursor=0;
async function worker(){while(cursor<defaults.sources.length){const source=defaults.sources[cursor++],start=Date.now(),session=collectionSession({jinaApiKey:process.env.JINA_API_KEY});let result={name:source.name,url:source.url};try{
 const d=await discover(source.url,null,session);result={...result,method:d.method,notice:d.notice||null,discovered:d.entries.length,entries:d.entries.map(e=>({url:e.url,title:e.title,published:e.published||null})),posts:[]};
 for(const entry of d.entries.slice(0,3)){try{const a=await capture(entry,session);result.posts.push(a);}catch(e){result.posts.push({url:entry.url,title:entry.title,error:e.message});}}
 }catch(e){result.error=e.message;}result.elapsedSeconds=Math.round((Date.now()-start)/1000);results.push(result);await writeFile(new URL('live.json',directory),JSON.stringify({at:new Date().toISOString(),results,requests},null,2));console.log(JSON.stringify({...result,entries:result.entries?.slice(0,8),posts:result.posts?.map(p=>({url:p.url,title:p.title,chars:p.content?.length,date:p.published,author:p.author,media:p.media?JSON.parse(p.media).length:0,tags:p.tags,capture:p.capture,error:p.error}))}));}}
await Promise.all([worker(),worker(),worker()]);
console.log('Completed live publisher audit: '+results.length+' sources. Raw public captures are in ignored outputs/compatibility/live.json.');
