-- Run in a dedicated test Supabase project after applying the migration.
begin;

do $$
declare
  first_ref uuid;
  retry_ref uuid;
  second_ref uuid;
  total bigint;
begin
  select reference into strict first_ref from public.record_prediction(
    '00000000-0000-4000-8000-000000000001',21::smallint,'AM','Alex','alex@example.com','',true);
  select reference into strict retry_ref from public.record_prediction(
    '00000000-0000-4000-8000-000000000001',21::smallint,'AM','Alex','alex@example.com','',true);
  select reference into strict second_ref from public.record_prediction(
    '00000000-0000-4000-8000-000000000002',21::smallint,'AM','Alex','alex@example.com','',false);
  if first_ref <> retry_ref or first_ref = second_ref then raise exception 'Reference/idempotency failure'; end if;
  if public.confirm_gift(second_ref) then raise exception 'Confirmed a gift that was not requested'; end if;
  if not public.confirm_gift(first_ref) or not public.confirm_gift(first_ref) then raise exception 'Gift not confirmed'; end if;
  select collected_cents into total from public.pool_totals();
  if total <> 500 then raise exception 'Incorrect amount collected'; end if;
  update public.pool_settings set birth_local = '2027-01-21 11:59' where id = 1;
  if exists (select from public.record_prediction(
    '00000000-0000-4000-8000-000000000003',21::smallint,'AM','Late','late@example.com','',true))
  then raise exception 'A new prediction was accepted after birth'; end if;
  if has_table_privilege('anon','public.predictions','SELECT')
     or has_table_privilege('authenticated','public.predictions','SELECT')
     or has_function_privilege('anon','public.pool_totals()','EXECUTE')
     or has_function_privilege('authenticated','public.pool_totals()','EXECUTE')
  then raise exception 'Unexpected public or authenticated access'; end if;
end
$$;

rollback;
