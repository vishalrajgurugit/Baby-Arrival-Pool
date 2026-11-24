-- Run after migration 004; every test change is rolled back.
begin;
do $$
declare rid uuid := gen_random_uuid(); ref uuid; again uuid; old_entries bigint; old_money bigint; new_entries bigint; new_money bigint;
begin
 select entries,collected_cents into old_entries,old_money from public.pool_totals();
 select reference into ref from public.record_prediction_bundle(rid,21::smallint,'AM','Synthetic bundle verification','bundle-test@example.invalid','rollback only',true,22::smallint,'PM');
 if ref is null then raise exception 'bundle not saved'; end if;
 select reference into again from public.record_prediction_bundle(rid,21::smallint,'AM','Synthetic bundle verification','bundle-test@example.invalid','rollback only',true,22::smallint,'PM');
 if ref <> again then raise exception 'retry changed reference'; end if;
 if exists(select 1 from public.record_prediction_bundle(rid,21::smallint,'AM','Synthetic bundle verification','bundle-test@example.invalid','rollback only',true,23::smallint,'PM')) then raise exception 'changed retry accepted'; end if;
 perform public.confirm_gift(ref); perform public.confirm_gift(ref);
 select entries,collected_cents into new_entries,new_money from public.pool_totals();
 if new_entries <> old_entries+2 or new_money <> old_money+500 then raise exception 'incorrect bundle totals'; end if;
 if has_function_privilege('anon','public.record_prediction_bundle(uuid,smallint,text,text,text,text,boolean,smallint,text)','EXECUTE') or has_function_privilege('authenticated','public.record_prediction_bundle(uuid,smallint,text,text,text,text,boolean,smallint,text)','EXECUTE') then raise exception 'public access'; end if;
end $$;
rollback;
