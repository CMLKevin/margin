// Exercises every current source in an isolated local instance, never a live Site.
import assert from 'node:assert/strict';
const base=process.env.MARGIN_TEST_URL||'http://localhost:3007';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const get=async path=>{const r=await fetch(base+path);assert.equal(r.status,200);return r.json();};
const post=async body=>{const r=await fetch(base+'/api/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.result;};
const config=await(await fetch(base+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mcp_config'})})).json();
const mcp=async(name,args={})=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});assert.equal(r.status,200);const d=await r.json();assert.ok(!d.result?.isError,JSON.stringify(d));return JSON.parse(d.result.content[0].text);};
const library=await get('/api/library');assert.equal(library.sources.length,12);
const overview=await mcp('get_research_overview');assert.equal(overview.taxonomy.topics.length,20);
assert.equal((await mcp('list_research_sources')).length,12);
for(const s of library.sources){
 const records=library.articles.filter(a=>a.source_id===s.id);assert.ok(records.length,s.name);
 const results=await mcp('search_research',{source_id:s.id,limit:100,include_content:true});assert.equal(results.length,records.length,s.name);
 for(const a of results){assert.equal(a.source_name,s.name);assert.ok(a.id&&a.title&&a.url.startsWith('https://'));assert.ok(a.tags.length<=4);assert.ok(a.tags.every(t=>overview.taxonomy.topics.some(c=>c.name===t)));for(const m of a.media)assert.ok(m.url.startsWith('https://'));}
 const sample=records.find(a=>a.content.length>1000&&JSON.parse(a.tags).length);assert.ok(sample,s.name);
 const topic=JSON.parse(sample.tags)[0],topicResults=await mcp('search_research',{source_id:s.id,topic,limit:100});assert.ok(topicResults.some(a=>a.id===sample.id));assert.ok(topicResults.every(a=>a.tags.includes(topic)));
 const http=await get('/api/library?q=&source_id='+s.id+'&topic='+encodeURIComponent(topic));assert.deepEqual(http.map(a=>a.id),topicResults.map(a=>a.id));
 const fetched=await mcp('get_research_post',{id:sample.id});assert.equal(fetched.content,sample.content);assert.equal(fetched.url,sample.url);
 const full=await mcp('search_research',{source_id:s.id,capture_status:'full_text',since:sample.published||sample.discovered,limit:100});assert.ok(full.every(a=>!/unavailable|metadata/.test(a.capture)));
 await post({action:'article',id:sample.id,saved:true,read:true,note:'Compatibility audit — temporary local note'});const changed=await mcp('get_research_post',{id:sample.id});assert.equal(changed.saved,1);assert.equal(changed.read,1);assert.equal(changed.note,'Compatibility audit — temporary local note');await post({action:'article',id:sample.id,saved:sample.saved,read:sample.read,note:sample.note});
 assert.equal((await post({action:'add',url:s.url})).existing,true);await post({action:'source',id:s.id,removed:true});assert.ok(!(await get('/api/library')).sources.some(x=>x.id===s.id));assert.equal((await post({action:'add',url:s.url})).restored,true);assert.equal((await mcp('get_research_post',{id:sample.id})).note,sample.note);
 console.log(s.name+': '+records.length+' stored posts; source/topic/date/capture filters, HTTP/MCP parity, retrieval/media, save/read/notes, duplicate detection, remove/restore passed.');
}
assert.deepEqual(await mcp('refresh_research_sources'),[]); // QA sources are paused.
console.log('All 12 current publishers passed the local feature matrix.');
