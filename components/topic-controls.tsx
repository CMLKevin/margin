'use client';
import {topicGroups,topicDescription} from '../lib/topics';
type Facet={name:string;count:number;group:string;description:string};
export function TopicOptions({facets,selected}:{facets:Facet[];selected:string}){
 const groups=[...topicGroups,'Other'];return <><option value="all">All topics</option>{groups.map(group=>{const choices=facets.filter(t=>t.group===group).sort((a,b)=>a.name.localeCompare(b.name));return choices.length?<optgroup key={group} label={group}>{choices.map(t=><option key={t.name} value={t.name} title={t.description}>{t.name} ({t.count})</option>)}</optgroup>:null;})}{selected!=='all'&&!facets.some(t=>t.name===selected)&&<option value={selected}>{selected} (0)</option>}</>;
}
export function TopicChips({facets,selected,onSelect}:{facets:Facet[];selected:string;onSelect:(value:string)=>void}){
 const popular=facets.slice(0,7);const active=facets.find(t=>t.name===selected);if(active&&!popular.includes(active))popular.push(active);
 return <div className="topic-chips"><button className={selected==='all'?'active':''} onClick={()=>onSelect('all')}>All topics</button>{popular.map(t=><button key={t.name} title={topicDescription(t.name)} className={selected===t.name?'active':''} onClick={()=>onSelect(selected===t.name?'all':t.name)}>{t.name}<span>{t.count}</span></button>)}</div>;
}
