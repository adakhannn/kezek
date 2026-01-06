-- Добавляем колонку notify_telegram отдельно, так как предыдущая миграция уже была применена
alter table "public"."profiles"
    add column if not exists "notify_telegram" boolean default true;

comment on column "public"."profiles"."notify_telegram" is 'Получать уведомления в Telegram (по умолчанию: включено)';


