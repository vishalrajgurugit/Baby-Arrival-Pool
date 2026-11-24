begin;
create table public.prediction_email_delivery (
  reference uuid primary key references public.predictions(reference) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed','submitted','failed','unknown')),
  provider_id text,
  attempted_at timestamptz not null default now()
);
alter table public.prediction_email_delivery enable row level security;
revoke all on public.prediction_email_delivery from public, anon, authenticated;
grant select, insert, update on public.prediction_email_delivery to service_role;

create function public.claim_prediction_email(p_reference uuid)
returns boolean language sql set search_path = '' as $$
  with claimed as (
    insert into public.prediction_email_delivery(reference) values (p_reference)
    on conflict (reference) do nothing returning reference
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_prediction_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_prediction_email(uuid) to service_role;
commit;
