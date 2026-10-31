export function publicUrl(raw:string, base?:string) {
  if(typeof raw!=='string'||!raw.trim())throw new Error('Use a public HTTPS website URL.');
  if(!base&&!/^[a-z][a-z\d+.-]*:/i.test(raw))raw='https://'+raw.trim();
  const u=new URL(raw,base),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!host.includes('.')||/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.test|.*\.invalid)$/.test(host)||/^[\d.]+$/.test(host)||host.includes(':'))throw new Error('Use a public HTTPS website URL.');
  u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/.test(k))u.searchParams.delete(k);
  return u.href;
}
