begin;
-- Existing rows remain single entries with their original payment state.
alter table public.predictions
  add column second_day smallint,
  add column second_period text,
  add constraint prediction_second_slot check (
    (second_day is null and second_period is null) or
    (second_day is not null and second_period is not null and second_day between 1 and 31 and second_period in ('AM','PM'))
  );
create function public.record_prediction_bundle(
  p_request_id uuid, p_day smallint, p_period text, p_name text,
  p_email text, p_wishes text, p_gift boolean, p_second_day smallint, p_second_period text
)
returns table (reference uuid, gift_requested boolean)
language plpgsql
set search_path = ''
as $$
declare
  birth timestamp;
  saved public.predictions%rowtype;
begin
  if p_second_day is null or p_second_period is null then return; end if;
  select birth_local into strict birth from public.pool_settings where id = 1 for share;
  select * into saved from public.predictions where request_id = p_request_id;
  if not found then
    if birth is not null then return; end if;
    insert into public.predictions (request_id, day, period, second_day, second_period, name, email, wishes, gift_requested)
      values (p_request_id, p_day, p_period, p_second_day, p_second_period, p_name, p_email, p_wishes, p_gift)
      on conflict (request_id) do nothing;
    select * into strict saved from public.predictions where request_id = p_request_id;
  end if;
  if (saved.day, saved.period, saved.second_day, saved.second_period, saved.name, saved.email, saved.wishes)
     is distinct from (p_day, p_period, p_second_day, p_second_period, p_name, p_email, p_wishes) then return; end if;
  return query select saved.reference, saved.gift_requested;
end;
$$;


create or replace function public.pool_totals()
returns table (entries bigint, received bigint, collected_cents bigint)
language sql stable set search_path = '' as $$
  select coalesce(sum(case when second_day is null then 1 else 2 end),0)::bigint,
    count(received_at), count(received_at) * 500 from public.predictions;
$$;
revoke all on function public.record_prediction_bundle(uuid, smallint, text, text, text, text, boolean, smallint, text) from public, anon, authenticated;
grant execute on function public.record_prediction_bundle(uuid, smallint, text, text, text, text, boolean, smallint, text) to service_role;
commit;
