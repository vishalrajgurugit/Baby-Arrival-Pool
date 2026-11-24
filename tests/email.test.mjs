import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationText,sendPredictionEmail} from '../lib/email.ts';
const entry={reference:'00000000-0000-4000-8000-000000000001',name:'Test',email:'test@example.com',day:21,period:'PM',giftRequested:false};
function env(t, values) {
  const old={...process.env}; Object.assign(process.env,values);
  t.after(()=>{for(const key of Object.keys(values)) {if(old[key]===undefined) delete process.env[key]; else process.env[key]=old[key];}});
}
test('payment instructions require a gift-bearing prediction, active collection and recipient',()=>{
  assert.match(confirmationText(entry,true,'recipient@example.com'),/No payment is due/);
  for(const [open,recipient] of [[false,'recipient@example.com'],[true,undefined]]) {
    const text=confirmationText({...entry,giftRequested:true},open,recipient);
    assert.doesNotMatch(text,/Send \$5|recipient@example.com/);
  }
  const text=confirmationText({...entry,giftRequested:true},true,'recipient@example.com');
  assert.match(text,/Send \$5 CAD by Interac e-Transfer to recipient@example.com/);
  assert.ok(text.includes(entry.reference)); assert.match(text,/January 21, 2027 · PM/);
});
test('disabled email never contacts a provider',async t=>{
  env(t,{APP_MODE:'live',EMAIL_ENABLED:'false'});
  t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected request');});
  assert.equal(await sendPredictionEmail(entry),'disabled');
});
for(const mode of ['success','rejected','timeout','bookkeeping-failed','claim-failed']) {
  test('email '+mode+' does not throw or resend a claimed prediction',async t=>{
    env(t,{APP_MODE:'live',EMAIL_ENABLED:'true',EMAIL_FROM:'test@example.com',RESEND_API_KEY:'test',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',GIFT_COLLECTION_ENABLED:'false'});
    let claimed=false, sent=0;
    t.mock.method(globalThis,'fetch',async (url,options)=>{
      if(String(url).includes('claim_prediction_email')) {
        if(mode==='claim-failed') throw Error('database unavailable');
        const acquired=!claimed; claimed=true; return Response.json(acquired);
      }
      if(String(url).startsWith('https://api.resend.com/')) {
        sent++; assert.equal(options.headers['Idempotency-Key'],'prediction/'+entry.reference);
        assert.match(JSON.parse(options.body).text,/No payment is due/);
        if(mode==='timeout') throw Error('timeout');
        return mode==='rejected' ? new Response('',{status:429}) : Response.json({id:'provider-test-id'});
      }
      if(mode==='bookkeeping-failed') throw Error('database unavailable');
      return new Response(null,{status:204});
    });
    assert.equal(await sendPredictionEmail(entry),['success','bookkeeping-failed'].includes(mode)?'submitted':'unavailable');
    assert.equal(await sendPredictionEmail(entry),mode==='claim-failed'?'unavailable':'already_requested');
    assert.equal(sent,mode==='claim-failed'?0:1);
  });
}
