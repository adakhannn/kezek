alter table public.profiles
    add column if not exists whatsapp_phone text;

update public.profiles
set whatsapp_phone = phone
where whatsapp_verified is true
  and whatsapp_phone is null
  and phone is not null;

drop index if exists public.profiles_verified_whatsapp_phone_unique;

create unique index if not exists profiles_verified_whatsapp_phone_unique
    on public.profiles (whatsapp_phone)
    where whatsapp_verified is true and whatsapp_phone is not null;
