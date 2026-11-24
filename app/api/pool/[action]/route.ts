import {sendPredictionEmail} from '../../../../lib/email';
import {NextRequest, NextResponse} from 'next/server';
import {birthTime, csvCell, prediction} from '../../../../lib/rules';
import {collection, correct, db, entries, inviteMatches, isAdmin, live, rpc, settings, signIn} from '../../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {params: Promise<{action:string}>};
const headers = {'Cache-Control':'no-store'};
const json = (value: unknown, status = 200) => NextResponse.json(value, {status, headers});
const error = (message: string, status: number) => json({error:message}, status);
const cookie = {httpOnly:true, sameSite:'strict' as const, secure:process.env.NODE_ENV === 'production', path:'/api/pool'};
const failed = () => error('The pool service is temporarily unavailable. Try again.', 503);

export async function GET(request: NextRequest, context: Context) {
  const {action} = await context.params;
  if (!live()) return error('The live pool is disabled.', 404);
  try {
    if (action === 'status') {
      if (!inviteMatches(request.cookies.get('pool_invite')?.value)) return error('Open your private invitation link.', 401);
      return json({collection:collection(), closed:!!(await settings()).birth_local});
    }
    if (!(await isAdmin(request))) return error('Organizer sign-in required.', 401);
    if (action === 'dashboard') {
      const after = Number(request.nextUrl.searchParams.get('after') ?? 0);
      if (!Number.isSafeInteger(after) || after < 0) return error('Invalid page.', 400);
      const [page, pool, totals] = await Promise.all([
        entries(after,51), settings(), rpc<{entries:number;received:number;collected_cents:number}[]>('pool_totals'),
      ]);
      return json({entries:page.slice(0,50).map(entry => ({...entry, correct:correct(entry,pool.birth_local)})),
        next:page.length > 50 ? page[49].id : null, birth:pool.birth_local, totals:totals[0], collection:collection()});
    }
    if (action === 'export') {
      const birth = (await settings()).birth_local;
      const end = (await db<{id:number}[]>('predictions?select=id&order=id.desc&limit=1'))[0]?.id ?? 0;
      const encoder = new TextEncoder();
      let cursor = 0;
      let started = false;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (!started) {
            started = true;
            controller.enqueue(encoder.encode('\uFEFFReference,Name,Email,Wishes,Date,Period,Second date,Second period,Expected CAD,Received CAD,Received at UTC,Submitted at UTC,Correct\r\n'));
            return;
          }
          if (cursor >= end) return controller.close();
          const batch = (await entries(cursor, 250)).filter(entry => entry.id <= end);
          if (!batch.length) return controller.close();
          cursor = batch[batch.length - 1].id;
          controller.enqueue(encoder.encode(batch.map(entry => [
            entry.reference, entry.name, entry.email, entry.wishes,
            '2027-01-' + String(entry.day).padStart(2,'0'), entry.period,
            entry.second_day ? '2027-01-' + String(entry.second_day).padStart(2,'0') : '', entry.second_period, entry.gift_requested ? '5.00':'0.00',
            entry.received_at ? '5.00':'0.00', entry.received_at, entry.created_at, correct(entry,birth) ? 'Yes':'No',
          ].map(csvCell).join(',')).join('\r\n') + '\r\n'));
        },
      });
      return new Response(body, {headers:{...headers,'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename="baby-arrival-pool-2027.csv"'}});
    }
    return error('Unknown action.', 404);
  } catch { return failed(); }
}

export async function POST(request: NextRequest, context: Context) {
  const {action} = await context.params;
  if (!live()) return error('The live pool is disabled.', 404);
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin !== request.nextUrl.origin && (!host || (origin !== 'https://' + host && origin !== 'http://' + host))) return error('Invalid request origin.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return error('Expected JSON.', 415);
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error('Missing request body.', 400);
    const decoder = new TextDecoder();
    let raw = '';
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return error('Request is too large.', 413); }
      raw += decoder.decode(chunk.value,{stream:true});
    }
    body = JSON.parse(raw + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) return error('Invalid request.', 400);
  } catch { return error('Invalid request.', 400); }
  try {
    if (action === 'invite') {
      if (!inviteMatches(body.token)) return error('This invitation is invalid.', 401);
      const response = json({ok:true});
      response.cookies.set('pool_invite', body.token, {...cookie,maxAge:60*60*24*30});
      return response;
    }
    if (action === 'submit') {
      if (!inviteMatches(request.cookies.get('pool_invite')?.value)) return error('Open your private invitation link.', 401);
      let entry;
      try { entry = prediction(body); }
      catch (cause) { return error((cause as Error).message,400); }
      const gift = collection();
      const transferEmail = gift ? process.env.INTERAC_TRANSFER_EMAIL : undefined;
      if (gift && !transferEmail) return failed();
      const [receipt] = await rpc<{reference:string;gift_requested:boolean}[]>('record_prediction_bundle', {
        p_request_id:entry.requestId,p_day:entry.day,p_period:entry.period,p_name:entry.name,
        p_second_day:entry.secondDay,p_second_period:entry.secondPeriod,
        p_email:entry.email,p_wishes:entry.wishes,p_gift:gift,
      });
      if (!receipt) return error('The pool is closed or this submission already changed. Refresh the page.',409);
      const emailStatus = await sendPredictionEmail({...entry, reference:receipt.reference, giftRequested:receipt.gift_requested});
      return json({reference:receipt.reference, transferEmail:receipt.gift_requested ? transferEmail ?? null : null, emailStatus});
    }
    if (action === 'login') {
      if (typeof body.email !== 'string' || typeof body.password !== 'string') return error('Enter your email and password.',400);
      const session = await signIn(body.email,body.password);
      if (!session) return error('Organizer sign-in failed.',401);
      const response = json({ok:true});
      response.cookies.set('pool_admin',session.access_token,{...cookie,maxAge:Math.min(session.expires_in,3600)});
      return response;
    }
    if (action === 'logout') {
      const response = json({ok:true});
      response.cookies.set('pool_admin','',{...cookie,maxAge:0});
      return response;
    }
    if (!(await isAdmin(request))) return error('Organizer sign-in required.',401);
    if (action === 'delete') {
      if (typeof body.reference !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.reference)) return error('Invalid reference.',400);
      if (!(await rpc<boolean>('delete_prediction',{p_reference:body.reference}))) return error('Prediction not found.',404);
      return json({ok:true});
    }
    if (action === 'confirm') {
      if (!collection()) return error('Gift collection is disabled.',409);
      if (typeof body.reference !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.reference)) return error('Invalid reference.',400);
      if (!(await rpc<boolean>('confirm_gift',{p_reference:body.reference}))) return error('No contribution is due for this prediction.',404);
      return json({ok:true});
    }
    if (action === 'birth') {
      let birth;
      try { birth = birthTime(body.birth); }
      catch (cause) { return error((cause as Error).message,400); }
      await db('pool_settings?id=eq.1','PATCH',{birth_local:birth});
      return json({ok:true});
    }
    return error('Unknown action.',404);
  } catch { return failed(); }
}
