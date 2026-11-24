import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedAdmin, signIn, isAdmin} from '../lib/server.ts';

function env(t, name, value) { const before = process.env[name]; process.env[name] = value; t.after(() => { if (before === undefined) delete process.env[name]; else process.env[name] = before; }); }

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';

test('both named organizers pass login and session checks; unlisted users fail', async t => {
  env(t, 'ADMIN_USER_IDS', `${first}, ${second}`);
  env(t, 'SUPABASE_URL', 'https://example.supabase.co');
  env(t, 'SUPABASE_PUBLISHABLE_KEY', 'test-key');
  let userId;
  t.mock.method(globalThis, 'fetch', async url => new Response(JSON.stringify(
    String(url).includes('/token') ? {user:{id:userId},access_token:'test-session',expires_in:3600} : {id:userId}
  )));
  const request = {cookies:{get:()=>({value:'test-session'})}};
  for (const id of [first, second, outsider, undefined]) {
    userId = id;
    const expected = id === first || id === second;
    assert.equal(!!(await signIn('test@example.com','test-password')), expected);
    assert.equal(await isAdmin(request), expected);
  }
  assert.equal(await isAdmin({cookies:{get:()=>undefined}}), false);
});

test('empty or malformed configuration fails closed and plural configuration overrides legacy', t => {
  env(t, 'ADMIN_USER_ID', first);
  for (const value of ['', ' ', `${first},invalid`, '*']) {
    env(t, 'ADMIN_USER_IDS', value);
    assert.equal(allowedAdmin(first), false);
  }
  env(t, 'ADMIN_USER_IDS', second);
  assert.equal(allowedAdmin(first), false);
  assert.equal(allowedAdmin(second), true);
});
