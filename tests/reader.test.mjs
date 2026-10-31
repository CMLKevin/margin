import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,capture,collectionSession,readerEntries} from '../lib/crawler.ts';
import {readerSnapshot,readSnapshotPayload,readBrowserPayload,snapshotHtml} from '../lib/reader.ts';

const article='This is a substantial paragraph from an actual research article, with enough detail to distinguish it from a loading screen or a short feed excerpt. '.repeat(6);
const payload=(url,content=article,extra={})=>({code:200,data:{url,finalUrl:url,title:'Research result',content,httpStatus:200,metadata:{'article:published_time':'2026-10-29'},...extra}});
test('a blocked arbitrary publisher escalates to Reader for discovery and full article capture',async t=>{
 const urls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{urls.push(url);if(!url.startsWith('https://r.jina.ai/'))return new Response('Forbidden',{status:403});assert.deepEqual(Object.keys(options.headers).sort(),['Accept','X-Cache-Tolerance']);const target=url.slice('https://r.jina.ai/'.length);return Response.json(payload(target,target.endsWith('/journal')?'October 29, 2026\n\n[A useful research result](https://independent-lab.ai/journal/result)':article));});
 const session=collectionSession(),d=await discover('https://independent-lab.ai/journal',null,session);assert.equal(d.method,'Reader discovery');assert.equal(d.entries.length,1);const a=await capture(d.entries[0],session);assert.ok(a.content.length>500);assert.equal(a.capture,'text · reader fallback (Jina)');assert.equal(a.url,'https://independent-lab.ai/journal/result');assert.equal(a.published,'2026-10-29T00:00:00.000Z');assert.equal(urls.filter(u=>u.startsWith('https://r.jina.ai/')).length,2);
});
test('HTTP 200 JavaScript shells also escalate instead of becoming metadata-only captures',async t=>{
 t.mock.method(globalThis,'fetch',async url=>url.startsWith('https://r.jina.ai/')?Response.json(payload('https://lab.ai/post')):new Response('<main><h1>Research result</h1><div id="root">Loading…</div></main>'));const a=await capture({url:'https://lab.ai/post',title:'Research result'});assert.ok(a.content.length>500);assert.match(a.capture,/reader fallback/);
});
test('successful direct capture does not call the fallback service',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('<main><h1>Research result</h1><p>'+article+'</p></main>'));const a=await capture({url:'https://lab.ai/post'});assert.ok(a.content.length>500);assert.equal(mock.mock.callCount(),1);assert.doesNotMatch(a.capture,/reader/);
});
test('Reader caches concurrent same-URL requests within a collection check',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>Response.json(payload('https://lab.ai/post')));const session=collectionSession();const [a,b]=await Promise.all([readerSnapshot('https://lab.ai/post',session),readerSnapshot('https://lab.ai/post',session)]);assert.equal(a,b);assert.equal(mock.mock.callCount(),1);assert.equal(session.readerRemaining,15);
});
test('Reader content retains tables, code, image and video references',async t=>{
 const markdown=article+'\n\n| Model | Score |\n| --- | --- |\n| Agent | 42 |\n\n```python\nprint("result")\n```\n\n![Learning curves](https://lab.ai/chart.png)\n\n[Robot demonstration](https://lab.ai/demo.mp4)';
 t.mock.method(globalThis,'fetch',async url=>url.startsWith('https://r.jina.ai/')?Response.json(payload('https://lab.ai/post',markdown)):new Response('',{status:403}));const a=await capture({url:'https://lab.ai/post'});assert.match(a.content,/Agent \| 42/);assert.match(a.content,/print\("result"\)/);const media=JSON.parse(a.media);assert.ok(media.some(m=>m.kind==='image'));assert.ok(media.some(m=>m.kind==='video'));assert.ok(a.media.includes('demo.mp4'));
});
test('Reader supports mixed section paths and publisher subdomains without inventing feed scope',()=>{
 const s=readSnapshotPayload(payload('https://lab.ai/blog','October 29, 2026\n\n[Research result](https://lab.ai/research/result)\n\nOctober 28, 2026\n\n[System card details](https://safety.lab.ai/model-card)'), 'https://lab.ai/blog');const entries=readerEntries(s,'https://lab.ai/blog');assert.equal(entries.length,2);assert.equal(entries[0].published,'2026-10-29T00:00:00.000Z');assert.ok(entries.some(e=>e.url.includes('safety.lab.ai')));
});
test('Reader access screens, upstream errors and private redirect URLs are rejected',()=>{
 for(const p of [payload('https://lab.ai/post',article,{title:'Just a moment…'}),payload('https://lab.ai/post',article,{httpStatus:403}),payload('https://127.0.0.1/private'),{code:401,data:null}])assert.throws(()=>readSnapshotPayload(p,'https://lab.ai/post'));
});
test('an exhausted Reader budget preserves a real feed excerpt and does not send another request',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));const session=collectionSession();session.readerRemaining=0;const a=await capture({url:'https://lab.ai/post',title:'Research result',summary:'Publisher excerpt',fromFeed:true},session);assert.equal(a.content,'');assert.match(a.capture,/RSS excerpt only/);assert.equal(mock.mock.callCount(),1);
});
test('invalid or private URLs never reach the Reader service',async t=>{const mock=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected request');});await assert.rejects(readerSnapshot('https://127.0.0.1/private'));assert.equal(mock.mock.callCount(),0);});
test('failure of one reader escalates to an independent browser service',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push(url);if(url.startsWith('https://r.jina.ai/'))return new Response('',{status:503});assert.equal(url,'https://markdown.new/');assert.equal(JSON.parse(options.body).method,'browser');return Response.json({success:true,url:'https://lab.ai/post',title:'Research result | Lab',content:'---\ntitle: "Research result | Lab"\nmeta:\n  "og:title": "Research result"\n---\n\n[Navigation](https://lab.ai/)\n\n# Research result\n\n'+article});});const s=await readerSnapshot('https://lab.ai/post');assert.equal(s.provider,'markdown.new');assert.equal(s.title,'Research result');assert.doesNotMatch(snapshotHtml(s),/Navigation/);assert.equal(calls.length,2);
});
test('browser-reader frontmatter is metadata rather than indexed article prose',()=>{
 const s=readBrowserPayload({success:true,url:'https://lab.ai/post',title:'A title | Lab',content:'---\ntitle: "A title | Lab"\nmeta:\n  description: "Publisher summary"\n  "og:title": "A title"\n---\n\n'+article},'https://lab.ai/post');assert.equal(s.description,'Publisher summary');assert.doesNotMatch(s.markdown,/^---/);assert.equal(s.title,'A title');
});
test('the configured Jina credential is sent only to Jina, never to the independent fallback',async t=>{
 const key='test-only-reader-credential';let fallback=false;t.mock.method(globalThis,'fetch',async(url,options)=>{if(url.startsWith('https://r.jina.ai/')){assert.equal(options.headers.Authorization,'Bearer '+key);return new Response('',{status:503});}fallback=true;assert.equal(options.headers.Authorization,undefined);assert.ok(!JSON.stringify(options).includes(key));return Response.json({success:true,url:'https://lab.ai/post',title:'Research result',content:article});});const s=await readerSnapshot('https://lab.ai/post',collectionSession({jinaApiKey:key}));assert.equal(s.provider,'markdown.new');assert.equal(fallback,true);
});
test('browser-reader navigation tabs and footer columns do not become research posts or article text',()=>{
 const content='# Research\n\n[Publication](https://lab.ai/research/index/publication/)\n\nOctober 29, 2026\n\n[A real research result](https://lab.ai/index/study)\n\nLoad more\n\nResearch\n\n- [Old result](https://lab.ai/index/old)\n- [Overview](https://lab.ai/research/)\n\nCompany\n\n- [About](https://lab.ai/about/)\n- [Jobs](https://lab.ai/jobs/)\n\nSupport\n\n- [Help](https://lab.ai/help/)\n- [Status](https://lab.ai/status/)';
 const s=readBrowserPayload({success:true,url:'https://lab.ai/research/index/',title:'Research',content},'https://lab.ai/research/index/');const entries=readerEntries(s,s.url);assert.equal(entries.length,1);assert.equal(entries[0].url,'https://lab.ai/index/study');assert.doesNotMatch(snapshotHtml(s),/Old result/);
});
test('rate limiting opens a circuit rather than hammering the fallback provider',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:429,headers:{'retry-after':'120'}}));await assert.rejects(readerSnapshot('https://lab.ai/one'),/429/);await assert.rejects(readerSnapshot('https://lab.ai/two'),/rate limited/);assert.equal(mock.mock.callCount(),2);
});
test('anonymous rate limiting does not block an authenticated collection session',async t=>{
 const mock=t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer test-only-key');return Response.json(payload('https://lab.ai/authenticated'));});const s=await readerSnapshot('https://lab.ai/authenticated',collectionSession({jinaApiKey:'test-only-key'}));assert.equal(s.provider,'Jina');assert.equal(mock.mock.callCount(),1);
});
