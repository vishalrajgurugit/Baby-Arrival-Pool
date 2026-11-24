begin;

create table public.pool_settings (
  id integer primary key check (id = 1),
  birth_local timestamp without time zone
);
insert into public.pool_settings (id) values (1);

create table public.predictions (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  reference uuid not null default gen_random_uuid() unique,
  day smallint not null check (day between 1 and 31),
  period text not null check (period in ('AM','PM')),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  wishes text not null default '' check (char_length(wishes) <= 1000),
  gift_requested boolean not null default false,
  received_at timestamptz check (received_at is null or gift_requested),
  created_at timestamptz not null default now()
);
create index predictions_received on public.predictions (id) where received_at is not null;
alter table public.pool_settings enable row level security;
alter table public.predictions enable row level security;
revoke all on public.pool_settings, public.predictions from public, anon, authenticated;
grant select, update on public.pool_settings to service_role;
grant select, insert, update on public.predictions to service_role;
grant usage, select on sequence public.predictions_id_seq to service_role;

create function public.record_prediction(
  p_request_id uuid, p_day smallint, p_period text, p_name text,
  p_email text, p_wishes text, p_gift boolean
)
returns table (reference uuid, gift_requested boolean)
language plpgsql
set search_path = ''
as $$
declare
  birth timestamp;
  saved public.predictions%rowtype;
begin
  select birth_local into strict birth from public.pool_settings where id = 1 for share;
  select * into saved from public.predictions where request_id = p_request_id;
  if not found then
    if birth is not null then return; end if;
    insert into public.predictions (request_id, day, period, name, email, wishes, gift_requested)
      values (p_request_id, p_day, p_period, p_name, p_email, p_wishes, p_gift)
      on conflict (request_id) do nothing;
    select * into strict saved from public.predictions where request_id = p_request_id;
  end if;
  if (saved.day, saved.period, saved.name, saved.email, saved.wishes)
     is distinct from (p_day, p_period, p_name, p_email, p_wishes) then return; end if;
  return query select saved.reference, saved.gift_requested;
end;
$$;

create function public.confirm_gift(p_reference uuid)
returns boolean language sql set search_path = '' as $$
  with updated as (
    update public.predictions
      set received_at = coalesce(received_at, now())
      where reference = p_reference and gift_requested
      returning id
  ) select exists (select 1 from updated);
$$;

create function public.pool_totals()
returns table (entries bigint, received bigint, collected_cents bigint)
language sql stable set search_path = '' as $$
  select count(*), count(received_at), count(received_at) * 500 from public.predictions;
$$;

revoke all on function public.record_prediction(uuid, smallint, text, text, text, text, boolean),
  public.confirm_gift(uuid), public.pool_totals() from public, anon, authenticated;
grant execute on function public.record_prediction(uuid, smallint, text, text, text, text, boolean),
  public.confirm_gift(uuid), public.pool_totals() to service_role;

commit;
