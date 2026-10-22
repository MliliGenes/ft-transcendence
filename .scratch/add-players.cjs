const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
function request(method,path,body,token) {
  return new Promise((resolve,reject)=>{
    const req=https.request('https://localhost'+path,{method,rejectUnauthorized:false,headers:{'Content-Type':'application/json',Origin:'https://localhost','X-Requested-With':'XMLHttpRequest',...(token?{Authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',d=>data+=d);res.on('end',()=>{let json;try{json=JSON.parse(data)}catch{json=data}if(res.statusCode>=400)reject(Error(`${method} ${path} ${res.statusCode} ${JSON.stringify(json)}`));else resolve(json)})});req.on('error',reject);req.setTimeout(120000,()=>req.destroy(Error('Request timeout')));req.end(body?JSON.stringify(body):undefined);
  });
}
(async()=>{
  const players=JSON.parse(fs.readFileSync('.scratch/players.json','utf8'));
  const existing=new Set(players.map(p=>p.username));
  const admin=await request('POST','/api/auth/login',{email:env.SUPERADMIN_EMAIL,password:env.SUPERADMIN_PASSWORD});
  for(let i=3;i<=4;i++)if(!existing.has(`player${i}`))players.push({username:`player${i}`,email:`player${i}@example.com`,password:crypto.randomBytes(10).toString('hex')});
  for(const p of players.slice(2)){
    try{await request('POST','/api/superadmin/users',p,admin.accessToken)}catch(e){if(!e.message.includes('409'))throw e}
    await request('POST','/api/auth/login',{email:p.email,password:p.password});
  }
  fs.writeFileSync('.scratch/players.json',JSON.stringify(players,null,2));
  fs.writeFileSync('.scratch/local-accounts.txt',players.map(p=>`${p.username} (${p.email})\nPassword: ${p.password}`).join('\n\n')+'\n');
  console.log('Four player accounts exist and all can log in. Credentials saved locally.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
