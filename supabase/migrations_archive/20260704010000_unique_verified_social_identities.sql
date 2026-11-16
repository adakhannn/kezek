-- One external identity must belong to exactly one Kezek profile.
create unique index if not exists profiles_yandex_id_unique
    on public.profiles (yandex_id)
    where yandex_id is not null;

create unique index if not exists profiles_verified_whatsapp_phone_unique
    on public.profiles (phone)
    where whatsapp_verified is true and phone is not null;
