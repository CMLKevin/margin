import {requireServer,publicSettings,updateSettings,readSettings,mcpToken,jinaKey} from '../../../server/settings.mjs';
import {collectorStatus} from '../../../lib/collection-jobs.ts';
export const runtime='nodejs',dynamic='force-dynamic';
export async function GET(req:Request){return requireServer(req)||Response.json({...publicSettings(),collector:await collectorStatus()});}
export async function POST(req:Request){const denied=requireServer(req);if(denied)return denied;try{
 const body:any=await req.json();
 if(body.action==='mcp_config'){const origin=process.env.MARGIN_PUBLIC_URL||new URL(req.url).origin;return Response.json({endpoint:origin+'/mcp',token:mcpToken(),config:{mcpServers:{margin:{type:'http',url:origin+'/mcp',headers:{Authorization:'Bearer '+mcpToken()}}}},stdio:{command:'node',args:[process.cwd()+'/scripts/mcp-stdio.mjs']}});}
 if(body.action==='test_jina'){
  const key=String(body.key||jinaKey()).trim();if(!key)return Response.json({error:'Paste a Jina Reader key first.'},{status:400});
  const response=await fetch('https://r.jina.ai/https://example.com',{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)return Response.json({error:response.status===401||response.status===403?'Jina did not accept this key. Check it in your Jina account.':`Jina returned HTTP ${response.status}. Your account may be rate limited or out of credits.`},{status:400});
  await response.arrayBuffer();return Response.json({ok:true,message:'Jina Reader accepted the key.'});
 }
 const patch:Record<string,any>={};
 if('jinaApiKey' in body){if(process.env.JINA_API_KEY)throw new Error('This key is set through JINA_API_KEY. Change the environment variable to replace it.');const value=String(body.jinaApiKey).trim();if(value.length>500||/[\r\n]/.test(value))throw new Error('Use a single Reader API key.');patch.jinaApiKey=value;}
 if('autoCollect' in body)patch.autoCollect=!!body.autoCollect;
 if('intervalMinutes' in body){const n=Number(body.intervalMinutes);if(!Number.isInteger(n)||n<15||n>1440)throw new Error('Choose an interval from 15 to 1440 minutes.');patch.intervalMinutes=n;}
 if(body.action==='finish')patch.onboardingComplete=true;
 updateSettings(patch);return Response.json({ok:true,...publicSettings()});
 }catch(e:any){return Response.json({error:e.message},{status:400});}}
