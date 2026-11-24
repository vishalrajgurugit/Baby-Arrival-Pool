-- Run in a dedicated test database after all migrations. Leaves no test rows.
begin;
do $$
declare a uuid; b uuid;
begin
  select reference into a from public.record_prediction('10000000-0000-4000-8000-000000000001',21::smallint,'AM','Test A','a@example.com','',false);
  select reference into b from public.record_prediction('10000000-0000-4000-8000-000000000002',21::smallint,'PM','Test B','b@example.com','',false);
  if not public.claim_prediction_email(a) then raise exception 'First claim denied'; end if;
  if public.claim_prediction_email(a) then raise exception 'Duplicate claim allowed'; end if;
  if not public.delete_prediction(a) then raise exception 'Delete failed'; end if;
  if public.delete_prediction(a) then raise exception 'Deleted missing prediction'; end if;
  if not exists(select from public.predictions where reference=b) then raise exception 'Unrelated prediction deleted'; end if;
  if exists(select from public.prediction_email_delivery where reference=a) then raise exception 'Email record not removed'; end if;
  if has_function_privilege('anon','public.delete_prediction(uuid)','EXECUTE') or
     has_function_privilege('authenticated','public.delete_prediction(uuid)','EXECUTE') then raise exception 'Client can delete'; end if;
end; $$;
rollback;
