import {requireServer,publicSettings} from '../../../server/settings.mjs';
import {collectorStatus,runCollection} from '../../../lib/collection-jobs.ts';
export const runtime='nodejs',dynamic='force-dynamic';
export async function GET(req:Request){return requireServer(req)||Response.json({...await collectorStatus(),...publicSettings()});}
export async function POST(req:Request){const denied=requireServer(req);if(denied)return denied;try{const body:any=await req.json();return Response.json({ok:true,result:await runCollection(body.source_id)});}catch(e:any){return Response.json({error:e.message},{status:409});}}
