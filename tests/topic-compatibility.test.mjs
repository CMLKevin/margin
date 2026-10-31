import test from 'node:test';import assert from 'node:assert/strict';
import {classifyTopics,topicCatalog,topicFacets} from '../lib/topics.ts';
import {discover,htmlEntries,extractCapture,capture,collectionSession} from '../lib/crawler.ts';
import {accessPage} from '../lib/reader.ts';
import {LocalDatabase} from '../lib/database.ts';
import {maintainLibrary} from '../lib/library-maintenance.ts';
test('research categories distinguish methods, capabilities, science, security and impact',()=>{
 for(const [title,expected] of [['Frontier Models for Every Robot','Robotics'],['Mechanistic interpretability with sparse autoencoders','Interpretability'],['How Claude designed protein binders against scorpion neurotoxins','Science'],['AI can turn security fixes into working exploits','Security'],['Prime Mega MoE: Fast Fused MoE Kernels for Training','Training systems'],['Post-training science for supervised fine-tuning','Post-training'],['Why do models forget facts that they iteratively learn?','Continual learning'],['How AI agents shape experts’ judgment calls','Economics']])assert.ok(classifyTopics(title).includes(expected),title);
 assert.ok(!classifyTopics('Computer science researchers write an opinion').includes('Compute'));
 assert.ok(!classifyTopics('An ordinary essay','','A passing mention of an agent and a GPU.').includes('Agents'));
 assert.ok(!classifyTopics('Post-training science for supervised fine-tuning').includes('Reinforcement learning'));
 assert.equal(new Set(topicCatalog.map(t=>t.name)).size,20);
 assert.ok(classifyTopics('Robotics, agents, inference, evaluation, safety, datasets and reasoning').length<=4);
 assert.equal(classifyTopics('Robot control','','evaluation benchmark agents '.repeat(20))[0],'Robotics');
});
test('topic facets count each article once without counting duplicate labels',()=>{assert.equal(topicFacets([{tags:['Robotics','Robotics']},{tags:'["Robotics","Inference"]'}]).find(t=>t.name==='Robotics').count,2);});
test('Webflow load-more pagination covers archives while retaining tag scope',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);const n=Number(new URL(url).searchParams.get('abc_page')||1);return new Response(`<div class="w-dyn-item"><a href="/blog/study-${n}"><div data-title>Study ${n}</div></a></div>${n<6?`<a aria-label="Next Page" class="w-pagination-next" href="?tag=research&abc_page=${n+1}"><span>Load more</span></a>`:''}`);});
 const d=await discover('https://lab.ai/research-blog?tag=research');assert.equal(d.entries.length,6);assert.equal(calls.length,6);assert.ok(calls.every(u=>new URL(u).searchParams.get('tag')==='research'));assert.equal(d.notice,undefined);
});
test('publisher bylines and embedded video types survive capture without footer assets',()=>{
 const a=extractCapture({},'<main><h1>Robotic control</h1><div class="byline"><p class="byline-author">Jane Doe*</p><p class="byline-author">Alex Lee</p></div><p>'+('Useful technical content. '.repeat(20))+'</p><iframe src="https://www.youtube-nocookie.com/embed/123"></iframe><a href="/demo.mp4">Control demo</a><footer><img src="/footer.png"></footer></main>','https://lab.ai/blog/control');
 assert.equal(a.author,'Jane Doe, Alex Lee');const media=JSON.parse(a.media);assert.equal(media.filter(m=>m.kind==='video').length,2);assert.ok(!media.some(m=>m.url.includes('footer.png')));
});
test('HTTP 200 publisher error pages are rejected and reader recovery is attempted',async t=>{
 assert.ok(accessPage('Something went wrong | OpenAI','A short error screen'));
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);if(url.startsWith('https://r.jina.ai/'))return Response.json({code:200,data:{url:'https://lab.ai/blog/study',title:'A real study',content:'Actual article prose with meaningful evidence. '.repeat(20),metadata:{},httpStatus:200}});return new Response('<main><h1>Something went wrong | Lab</h1><p>'+('An error occurred, try again later. '.repeat(8))+'</p></main>');});
 const a=await capture({url:'https://lab.ai/blog/study',title:'A real study'},collectionSession());assert.equal(a.title,'A real study');assert.match(a.capture,/reader fallback/);assert.equal(calls.length,2);
});
test('taxonomy migration reclassifies old captures and quarantines error text without touching personal state',async()=>{
 const db=new LocalDatabase(':memory:');try{
 await db.prepare("INSERT INTO sources(id,url,name,color) VALUES('lab','https://lab.ai/blog','Lab','#123456')").run();
 for(const [id,title,content] of [['robot','Robotic manipulation','Robot control research.'],['error','Something went wrong | Lab','Error screen text.']])await db.prepare('INSERT INTO articles(id,source_id,url,title,content,discovered,saved,read,note,tags) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,'lab','https://lab.ai/blog/'+id,title,content,'2026-11-01',1,1,'Keep this note','["Compute"]').run();
 await maintainLibrary(db);const a=await db.prepare("SELECT * FROM articles WHERE id='robot'").first();assert.ok(JSON.parse(a.tags).includes('Robotics'));assert.equal(a.saved,1);assert.equal(a.read,1);assert.equal(a.note,'Keep this note');const error=await db.prepare("SELECT * FROM articles WHERE id='error'").first();assert.equal(error.content,'');assert.match(error.capture,/rejected/);assert.equal(error.note,'Keep this note');await maintainLibrary(db);
 }finally{db.close();}
});

test('article-card headers retain publication dates while global navigation is excluded',()=>{const entries=htmlEntries('<header><a href="/research/navigation">Navigation</a></header><article><header><a href="/research/science">Science</a><time>Oct 27, 2026</time></header><h3><a href="/research/study">A useful study</a></h3></article>','https://lab.ai/research');assert.equal(entries.length,1);assert.equal(entries[0].published,'2026-10-27T00:00:00.000Z');});
test('OpenAI index and scoped RSS complement each other without importing company posts',async t=>{t.mock.method(globalThis,'fetch',async url=>new Response(url.endsWith('rss.xml')?'<rss><channel><item><title>Older research</title><link>https://openai.com/index/older</link><category>Research</category></item><item><title>Customer testimonial</title><link>https://openai.com/index/customer</link><category>Company</category></item></channel></rss>':'<article><time>Oct 29, 2026</time><a href="/index/latest"><h3>New research</h3></a></article>'));const d=await discover('https://openai.com/research/index/');assert.equal(d.entries.length,2);assert.ok(d.entries.some(e=>e.url.endsWith('/older')));assert.ok(!d.entries.some(e=>e.url.endsWith('/customer')));assert.match(d.method,/research RSS/);});
test('filtered subscriptions reject redirects that silently remove their filter',async t=>{t.mock.method(globalThis,'fetch',async url=>{if(url==='https://lab.ai/blog?tag=research')return new Response('',{status:302,headers:{location:'/blog'}});if(url==='https://lab.ai/blog')return new Response('<a href="/blog/promotion"><h3>Unfiltered promotion</h3></a>');return new Response('',{status:403});});await assert.rejects(discover('https://lab.ai/blog?tag=research'),/kept filtered/);});
