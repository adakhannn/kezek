-- Добавляем поле для подтверждения WhatsApp номера
alter table "public"."profiles" 
add column if not exists "whatsapp_verified" boolean default false;

-- Добавляем комментарий к полю
comment on column "public"."profiles"."whatsapp_verified" is 'Подтвержден ли номер WhatsApp для отправки уведомлений';

