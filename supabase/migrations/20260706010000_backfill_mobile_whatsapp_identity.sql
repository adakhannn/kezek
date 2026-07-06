update public.profiles as target
set whatsapp_phone = target.phone
where target.whatsapp_verified is true
  and target.whatsapp_phone is null
  and target.phone is not null
  and not exists (
      select 1
      from public.profiles as existing
      where existing.id <> target.id
        and existing.whatsapp_verified is true
        and existing.whatsapp_phone = target.phone
  );
