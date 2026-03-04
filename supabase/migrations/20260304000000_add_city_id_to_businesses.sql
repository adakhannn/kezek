-- Добавляем city_id в businesses для фильтрации по городу (API nearby, map)
alter table public.businesses
    add column if not exists city_id uuid null;

comment on column public.businesses.city_id is 'Город бизнеса (для фильтрации в списках и на карте)';

create index if not exists businesses_city_id_idx on public.businesses (city_id) where city_id is not null;
