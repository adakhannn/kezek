// Integration fixture for 20261120090000_staff_invitations (API-06). A disposable PostgreSQL with the
// production staff guard, role trigger and approval command shows that a manager's client session
// could link a staff card to any account before the migration, and after it: a client session cannot
// set staff.user_id to an account (unlinking still works), only the invited person links the card by
// accepting (the staff role follows through staff_ensure_staff_role), declining leaves the card
// unlinked, a changed card cancels the invitation, an account with a card in the business is refused,
// the invitations and commands are service role only, approve_staff_application still links, and a
// re-run changes nothing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { POSTGRES_IMAGE } = require('./lib/isolated-postgres.cjs');
const { assertLiveFunctions, liveFunctionSql, SUPABASE_DEFAULT_PRIVILEGES } = require('./lib/live-schema.cjs');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const read = (file) => fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r/g, '');
const migration = read('20261120090000_staff_invitations.sql');
// The guard as 20261117200000 left it, to reproduce the hole before the migration.
function previousGuard() {
    const text = read('20261117200000_close_client_write_paths.sql');
    const from = text.indexOf('create or replace function public.staff_guard_client_write()');
    const to = text.indexOf('\n$$;', from);
    assert.ok(from >= 0 && to > from, 'staff_guard_client_write not found in 20261117200000');
    return `${text.slice(from, to + 4)}
revoke all on function public.staff_guard_client_write() from public, anon, authenticated;
create trigger staff_guard_client_write before insert or update on public.staff
    for each row execute function public.staff_guard_client_write();`;
}

