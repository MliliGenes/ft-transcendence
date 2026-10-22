const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x && !x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
function request(method,path,body,token) {
  return new Promise((resolve,reject)=>{
    const req=https.request('https://localhost'+path,{method,rejectUnauthorized:false,headers:{'Content-Type':'application/json',Origin:'https://localhost','X-Requested-With':'XMLHttpRequest',...(token?{Authorization:'Bearer '+token}:{})}},res=>{
      let data='';res.on('data',d=>data+=d);res.on('end',()=>{let parsed;try{parsed=JSON.parse(data);}catch{parsed=data;}
      if(res.statusCode>=400)reject(Error(method+' '+path+' '+res.statusCode+' '+JSON.stringify(parsed)));else resolve(parsed);});
    });req.on('error',reject);req.setTimeout(120000,()=>req.destroy(Error('Request timeout')));req.end(body?JSON.stringify(body):undefined);
  });
}
(async()=>{
  await request('GET','/');await request('GET','/play/');console.log('Account and game pages: OK');
  const admin=await request('POST','/api/auth/login',{email:env.SUPERADMIN_EMAIL,password:env.SUPERADMIN_PASSWORD});console.log('Real account login: OK');
  let players;
  if(fs.existsSync('.scratch/players.json'))players=JSON.parse(fs.readFileSync('.scratch/players.json','utf8'));
  else {players=[1,2].map(i=>({username:'player'+i,email:'player'+i+'@example.com',password:crypto.randomBytes(10).toString('hex')}));fs.writeFileSync('.scratch/players.json',JSON.stringify(players,null,2));}
  const tokens=[];
  for(const p of players){try{await request('POST','/api/superadmin/users',p,admin.accessToken);}catch(e){if(!e.message.includes('409'))throw e;}const s=await request('POST','/api/auth/login',{email:p.email,password:p.password});tokens.push(s.accessToken);await request('GET','/api/lobby/active',null,s.accessToken);}
  console.log('Two local player accounts and authenticated lobby: OK');
  const room=await request('POST','/api/lobby/rooms',{mode:'1v1'},tokens[0]);
  await request('POST','/api/lobby/rooms/join',{code:room.room.code},tokens[1]);
  for(const t of tokens)await request('POST','/api/lobby/rooms/'+room.room.id+'/ready',{ready:true},t);
  const {matchId}=await request('POST','/api/lobby/rooms/'+room.room.id+'/start',{},tokens[0]);
  const base='/api/matches/'+matchId;
  try {
    await request('POST',base+'/start',{},tokens[0]);
    await request('POST',base+'/begin',{},tokens[0]);
    const snapshot=await request('GET',base+'/snapshot',null,tokens[0]);
    const code=snapshot.problem.problemVersionId==='even-ledger'?'def ledger_sum(nums):\n    return sum(v if i % 2 == 0 else -v for i, v in enumerate(nums))\n':'print(int(input()) * 2)\n';
    const run=await request('POST',base+'/run',{code,language:'Python'},tokens[0]);
    console.log('Match creation, round start, real Python execution:',JSON.stringify(run));
    for(const token of tokens)await request('POST',base+'/submit',{code,language:'Python'},token);
    let result;
    for(let i=0;i<30;i++){result=await request('GET',base+'/snapshot',null,tokens[0]);if(result.reveal)break;await new Promise(r=>setTimeout(r,1000));}
    if(!result.reveal)throw Error('Score reveal not received');
    console.log('Both submissions and score reveal:',JSON.stringify(result.reveal));
  } finally {await request('POST',base+'/leave',{},tokens[0]);}
  fs.writeFileSync('.scratch/local-accounts.txt',players.map(p=>p.email+'\nPassword: '+p.password).join('\n\n')+'\n');
  console.log('Local player credentials saved in .scratch/local-accounts.txt');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
