-- Exact non-secret authorization helper definitions from the 2026-11-10 schema-only snapshot.
-- Synthetic tables/users; real predicates, not permissive ACL stubs.
CREATE OR REPLACE FUNCTION public.has_branch_admin(p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
       -- владелец бизнеса всегда проходит
       exists (
         select 1
         from public.businesses bb
         join public.branches br on br.biz_id = bb.id
         where br.id = p_branch_id
           and bb.owner_id = auth.uid()
       )
    or -- бизнес-админ тоже проходит (админ уровня бизнеса)
       exists (
         select 1
         from public.user_roles ur
         join public.roles r on r.id = ur.role_id
         join public.branches br on br.id = p_branch_id
         where ur.user_id = auth.uid()
           and r.key = 'admin'
           and ur.biz_id = br.biz_id
       )
    or -- конкретный админ этого филиала
       exists (
         select 1
         from public.branch_admins ba
         where ba.branch_id = p_branch_id
           and ba.user_id   = auth.uid()
       );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    -- канонично: глобальные роли платформы
    exists (
      select 1
      from public.user_global_roles ugr
      join public.roles r on r.id = ugr.role_id
      where ugr.user_id = auth.uid()
        and r.scope = 'platform'
        and r.key   = 'super_admin'
    )
    -- легаси: старая таблица, если использовалась
    or exists (
      select 1
      from public.super_admins_legacy l
      where l.user_id = auth.uid()
    );
$function$;

