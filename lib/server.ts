import {createHash, timingSafeEqual} from 'node:crypto';
import type { NextRequest } from 'next/server';

export const live = () => process.env.APP_MODE === 'live';
export const collection = () => live() && process.env.GIFT_COLLECTION_ENABLED === 'true';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error('Service configuration is incomplete.');
  return value;
}

export function inviteMatches(value: unknown) {
  const token = required('INVITE_TOKEN');
  if (token.length < 32) throw new Error('Invitation configuration is incomplete.');
  const digest = (input: string) => createHash('sha256').update(input).digest();
  return typeof value === 'string' && timingSafeEqual(digest(value), digest(token));
}

async function supabase(path: string, key: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  headers.set('apikey', key);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (options.body) headers.set('Content-Type', 'application/json');
  return fetch(new URL(path, required('SUPABASE_URL')), {...options, headers, cache:'no-store'});
}

export async function db<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await supabase('/rest/v1/' + path, key, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
  }, key.startsWith('eyJ') ? key : undefined);
  if (!response.ok) throw new Error('Database request failed (' + response.status + ').');
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const rpc = <T>(method: string, body = {}) => db<T>('rpc/' + method, 'POST', body);

export async function signIn(email: string, password: string) {
  const response = await supabase('/auth/v1/token?grant_type=password', required('SUPABASE_PUBLISHABLE_KEY'), {
    method:'POST', body: JSON.stringify({email, password}),
  });
  if (!response.ok) return null;
  const session = await response.json();
  return session.user?.id === required('ADMIN_USER_ID') ? session as {access_token: string; expires_in: number} : null;
}

export async function isAdmin(request: NextRequest) {
  const token = request.cookies.get('pool_admin')?.value;
  if (!token) return false;
  const response = await supabase('/auth/v1/user', required('SUPABASE_PUBLISHABLE_KEY'), {}, token);
  return response.ok && (await response.json()).id === required('ADMIN_USER_ID');
}

export type Entry = {
  id: number; reference: string; day: number; period: 'AM'|'PM'; name: string;
  email: string; wishes: string; gift_requested: boolean; received_at: string|null; created_at: string;
};

export const entries = (after: number, limit: number) => db<Entry[]>(
  'predictions?select=id,reference,day,period,name,email,wishes,gift_requested,received_at,created_at' +
  '&order=id.asc&id=gt.' + after + '&limit=' + limit,
);
export const settings = async () =>
  (await db<{birth_local:string|null}[]>('pool_settings?id=eq.1&select=birth_local'))[0];

export function correct(entry: Entry, birth: string|null) {
  return !!birth && birth.slice(0,7) === '2027-01' && Number(birth.slice(8,10)) === entry.day &&
    (Number(birth.slice(11,13)) < 12 ? 'AM' : 'PM') === entry.period;
}
