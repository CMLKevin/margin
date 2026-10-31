'use client';
import {useId} from 'react';
import {Code,BookOpenSharp,ChartLine} from 'pixelarticons/react';
import {DitherGradient} from './dither-kit/gradient';
import {arrayValue,readingFacts,nearbyPosts,type ResearchRecord} from '../lib/research-view';

export type Motif='observer'|'orbit'|'book'|'wave';
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export function DitherMotif({kind='observer',className=''}:{kind?:Motif;className?:string}){
 const id=useId().replace(/:/g,'');let pixels='';
 for(let y=0;y<40;y++)for(let x=0;x<48;x++){
  const X=x-24,Y=y-20;let inside=false,density=.9;
  if(kind==='observer'){
   inside=(x>=17&&x<31&&y>=8&&y<15)||(x>=14&&x<34&&y>=15&&y<27)||(x>=17&&x<23&&y>=27&&y<34)||(x>=27&&x<33&&y>=27&&y<34)||(x>=9&&x<14&&y>=18&&y<24)||(x>=34&&x<39&&y>=18&&y<24)||(x>=22&&x<26&&y>=4&&y<8);
   if((x===20||x===27)&&y>=10&&y<12||x>=21&&x<28&&y>=20&&y<24)inside=false;
   density=.48+.48*(1-Math.abs(X)/25);
  }else if(kind==='orbit'){
   const a=X*.94+Y*.34,c=Y*.94-X*.34;inside=X*X+Y*Y<95||Math.abs(a*a/390+c*c/40-1)<.26;density=.2+.78*(x/48)+.13*Math.sin(y);
   inside=inside||(x>=6&&x<9&&y>=7&&y<10)||(x>=38&&x<40&&y>=29&&y<31);
  }else if(kind==='book'){
   inside=y>=10&&y<30&&x>=9&&x<39&&Math.abs(Y)<11-Math.abs(X)*.1;density=.3+.7*(1-Math.abs(X)/22);if(x===24||y%5===0&&x>13&&x<35)inside=false;
  }else{inside=Math.abs(Y-Math.sin(x*.2)*9)<4||x%8<2&&y>=29&&y<34;density=.3+.65*(x/48);}
  if(inside&&density>bayer[(y%4)*4+x%4]/16)pixels+=`M${x} ${y}h1v1h-1z`;
 }
 return <svg className={'dither-motif '+className} viewBox="0 0 48 40" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><defs><pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h1v1H0zM2 2h1v1H2z" fill="currentColor" opacity=".2"/></pattern></defs><path d="M0 20H48M24 0V40" stroke="currentColor" strokeWidth=".12" opacity=".3"/><rect width="48" height="40" fill={`url(#${id})`} opacity=".36"/><path d={pixels}/></svg>;
}
const topicGlyphs:Record<string,string[]>={
 'Agents':['................','......####......','.......##.......','...##########...','...##......##...','...##.##.####...','...##......##...','...##########...','.##############.','.##.########.##.','....########....','....##....##....','....##....##....','...###....###...','................','................'],
 'Compute':['................','....#..#..#.....','...##########...','...#........#...','.###.######.###.','...#.######.#...','...#.######.#...','.###.######.###.','...#.######.#...','...#.######.#...','.###.######.###.','...#........#...','...##########...','....#..#..#.....','................','................'],
 'Reinforcement learning':['................','.....######.....','...###....###...','..##........##..','..##...##...##..','..##..####..##..','..##.######.##..','..##..####..##..','..##...##...##..','..##........##..','...###....###...','.....######.....','.......##.......','......####......','.....##..##.....','................'],
 'Evaluation':['................','..############..','..##........##..','..##.##..##.##..','..##.##..##.##..','..##........##..','..##.....##.##..','..##....###.##..','..##.#.###..##..','..##.####...##..','..##..##....##..','..##........##..','..############..','................','................','................'],
 'Continual learning':['................','....#######.....','...##.....##....','..##.......##...','..##.......###..','..##......####..','..##........#...','..##............','............##..','...#........##..','..####......##..','..###.......##..','...##.....###...','....#######.....','................','................'],
 'Inference':['................','........###.....','.......###......','......###.......','.....###........','....########....','...########.....','.......###......','......###.......','.....###........','....###.........','...###..........','..###...........','..##............','................','................'],
 'Safety':['................','......####......','...##########...','..###......###..','..##........##..','..##...##...##..','..##..####..##..','..##..####..##..','..##...##...##..','...##..##..##...','...##......##...','....##....##....','.....######.....','......####......','................','................'],
 'Independent research':['................','......####......','....########....','...##########...','..############..','..############..','..############..','...##########...','....########....','......####......','................','..############..','....########....','......####......','................','................']
};
export function ResearchGlyph({topic,className=''}:{topic:string;className?:string}){
 const rows=topicGlyphs[topic]||topicGlyphs['Independent research'];const d=rows.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='#'?[`M${x} ${y}h1v1h-1z`]:[])).join('');
 return <svg className={'research-glyph '+className} viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d={d}/></svg>;
}
export function topicIdentity(tags:string[]){const topic=tags.find(t=>topicGlyphs[t])||'Independent research';const identity:Record<string,{kind:Motif;tone:string}>={'Agents':{kind:'observer',tone:'lime'},'Compute':{kind:'wave',tone:'blue'},'Continual learning':{kind:'book',tone:'peach'},'Reinforcement learning':{kind:'observer',tone:'lime'},'Evaluation':{kind:'orbit',tone:'lilac'},'Inference':{kind:'wave',tone:'peach'},'Safety':{kind:'book',tone:'blue'}};return {topic,...(identity[topic]||{kind:'orbit' as Motif,tone:'lilac'})};}
export function TopicStamp({tags,index}:{tags:string[];index:number}){const {topic,tone}=topicIdentity(tags);return <div className={'topic-stamp tone-'+tone} role="img" aria-label={topic+' research'} title={topic}><span className="stamp-no" aria-hidden="true">{String(index+1).padStart(3,'0')}</span><ResearchGlyph topic={topic}/></div>;}
export function SignalPoster({sources,posts,unread}:{sources:number;posts:number;unread:number}){return <div className="signal-poster"><div className="poster-label"><span>FIELD RECEIVER / 01</span><span>● LIVE</span></div><div className="poster-scene"><DitherGradient from={118} direction="up" cell={3} opacity={.52}/><DitherMotif kind="observer"/><span className="poster-coordinate">OPEN CHANNEL · {String(sources).padStart(2,'0')} SOURCES</span></div><div className="poster-footer"><span>{String(posts).padStart(3,'0')}<small>POSTS COLLECTED</small></span><span>{String(unread).padStart(2,'0')}<small>STILL TO EXPLORE</small></span></div></div>;}
export function DossierOverview({post,posts,onChoose,onTopic}:{post:ResearchRecord;posts:ResearchRecord[];onChoose:(id:string)=>void;onTopic:(topic:string)=>void}){
 const facts=readingFacts(post),tags=arrayValue(post.tags),identity=topicIdentity(tags),related=nearbyPosts(post,posts),figures=facts.media.filter(m=>m.kind==='image');
 return <div className="dossier-overview">
  <div className={'dossier-art tone-'+identity.tone}><DitherMotif kind={identity.kind}/><div><span>RESEARCH SIGNAL / {facts.limited?'PARTIAL CAPTURE':'TEXT AVAILABLE'}</span><strong>{identity.topic}</strong><small>{facts.words.toLocaleString()} words captured · {tags.length} topic{tags.length===1?'':'s'}</small></div></div>
  <div className="dossier-stats" aria-label="Captured article facts"><span><BookOpenSharp width={20} height={20}/><strong>{facts.minutes?String(facts.minutes).padStart(2,'0'):'—'}</strong><small>MIN READ*</small></span><span><ChartLine width={20} height={20}/><strong>{String(facts.figures).padStart(2,'0')}</strong><small>FIGURES</small></span><span><Code width={20} height={20}/><strong>{String(facts.demos).padStart(2,'0')}</strong><small>DEMOS / MEDIA</small></span></div>
  <section className="dossier-section dossier-abstract"><div className="section-kicker"><span>01 / THE IDEA</span><span>PUBLISHER SUMMARY</span></div><p className="preview-summary">{post.summary||'Explore the captured text or open the original research.'}</p><div className="tag-group preview-tags">{tags.map((t:string)=><button key={t} onClick={()=>onTopic(t)}>{t}</button>)}</div></section>
  {figures.length>0&&<section className="dossier-section dossier-figures"><div className="section-kicker"><span>02 / VISUAL EVIDENCE</span><span>{figures.length} ORIGINAL ASSETS ↗</span></div><div>{figures.slice(0,2).map((m,i)=><a key={i} href={m.url} target="_blank" rel="noopener noreferrer"><div><img src={m.url} alt={m.alt||m.caption||'Figure from the original post'} loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true;}}/><ChartLine width={24} height={24}/></div><span><b>{String(i+1).padStart(2,'0')}</b>{m.alt||m.caption||`Figure ${i+1}`} ↗</span></a>)}</div></section>}
  <div className="source-facts"><span>CAPTURE<small>{facts.limited?'Limited text':post.capture.includes('reader')?'Reader-assisted':'Publisher text'}</small></span><span>COLLECTED<small>{new Date(post.discovered).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</small></span></div>
  {related.length>0&&<section className="nearby-research"><div className="section-kicker"><span>{figures.length?'03':'02'} / KEEP EXPLORING</span><span>SHARED TOPICS</span></div>{related.map((a,i)=><button key={a.id} onClick={()=>onChoose(a.id)}><span>{String(i+1).padStart(2,'0')}</span><div><small>{a.source_name}</small><strong>{a.title}</strong></div><span>↗</span></button>)}</section>}
  <small className="reading-estimate">*Reading time and media counts describe the captured material. Figures and demos have not been interpreted.</small>
 </div>;
}
