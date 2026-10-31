import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const {mcpToken}=await import('../server/settings.mjs');
const endpoint=process.env.MARGIN_MCP_URL||'http://localhost:'+(process.env.PORT||3000)+'/mcp';
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',async line=>{if(!line.trim())return;let message;try{message=JSON.parse(line);const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+mcpToken()},body:JSON.stringify(message)});if(r.status===202||r.status===204)return;if(!r.ok)throw new Error('Margin HTTP '+r.status);const result=await r.json();process.stdout.write(JSON.stringify(result)+'\n');}catch{if(message&&'id' in message)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'Cannot reach your Margin server. Start it with npm start, and check the endpoint and MCP token in Setup & collection.'}})+'\n');else process.stderr.write('Margin MCP could not process this notification.\n');}});
