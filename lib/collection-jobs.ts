import {getDatabase} from './database.ts';
import {syncAll,syncSource} from './library.ts';
import {readSettings} from '../server/settings.mjs';
export async function collectorStatus(){const d=getDatabase(),job=await d.prepare("SELECT started,finished,status,result,lease_until FROM collector_jobs WHERE id='collector'").first<any>();return {...job,result:job?.result?JSON.parse(job.result):null,running:!!job&&job.lease_until>Date.now(),autoCollect:readSettings().autoCollect};}
export async function runCollection(sourceId?:string){
 const d=getDatabase(),owner=crypto.randomUUID(),started=new Date().toISOString();
 const claim=await d.prepare("UPDATE collector_jobs SET owner=?,lease_until=?,started=?,status='running' WHERE id='collector' AND lease_until<?").bind(owner,Date.now()+3_600_000,started,Date.now()).run();
 if(!claim.meta.changes)throw new Error('A collection check is already running. New posts will appear as it finishes.');
 const heartbeat=setInterval(()=>{void d.prepare("UPDATE collector_jobs SET lease_until=? WHERE id='collector' AND owner=?").bind(Date.now()+3_600_000,owner).run();},30_000);heartbeat.unref();
 try{const result=sourceId?await syncSource(sourceId):await syncAll();await d.prepare("UPDATE collector_jobs SET lease_until=0,finished=?,status='complete',result=? WHERE id='collector' AND owner=?").bind(new Date().toISOString(),JSON.stringify(result),owner).run();return result;}
 catch(e){await d.prepare("UPDATE collector_jobs SET lease_until=0,finished=?,status='failed',result=? WHERE id='collector' AND owner=?").bind(new Date().toISOString(),JSON.stringify({error:e instanceof Error?e.message:'Collection failed'}),owner).run();throw e;}
 finally{clearInterval(heartbeat);}
}
