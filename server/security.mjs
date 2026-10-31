import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readSettings,mcpToken,equalSecret} from './settings.mjs';
export function validateHostAndOrigin(host,origin,port){
 const allowed=new Set(['localhost:'+port,'127.0.0.1:'+port,'[::1]:'+port]);if(process.env.MARGIN_PUBLIC_URL)allowed.add(new URL(process.env.MARGIN_PUBLIC_URL).host);
 if(!allowed.has(host))return false;
 if(origin){try{const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||!allowed.has(u.host)||u.host!==host)return false;}catch{return false;}}
 return true;
}
export function isInternalAuthorization(value){return equalSecret(value,'Bearer '+process.env.MARGIN_INTERNAL_TOKEN);}
export function isMcpAuthorization(value){return equalSecret(value,'Bearer '+mcpToken());}
export function makeSession(){const expires=String(Date.now()+12*3_600_000),nonce=randomBytes(12).toString('hex'),payload=expires+'.'+nonce;return payload+'.'+createHmac('sha256',readSettings().sessionSecret).update(payload).digest('hex');}
export function validSession(cookie){const value=String(cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('margin_session='))?.slice(15);if(!value)return false;const parts=value.split('.');if(parts.length!==3||!Number.isFinite(Number(parts[0]))||Number(parts[0])<Date.now())return false;return equalSecret(parts[2],createHmac('sha256',readSettings().sessionSecret).update(parts[0]+'.'+parts[1]).digest('hex'));}
export function passwordMatches(value){if(!process.env.MARGIN_PASSWORD)return false;const salt=readSettings().sessionSecret;return timingSafeEqual(scryptSync(String(value),salt,32),scryptSync(process.env.MARGIN_PASSWORD,salt,32));}
export function loginPage(message=''){return '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Margin · Sign in</title><style>body{background:#151a16;color:#edf1e5;font:16px monospace;display:grid;place-items:center;min-height:100vh;margin:0}main{width:min(380px,85vw);border:1px solid #6d805e;padding:28px}h1{font-size:32px}p{line-height:1.7;color:#b0bdab}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;margin-top:12px;border:1px solid #6d805e}input{background:#202a20;color:#edf1e5}button{background:#c8ec9c;color:#202a20;cursor:pointer}</style><main><h1>margin</h1><p>Your research library is private. Enter the password configured by this instance’s owner.</p>'+ (message?'<p>Incorrect password. Try again.</p>':'')+'<form method="post" action="/login"><label for="password">Password</label><input id="password" name="password" type="password" required autofocus autocomplete="current-password"><button>Open library ↗</button></form></main></html>';}
