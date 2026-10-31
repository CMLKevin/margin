import {requireServer} from '../../../server/settings.mjs';
import {runCollection} from '../../../lib/collection-jobs.ts';
import { library, addSource, syncAll, syncSource, updateArticle, updateSource, search, getArticle, bulkRead } from '../../../lib/library.ts';
import {publicUrl} from '../../../lib/crawler.ts';
import {readerSnapshot} from '../../../lib/reader.ts';
import {serverCollectionSession} from '../../../lib/collection-runtime.ts';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(req:Request){const denied=requireServer(req);if(denied)return denied;try{const url=new URL(req.url);return Response.json(url.searchParams.has('id')?await getArticle(url.searchParams.get('id')!):url.searchParams.has('q')?await search({query:url.searchParams.get('q'),limit:url.searchParams.get('limit')||100,source_id:url.searchParams.get('source_id'),since:url.searchParams.get('since'),topic:url.searchParams.get('topic'),capture_status:url.searchParams.get('capture_status'),include_content:url.searchParams.get('content')==='1'}):await library(),{headers:{'Cache-Control':'no-store'}});}catch(e:any){return Response.json({error:e.message},{status:500});}}
export async function POST(req:Request){
  const denied=requireServer(req);if(denied)return denied;
  // Host, Origin and browser/MCP authentication were verified by the local server.
  try{const b:any=await req.json();let data;switch(b.action){case 'probe':{const url=publicUrl(b.url);try{const snapshot=await readerSnapshot(url,serverCollectionSession());data={ok:true,provider:snapshot.provider,title:snapshot.title,characters:snapshot.markdown.length};}catch(e:any){data={ok:false,error:e.message};}break;}case 'add':data=await addSource(b.url,b.name);break;case 'sync':data=await runCollection(b.id);break;case 'article':data=await updateArticle(b.id,b);break;case 'source':data=await updateSource(b.id,b);break;case 'bulk_read':data=await bulkRead(b.ids,!!b.read);break;default:return Response.json({error:'Unknown action'},{status:400});}return Response.json({ok:true,result:data});}catch(e:any){return Response.json({error:e.message},{status:400});}
}
