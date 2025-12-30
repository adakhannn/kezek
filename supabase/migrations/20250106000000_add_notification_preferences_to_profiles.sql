-- Добавляем поля для настроек уведомлений в таблицу profiles
-- По умолчанию все уведомления включены (true)

alter table "public"."profiles" 
add column if not exists "notify_email" boolean default true,
add column if not exists "notify_sms" boolean default true,
add column if not exists "notify_whatsapp" boolean default true;

-- Добавляем комментарии к полям
comment on column "public"."profiles"."notify_email" is 'Получать уведомления по email (по умолчанию: включено)';
comment on column "public"."profiles"."notify_sms" is 'Получать уведомления по SMS (по умолчанию: включено)';
comment on column "public"."profiles"."notify_whatsapp" is 'Получать уведомления по WhatsApp (по умолчанию: включено)';