const container = `kezek-staff-invitations-${randomUUID()}`;
const docker = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', (data) => { err += data; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err || out || `exit ${code}`))));
    child.stdin.end(input);
});
const sql = (input) => docker(['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input);
const asRole = (role, id, body) =>
    sql(`set role ${role}; set request.jwt.claims='{"sub":"${id}","role":"${role}"}'; ${body}`);
// Number of rows a write statement touched, without RETURNING (which would apply SELECT rules).
const touched = (role, id, statement) => asRole(role, id, `${statement};\n\\echo :ROW_COUNT`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BIZ = id(10); const OTHER_BIZ = id(11); const BRANCH = id(20); const OTHER_BRANCH = id(21);
const MANAGER = id(1); const INVITEE = id(2); const SECOND = id(3); const THIRD = id(4); const LINKER = id(5); const APPLICANT = id(6);
const CARD = id(30); const CARD_DECLINED = id(31); const CARD_STALE = id(32); const CARD_EXTRA = id(33); const CARD_LINKED = id(34);
const INV = id(40); const INV_DECLINED = id(41); const INV_STALE = id(42); const INV_EXTRA = id(43);

const fixture = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
${SUPABASE_DEFAULT_PRIVILEGES}

create table auth.users(id uuid primary key);
create table public.businesses(id uuid primary key, name text, owner_id uuid);
create table public.branches(id uuid primary key, biz_id uuid references public.businesses(id), name text, is_active boolean default true);
create table public.staff(id uuid primary key default gen_random_uuid(), biz_id uuid not null references public.businesses(id),
    branch_id uuid not null references public.branches(id), full_name text not null, skills text[], is_active boolean default true,
    created_at timestamptz default now(), email text, phone text, user_id uuid, avatar_url text,
    percent_master numeric default 60, percent_salon numeric default 40, hourly_rate numeric, rating_score numeric,
    rating_updated_at timestamptz, last_rating_recalculated_at timestamptz);
create unique index staff_user_business_unique on public.staff (user_id, biz_id) where user_id is not null;
create table public.roles(id uuid primary key default gen_random_uuid(), key text unique, scope text);
create table public.user_roles(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role_id uuid not null references public.roles(id),
    biz_id uuid references public.businesses(id) on delete cascade,
    biz_key uuid generated always as (coalesce(biz_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
    constraint user_roles_unique_all unique (user_id, role_id, biz_key));
create table public.user_global_roles(user_id uuid, role_id uuid references public.roles(id));
create table public.super_admins_legacy(user_id uuid primary key);
create table public.staff_branch_assignments(id uuid primary key default gen_random_uuid(), biz_id uuid not null,
    staff_id uuid not null references public.staff(id), branch_id uuid not null, valid_from date not null, valid_to date);
create table public.business_role_applications(id uuid primary key default gen_random_uuid(), applicant_user_id uuid not null,
    biz_id uuid not null, requested_role text not null, status text not null default 'pending', applicant_name text,
    applicant_email text, applicant_phone text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    reviewed_at timestamptz, reviewed_by uuid, review_note text);

-- The access helpers and the approval command as they are live.
${liveFunctionSql('public.finance_is_platform_admin(uuid)')}
${liveFunctionSql('public.finance_can_manage_business(uuid,uuid)')}
${liveFunctionSql('public.staff_write_allowed(uuid,uuid)')}
${liveFunctionSql('public.approve_staff_application(uuid,uuid,uuid,boolean)')}

alter table public.staff enable row level security;
create policy "Business owners can manage own staff" on public.staff to authenticated
    using (biz_id in (select ur.biz_id from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')))
    with check (biz_id in (select ur.biz_id from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')));
revoke delete on table public.staff from authenticated;
revoke insert, update, delete on table public.staff from anon;

insert into auth.users values ('${MANAGER}'), ('${INVITEE}'), ('${SECOND}'), ('${THIRD}'), ('${LINKER}'), ('${APPLICANT}');
insert into public.roles(key, scope) values ('owner', 'business'), ('admin', 'business'), ('manager', 'business'), ('staff', 'business'), ('super_admin', 'platform');
insert into public.businesses values ('${BIZ}', 'Salon', null), ('${OTHER_BIZ}', 'Other', null);
insert into public.branches(id, biz_id, name) values ('${BRANCH}', '${BIZ}', 'Center'), ('${OTHER_BRANCH}', '${OTHER_BIZ}', 'Far');
insert into public.user_roles(user_id, biz_id, role_id) select '${MANAGER}'::uuid, '${BIZ}'::uuid, id from public.roles where key = 'manager';
insert into public.staff(id, biz_id, branch_id, full_name) values
    ('${CARD}', '${BIZ}', '${BRANCH}', 'Invited'), ('${CARD_DECLINED}', '${BIZ}', '${BRANCH}', 'Declined'),
    ('${CARD_STALE}', '${BIZ}', '${BRANCH}', 'Stale'), ('${CARD_EXTRA}', '${BIZ}', '${BRANCH}', 'Extra');
`;

const staffRoles = () => sql(`select coalesce(string_agg(right(ur.user_id::text, 2) || '@' || right(ur.biz_id::text, 2), ',' order by ur.user_id, ur.biz_id), '-')
    from public.user_roles ur join public.roles r on r.id = ur.role_id where r.key = 'staff'`);
const linkedTo = (card) => sql(`select coalesce(right(user_id::text, 2), 'null') from public.staff where id = '${card}'`);
const invitationState = (invitation) => sql(`select status || '|' || (decided_at is not null) from public.staff_invitations where id = '${invitation}'`);
const accept = (invitation, user) => asRole('service_role', user, `select public.accept_staff_invitation('${invitation}', '${user}')::text`);
const decline = (invitation, user) => asRole('service_role', user, `select public.decline_staff_invitation('${invitation}', '${user}')`);

let created = false;

(async () => {
    try {
        await docker(['run', '--detach', '--rm', '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', POSTGRES_IMAGE]);
        created = true;
        let ready = false;
        for (let i = 0; i < 120; i += 1) {
            try {
                if (await docker(['exec', container, 'cat', '/proc/1/comm']) === 'postgres') {
                    await docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
                    ready = true;
                    break;
                }
            } catch { /* still starting */ }
            await new Promise((r) => setTimeout(r, 500));
        }
        assert.ok(ready, 'PostgreSQL did not start');
        await sql(fixture);
        await sql(read('20261119090000_staff_role_follows_card.sql'));
        await sql(previousGuard());

        // Before: a manager's client session links a card to any account, which then gets the staff role.
        assert.equal(await touched('authenticated', MANAGER, `update public.staff set user_id = '${LINKER}' where id = '${CARD_EXTRA}'`), '1');
        assert.equal(await staffRoles(), `05@10`, 'API-06: the role followed a link the account never agreed to');
        await sql(`update public.staff set user_id = null where id = '${CARD_EXTRA}'; delete from public.user_roles ur using public.roles r
            where r.id = ur.role_id and r.key = 'staff';`);

        await sql(migration);

        // Path C: a client session never sets user_id to an account, on insert or update.
        await assert.rejects(touched('authenticated', MANAGER, `update public.staff set user_id = '${LINKER}' where id = '${CARD_EXTRA}'`), /STAFF_USER_LINK_FORBIDDEN/);
        await assert.rejects(touched('authenticated', MANAGER, `insert into public.staff(biz_id, branch_id, full_name, user_id)
            values ('${BIZ}', '${BRANCH}', 'Smuggled', '${LINKER}')`), /STAFF_USER_LINK_FORBIDDEN/);
        // Managers still create unlinked cards, edit cards and unlink them.
        assert.equal(await touched('authenticated', MANAGER, `insert into public.staff(id, biz_id, branch_id, full_name)
            values ('${CARD_LINKED}', '${BIZ}', '${BRANCH}', 'Plain')`), '1');
        await sql(`update public.staff set user_id = '${LINKER}' where id = '${CARD_LINKED}'`);
        assert.equal(await touched('authenticated', MANAGER, `update public.staff set full_name = 'Renamed', hourly_rate = 100 where id = '${CARD_LINKED}'`), '1');
        assert.equal(await touched('authenticated', MANAGER, `update public.staff set user_id = null where id = '${CARD_LINKED}'`), '1');
        assert.equal(await linkedTo(CARD_LINKED), 'null');
        // The service role is not a client session.
        assert.equal(await touched('service_role', MANAGER, `update public.staff set user_id = '${LINKER}' where id = '${CARD_LINKED}'`), '1');
        await sql(`delete from public.user_roles ur using public.roles r where r.id = ur.role_id and r.key = 'staff'`);

        // Invitations and their commands are service role only.
        for (const role of ['anon', 'authenticated']) {
            await assert.rejects(asRole(role, INVITEE, 'select count(*) from public.staff_invitations'), /permission denied/, role);
            await assert.rejects(asRole(role, INVITEE, `select public.accept_staff_invitation('${INV}', '${INVITEE}')`), /permission denied for function/, role);
            await assert.rejects(asRole(role, INVITEE, `select public.decline_staff_invitation('${INV}', '${INVITEE}')`), /permission denied for function/, role);
        }
        assert.equal(await sql(`select relrowsecurity from pg_class where oid = 'public.staff_invitations'::regclass`), 't');

        await asRole('service_role', MANAGER, `insert into public.staff_invitations(id, biz_id, staff_id, invited_user_id, invited_by) values
            ('${INV}', '${BIZ}', '${CARD}', '${INVITEE}', '${MANAGER}'),
            ('${INV_DECLINED}', '${BIZ}', '${CARD_DECLINED}', '${SECOND}', '${MANAGER}'),
            ('${INV_STALE}', '${BIZ}', '${CARD_STALE}', '${THIRD}', '${MANAGER}')`);
        // One pending invitation per card and per person in a business.
        await assert.rejects(asRole('service_role', MANAGER, `insert into public.staff_invitations(biz_id, staff_id, invited_user_id)
            values ('${BIZ}', '${CARD}', '${LINKER}')`), /staff_invitations_pending_staff_unique/);
        await assert.rejects(asRole('service_role', MANAGER, `insert into public.staff_invitations(biz_id, staff_id, invited_user_id)
            values ('${BIZ}', '${CARD_EXTRA}', '${INVITEE}')`), /staff_invitations_pending_user_biz_unique/);

        // Only the invited person answers their own invitation.
        await assert.rejects(accept(INV, SECOND), /STAFF_INVITATION_NOT_FOUND/);
        await assert.rejects(decline(INV, SECOND), /STAFF_INVITATION_NOT_FOUND/);
        await assert.rejects(accept(randomUUID(), INVITEE), /STAFF_INVITATION_NOT_FOUND/);
        assert.equal(await linkedTo(CARD), 'null');

        // Accepting links the card; the existing trigger grants the staff role.
        const accepted = JSON.parse(await accept(INV, INVITEE));
        assert.deepEqual(accepted, { status: 'accepted', staff_id: CARD, biz_id: BIZ });
        assert.equal(await linkedTo(CARD), '02');
        assert.equal(await invitationState(INV), 'accepted|true');
        assert.equal(await staffRoles(), '02@10');
        await assert.rejects(accept(INV, INVITEE), /STAFF_INVITATION_NOT_PENDING/);
        await assert.rejects(decline(INV, INVITEE), /STAFF_INVITATION_NOT_PENDING/);

        // Declining leaves the card unlinked and grants nothing.
        await decline(INV_DECLINED, SECOND);
        assert.equal(await invitationState(INV_DECLINED), 'declined|true');
        assert.equal(await linkedTo(CARD_DECLINED), 'null');
        await assert.rejects(accept(INV_DECLINED, SECOND), /STAFF_INVITATION_NOT_PENDING/);

        // A card that was linked meanwhile voids its invitation: cancelled, and the result says so.
        await sql(`update public.staff set user_id = '${APPLICANT}' where id = '${CARD_STALE}'`);
        assert.deepEqual(JSON.parse(await accept(INV_STALE, THIRD)), { status: 'stale', error: 'STAFF_INVITATION_STALE' });
        assert.equal(await invitationState(INV_STALE), 'cancelled|true');
        assert.equal(await linkedTo(CARD_STALE), '06');
        assert.equal(await staffRoles(), '02@10,06@10', 'the account linked by the service role got its role; the invitee got none');

        // An account that already has a card in the business is refused; nothing changes.
        await asRole('service_role', MANAGER, `insert into public.staff_invitations(id, biz_id, staff_id, invited_user_id)
            values ('${INV_EXTRA}', '${BIZ}', '${CARD_EXTRA}', '${INVITEE}')`);
        await assert.rejects(accept(INV_EXTRA, INVITEE), /STAFF_INVITATION_ALREADY_STAFF/);
        assert.equal(await invitationState(INV_EXTRA), 'pending|false');
        assert.equal(await linkedTo(CARD_EXTRA), 'null');

        // The consent path that existed already, approve_staff_application, still links (as postgres).
        const application = randomUUID();
        await sql(`insert into public.business_role_applications(id, applicant_user_id, biz_id, requested_role, applicant_name)
            values ('${application}', '${SECOND}', '${BIZ}', 'staff', 'Applicant')`);
        await asRole('service_role', MANAGER, `select * from public.approve_staff_application('${application}', '${MANAGER}', '${BRANCH}', true)`);
        assert.equal(await sql(`select count(*) from public.staff where user_id = '${SECOND}' and biz_id = '${BIZ}'`), '1');
        assert.equal(await staffRoles(), '02@10,03@10,06@10');

        // A deleted card takes its invitations with it.
        await sql(`delete from public.staff_invitations where id = '${INV_EXTRA}'; delete from public.staff where id = '${CARD_EXTRA}'`);

        // Re-running changes nothing.
        await sql(migration);
        assert.equal(await sql(`select string_agg(status, ',' order by id) from public.staff_invitations`), 'accepted,declined,cancelled');
        await assert.rejects(touched('authenticated', MANAGER, `update public.staff set user_id = '${LINKER}' where id = '${CARD_DECLINED}'`), /STAFF_USER_LINK_FORBIDDEN/);
        assert.equal(await sql(`select count(*) from pg_trigger where tgname = 'staff_guard_client_write'`), '1');

        await assertLiveFunctions(sql, { suite: 'test-staff-invitations-isolated.cjs' });
        console.log('Staff invitations (API-06): clients cannot link accounts; accept links with the role, decline and stale invitations do not; approval still links; re-run is a no-op.');
    } finally {
        if (created) await docker(['rm', '-f', container]).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
