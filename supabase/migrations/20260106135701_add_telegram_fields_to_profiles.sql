-- Добавляем поля для Telegram-авторизации в профиль пользователя
alter table "public"."profiles"
    add column if not exists "telegram_id" bigint,
    add column if not exists "telegram_username" text,
    add column if not exists "telegram_photo_url" text,
    add column if not exists "telegram_verified" boolean default false,
    add column if not exists "notify_telegram" boolean default true;

-- Уникальность telegram_id (один Telegram-аккаунт = один профиль)
create unique index if not exists "profiles_telegram_id_key"
    on "public"."profiles"("telegram_id");

-- Индекс для быстрого поиска по telegram_id
create index if not exists "idx_profiles_telegram_id"
    on "public"."profiles"("telegram_id");

-- Комментарии к полям
comment on column "public"."profiles"."telegram_id" is 'Telegram User ID';
comment on column "public"."profiles"."telegram_username" is 'Telegram username (без @)';
comment on column "public"."profiles"."telegram_photo_url" is 'URL аватара из Telegram';
comment on column "public"."profiles"."telegram_verified" is 'Подтвержден ли Telegram-аккаунт пользователя';
comment on column "public"."profiles"."notify_telegram" is 'Получать уведомления в Telegram (по умолчанию: включено)';

