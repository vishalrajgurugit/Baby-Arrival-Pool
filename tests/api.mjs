// Run after pnpm run build. Uses a local fake Supabase; never sends real email.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const first='00000000-0000-4000-8000-000000000001';
const second='00000000-0000-4000-8000-000000000002';
const other='00000000-0000-4000-8000-000000000003';
const rows=new Set([first,second]); let deletes=0;
const database=createServer(async (req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/auth/v1/user') {
    const token=req.headers.authorization?.slice(7);
    res.end(JSON.stringify({id:token==='first-session'?first:token==='second-session'?second:other})); return;
  }
  let raw=''; for await(const chunk of req) raw+=chunk;
  if(req.url==='/rest/v1/rpc/delete_prediction') {
    deletes++; const {p_reference}=JSON.parse(raw); res.end(JSON.stringify(rows.delete(p_reference))); return;
  }
  if(req.url==='/rest/v1/rpc/record_prediction') {res.end(JSON.stringify([{reference:other,gift_requested:false}]));return;}
  res.statusCode=404;res.end('{}');
});
await new Promise(resolve=>database.listen(0,'127.0.0.1',resolve));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const base='http://127.0.0.1:'+port;
const invite='synthetic-invite-token-for-local-testing-only';
let output='';
const app=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
  windowsHide:true,env:{...process.env,APP_MODE:'live',ADMIN_USER_IDS:first+','+second,INVITE_TOKEN:invite,
    SUPABASE_URL:'http://127.0.0.1:'+database.address().port,SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_PUBLISHABLE_KEY:'test',
    EMAIL_ENABLED:'true',RESEND_API_KEY:'',GIFT_COLLECTION_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
app.stdout.on('data',chunk=>{output+=chunk;});app.stderr.on('data',chunk=>{output+=chunk;});
async function post(action,body,session,origin=base) {
  return fetch(base+'/api/pool/'+action,{method:'POST',headers:{'content-type':'application/json',origin,
    cookie:session?'pool_admin='+session:''},body:JSON.stringify(body)});
}
try {
  let ready=false;for(let i=0;i<60;i++){try{await fetch(base);ready=true;break;}catch{await delay(100);}}
  assert.ok(ready,output);
  assert.equal((await fetch(base+'/api/pool/status')).status,401);
  assert.equal((await post('delete',{reference:first})).status,401);
  assert.equal((await post('delete',{reference:first},'outsider-session')).status,401);
  assert.equal((await post('delete',{reference:'invalid'},'first-session')).status,400);
  assert.equal((await post('delete',{reference:first},'first-session','https://other.example')).status,403);
  assert.equal(deletes,0);
  assert.equal((await post('delete',{reference:first},'first-session')).status,200);
  assert.ok(rows.has(second),'Unselected prediction must remain');
  assert.equal((await post('delete',{reference:first},'first-session')).status,404);
  assert.equal((await post('delete',{reference:second},'second-session')).status,200);
  const response=await fetch(base+'/api/pool/submit',{method:'POST',headers:{origin:base,'content-type':'application/json',cookie:'pool_invite='+invite},
    body:JSON.stringify({requestId:other,name:'Test',email:'test@example.com',day:21,period:'PM',wishes:''})});
  assert.equal(response.status,200);
  const receipt=await response.json();
  assert.equal(receipt.reference,other);assert.equal(receipt.emailStatus,'unavailable');assert.equal(receipt.transferEmail,null);
  console.log('API checks passed: guest gating, both organizers, outsider denial, scoped deletion, CSRF, and email failure preserves saved prediction.');
} finally {
  app.kill(); await new Promise(resolve=>app.once('exit',resolve));
  await new Promise(resolve=>database.close(resolve));
}
