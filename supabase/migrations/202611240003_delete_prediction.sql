begin;
grant delete on public.predictions to service_role;
create function public.delete_prediction(p_reference uuid)
returns boolean language sql set search_path = '' as $$
  with deleted as (
    delete from public.predictions where reference = p_reference returning id
  ) select exists(select 1 from deleted);
$$;
revoke all on function public.delete_prediction(uuid) from public, anon, authenticated;
grant execute on function public.delete_prediction(uuid) to service_role;
commit;
