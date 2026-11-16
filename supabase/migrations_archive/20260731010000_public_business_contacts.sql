-- Public contact channels are business-owned data. They must never be inferred
-- from an owner's/staff member's authentication identity.

alter table public.businesses
    add column if not exists contact_phone text,
    add column if not exists contact_whatsapp text,
    add column if not exists contact_email text,
    add column if not exists website_url text;

alter table public.branches
    add column if not exists contact_phone text,
    add column if not exists contact_whatsapp text,
    add column if not exists contact_email text,
    add column if not exists website_url text,
    add column if not exists inherit_business_contacts boolean not null default true;

-- Preserve the previously published business phone during migration. New
-- businesses no longer copy the applicant's private contact into this field.
update public.businesses
set contact_phone = nullif(btrim(phones[1]), '')
where contact_phone is null
  and coalesce(array_length(phones, 1), 0) > 0;

alter table public.businesses
    drop constraint if exists businesses_contact_phone_format,
    add constraint businesses_contact_phone_format
        check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
    drop constraint if exists businesses_contact_whatsapp_format,
    add constraint businesses_contact_whatsapp_format
        check (contact_whatsapp is null or contact_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
    drop constraint if exists businesses_contact_email_length,
    add constraint businesses_contact_email_length
        check (contact_email is null or char_length(contact_email) <= 254),
    drop constraint if exists businesses_website_url_format,
    add constraint businesses_website_url_format
        check (website_url is null or website_url ~ '^https://');

alter table public.branches
    drop constraint if exists branches_contact_phone_format,
    add constraint branches_contact_phone_format
        check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
    drop constraint if exists branches_contact_whatsapp_format,
    add constraint branches_contact_whatsapp_format
        check (contact_whatsapp is null or contact_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
    drop constraint if exists branches_contact_email_length,
    add constraint branches_contact_email_length
        check (contact_email is null or char_length(contact_email) <= 254),
    drop constraint if exists branches_website_url_format,
    add constraint branches_website_url_format
        check (website_url is null or website_url ~ '^https://');

comment on column public.businesses.contact_phone is
    'Public business phone. Never sourced from a user profile or auth identity.';
comment on column public.businesses.contact_whatsapp is
    'Public business-owned WhatsApp number in E.164 format.';
comment on column public.businesses.contact_email is
    'Public customer-facing business email.';
comment on column public.businesses.website_url is
    'Public HTTPS website URL.';
comment on column public.branches.inherit_business_contacts is
    'When true, missing branch contact fields fall back to business contacts.';
