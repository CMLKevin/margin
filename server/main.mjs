import fs from 'node:fs';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readSettings} from './settings.mjs';
import {validateHostAndOrigin,isInternalAuthorization,isMcpAuthorization,validSession,passwordMatches,makeSession,loginPage} from './security.mjs';
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const dev=process.argv.includes('--dev');process.env.NODE_ENV=dev?'development':'production';
const port=Number(process.env.PORT||3000),host=process.env.MARGIN_HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
if(!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.MARGIN_PASSWORD)throw new Error('Set MARGIN_PASSWORD before listening on a non-loopback address.');
process.env.MARGIN_INTERNAL_TOKEN=randomBytes(32).toString('hex');readSettings();
const {default:next}=await import('next');const app=next({dev,hostname:host,port});await app.prepare();const handle=app.getRequestHandler();
const attempts=new Map();
const server=http.createServer(async(req,res)=>{
 try{
  const requestHost=req.headers.host||'',origin=req.headers.origin;
  if(!validateHostAndOrigin(requestHost,origin,port)){res.writeHead(403);res.end('Invalid host or origin.');return;}
  const url=new URL(req.url,'http://'+requestHost),internal=isInternalAuthorization(req.headers.authorization);
  if(url.pathname==='/login'){
   if(req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(loginPage());return;}
   if(req.method!=='POST'){res.writeHead(405);res.end();return;}
   const address=req.socket.remoteAddress||'unknown',previous=attempts.get(address)||{count:0,until:0};if(previous.until>Date.now()&&previous.count>=10){res.writeHead(429);res.end('Try again in 15 minutes.');return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>8192){res.writeHead(413);res.end();return;}}
   if(!passwordMatches(new URLSearchParams(body).get('password'))){attempts.set(address,{count:previous.until>Date.now()?previous.count+1:1,until:Date.now()+900_000});res.writeHead(401,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(loginPage('invalid'));return;}
   attempts.delete(address);const secure=process.env.MARGIN_PUBLIC_URL?.startsWith('https:')?'; Secure':'';res.writeHead(303,{'set-cookie':'margin_session='+makeSession()+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+secure,location:'/'});res.end();return;
  }
  const mcp=url.pathname==='/mcp';
  if(mcp&&!isMcpAuthorization(req.headers.authorization)){res.writeHead(401,{'www-authenticate':'Bearer realm="Margin MCP"','content-type':'application/json'});res.end(JSON.stringify({error:'MCP bearer token required. Copy a connection configuration from Setup & collection.'}));return;}
  if(!mcp&&!internal&&process.env.MARGIN_PASSWORD&&!validSession(req.headers.cookie)){res.writeHead(url.pathname.startsWith('/api/')?401:303,{...(url.pathname.startsWith('/api/')?{'content-type':'application/json'}:{location:'/login'})});res.end(url.pathname.startsWith('/api/')?JSON.stringify({error:'Sign in to this Margin instance.'}):'');return;}
  req.headers['x-margin-server']=process.env.MARGIN_INTERNAL_TOKEN;
  if(url.pathname.startsWith('/api/')||mcp)res.setHeader('cache-control','no-store');
  await handle(req,res);
 }catch{if(!res.headersSent)res.writeHead(500);res.end('Margin could not complete this request.');}
});
server.on('upgrade',(req,socket,head)=>{if(!validateHostAndOrigin(req.headers.host||'',req.headers.origin,port)||process.env.MARGIN_PASSWORD&&!validSession(req.headers.cookie)){socket.destroy();return;}app.getUpgradeHandler()(req,socket,head);});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
console.log('Margin is ready: http://localhost:'+port+' · '+(dev?'development':'production'));
console.log('Data stays in '+(process.env.MARGIN_DATA_DIR||'.margin')+'. Open Setup & collection for Reader and MCP configuration.');
let stopping=false,checking=false;
async function tick(){if(stopping||checking||process.env.MARGIN_DISABLE_SCHEDULER==='1')return;const settings=readSettings();if(!settings.onboardingComplete||!settings.autoCollect)return;checking=true;try{
 const headers={Authorization:'Bearer '+process.env.MARGIN_INTERNAL_TOKEN};const base='http://'+(host==='::1'?'[::1]':host==='0.0.0.0'?'127.0.0.1':host)+':'+port;
 const status=await fetch(base+'/api/collector',{headers}).then(r=>r.json());const finished=status.finished?Date.parse(status.finished):0;
 if(!status.running&&Date.now()-finished>=settings.intervalMinutes*60_000){console.log('Checking research sources…');const r=await fetch(base+'/api/collector',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('Collector HTTP '+r.status);console.log('Source check finished.');}
 }catch(e){console.error('Background collection could not finish:',e.message);}finally{checking=false;}}
const timer=setInterval(tick,15_000);timer.unref();void tick();
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);server.close();await app.close();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
