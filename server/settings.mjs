import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
export function dataDirectory(){return path.resolve(process.env.MARGIN_DATA_DIR||'.margin');}
export function readSettings(){
 const directory=dataDirectory();fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'settings.json');
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Cannot read local settings. Restore a valid settings.json from your backup.');}
 const value={version:1,onboardingComplete:false,jinaApiKey:'',mcpToken:randomBytes(32).toString('hex'),sessionSecret:randomBytes(32).toString('hex'),autoCollect:true,intervalMinutes:60};
 try{fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return value;}catch(e){if(e.code==='EEXIST')return JSON.parse(fs.readFileSync(file,'utf8'));throw e;}
}
export function updateSettings(patch){const value={...readSettings(),...patch};const file=path.join(dataDirectory(),'settings.json'),tmp=file+'.'+randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);return value;}
export function jinaKey(){return process.env.JINA_API_KEY?.trim()||readSettings().jinaApiKey||'';}
export function mcpToken(){return process.env.MARGIN_MCP_TOKEN?.trim()||readSettings().mcpToken;}
export function equalSecret(a,b){const aa=Buffer.from(a||''),bb=Buffer.from(b||'');return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb);}
export function internalRequest(req){return equalSecret(req.headers.get('x-margin-server'),process.env.MARGIN_INTERNAL_TOKEN);}
export function requireServer(req){if(!internalRequest(req))return Response.json({error:'Start Margin using npm run dev or npm start.'},{status:401});return null;}
export function publicSettings(){const s=readSettings();return {onboardingComplete:s.onboardingComplete,jinaConfigured:!!jinaKey(),jinaFromEnvironment:!!process.env.JINA_API_KEY,autoCollect:s.autoCollect,intervalMinutes:s.intervalMinutes,mcpEndpoint:'/mcp',storage:'SQLite on this machine'};}
