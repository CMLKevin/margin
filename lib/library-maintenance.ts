import {classifyTopics,TAXONOMY_VERSION,topicCatalog} from './topics.ts';
import {accessPage,publisherBoilerplate} from './reader.ts';
export const CAPTURE_VERSION=3;
const migrations=new WeakMap<object,Promise<void>>();
// Both D1 and the local SQLite adapter implement this small statement interface.
export async function maintainLibrary(database:any){
 const existing=migrations.get(database);if(existing)return existing;
 const pending=(async()=>{
  await database.prepare('CREATE TABLE IF NOT EXISTS library_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  const columns=await database.prepare('PRAGMA table_info(articles)').all();
  if(!columns.results.some((c:any)=>c.name==='capture_version')){try{await database.prepare('ALTER TABLE articles ADD COLUMN capture_version INTEGER NOT NULL DEFAULT 0').run();}catch(e){const current=await database.prepare('PRAGMA table_info(articles)').all();if(!current.results.some((c:any)=>c.name==='capture_version'))throw e;}}
  const fields=await database.prepare('PRAGMA table_info(articles)').all();
  if(!fields.results.some((c:any)=>c.name==='published_precision')){try{await database.prepare("ALTER TABLE articles ADD COLUMN published_precision TEXT NOT NULL DEFAULT 'unknown'").run();}catch(e){const current=await database.prepare('PRAGMA table_info(articles)').all();if(!current.results.some((c:any)=>c.name==='published_precision'))throw e;}}
  await database.prepare("UPDATE articles SET published_precision='day' WHERE published IS NOT NULL AND published_precision='unknown'").run();
  const version=await database.prepare("SELECT value FROM library_meta WHERE key='taxonomy_version'").first();
  if(Number(version?.value)===TAXONOMY_VERSION)return;
  let cursor='';
  while(true){const rows=await database.prepare('SELECT id,title,summary,content FROM articles WHERE id>? ORDER BY id LIMIT 40').bind(cursor).all();if(!rows.results.length)break;cursor=rows.results.at(-1).id;const statements=rows.results.map((a:any)=>{
   if(accessPage(a.title,a.content))return database.prepare("UPDATE articles SET tags='[]',content='',summary='',capture='metadata only · rejected publisher error page',capture_version=0 WHERE id=?").bind(a.id);
   const summary=publisherBoilerplate(a.summary)?a.content.split('\n\n').find((p:string)=>p.length>65&&!publisherBoilerplate(p))?.slice(0,600)||a.summary:a.summary;
   return database.prepare('UPDATE articles SET tags=?,summary=? WHERE id=?').bind(JSON.stringify(classifyTopics(a.title,summary,a.content)),summary,a.id);
  });if(statements.length)await database.batch(statements);}
  await database.prepare("INSERT INTO library_meta(key,value) VALUES('taxonomy_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(TAXONOMY_VERSION)).run();
 })().catch(e=>{migrations.delete(database);throw e;});
 migrations.set(database,pending);
 return pending;
}
export const taxonomyInfo=()=>({version:TAXONOMY_VERSION,method:'Rule-based evidence from title, summary, and repeated body terms; strongest four topics per post. Labels are navigation aids, not publisher claims.',topics:topicCatalog.map(({name,group,description})=>({name,group,description}))});
