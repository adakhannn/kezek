// Function parity for the isolated SQL suites (CI-01). The catalog in supabase/generated is built
// from a database that applied the whole migration chain (pnpm generate:function-catalog); every
// suite compares the functions it ends up with against it, so a suite that runs a superseded or
// hand-written copy of a live function fails instead of testing behaviour production no longer has.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'supabase', 'generated', 'function-catalog.json');
const DEFINITIONS_PATH = path.join(ROOT, 'supabase', 'generated', 'function-definitions.sql');
const RATCHET_PATH = path.join(ROOT, 'scripts', 'sql-parity-ratchet.json');

const CLIENT_ROLES = ['anon', 'authenticated', 'service_role'];

// Project functions: schemas public and private, without extension members (PostGIS and others).
const PROJECT_FUNCTIONS = `from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname in ('public', 'private')
      and not exists (select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')`;

// One JSON object keyed by signature. EXECUTE is reported for PUBLIC and for each client role that
// exists in the database (a suite without a role cannot be compared on it).
const FINGERPRINT_SQL = `set search_path = pg_catalog;
select coalesce(json_object_agg(f.signature, f.fingerprint), '{}'::json)::text from (
    select p.oid::regprocedure::text as signature, json_build_object(
        'body', md5(replace(coalesce(nullif(p.prosrc, ''), pg_get_function_sqlbody(p.oid)), chr(13), '')),
        'arguments', pg_get_function_arguments(p.oid),
        'result', pg_get_function_result(p.oid),
        'language', l.lanname::text,
        'kind', p.prokind::text,
        'definer', p.prosecdef,
        'volatility', p.provolatile::text,
        'strict', p.proisstrict,
        'owner', pg_get_userbyid(p.proowner)::text,
        'config', coalesce(to_json(array(select c from unnest(p.proconfig) c order by c)), '[]'::json),
        'execute', (jsonb_build_object('public', exists (select 1
                from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
            || coalesce((select jsonb_object_agg(r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE'))
                from pg_roles r where r.rolname in (${CLIENT_ROLES.map((role) => `'${role}'`).join(', ')})), '{}'::jsonb))::json
    ) as fingerprint
    ${PROJECT_FUNCTIONS}
) f;`;

const DEFINITIONS_SQL = `set search_path = pg_catalog;
select coalesce(json_agg(json_build_object('signature', p.oid::regprocedure::text,
    'definition', replace(pg_get_functiondef(p.oid), chr(13), '')) order by p.oid::regprocedure::text), '[]'::json)::text
    ${PROJECT_FUNCTIONS}
      and p.prokind <> 'a';`;

// The function defaults of the prod baseline (20261009110000_prod_baseline.sql): migrations that ran
// before 20261119030000_closed_default_privileges created their functions under them, so a suite that
// applies such a migration must create its functions under the same defaults to get the same ACL.
const SUPABASE_DEFAULT_PRIVILEGES = [
    'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";',
    'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";',
    'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";',
    'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";',
].join('\n');

const FIELDS = ['arguments', 'result', 'kind', 'definer', 'owner', 'execute', 'strict', 'language', 'volatility', 'config', 'body'];
// A declared stub may differ from live only in what it computes, never in how it is called or who may call it.
const STUB_SKIPPABLE = new Set(['body', 'language', 'volatility', 'config']);

const functionName = (signature) => signature.slice(0, signature.indexOf('('));

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
    }
    return value;
}

function lastJsonLine(output) {
    const lines = String(output ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const line = [...lines].reverse().find((candidate) => candidate.startsWith('{') || candidate.startsWith('['));
    if (!line) throw new Error(`Expected JSON from the database, got: ${String(output).slice(0, 200)}`);
    return JSON.parse(line);
}

function loadJson(file, hint) {
    if (!fs.existsSync(file)) throw new Error(`${path.relative(ROOT, file)} is missing. ${hint}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const loadCatalog = () => loadJson(CATALOG_PATH, 'Run pnpm generate:function-catalog with the local stack running.');
const loadRatchet = () => (fs.existsSync(RATCHET_PATH) ? JSON.parse(fs.readFileSync(RATCHET_PATH, 'utf8')) : {});

function executeDifferences(live, actual) {
    return Object.keys(actual).filter((role) => role in live && live[role] !== actual[role]);
}

/**
 * Compares the functions of a suite database with the catalog. Returns one problem per signature
 * and field; an empty array means every catalogued function the suite has is the live one.
 */
function compareFunctions(catalog, actual, { stubs = {} } = {}) {
    const problems = [];
    const live = catalog.functions;
    const liveNames = new Map();
    for (const signature of Object.keys(live)) {
        const name = functionName(signature);
        liveNames.set(name, [...(liveNames.get(name) ?? []), signature]);
    }
    const dropped = new Set(catalog.dropped ?? []);

    for (const [signature, stub] of Object.entries(stubs)) {
        for (const field of stub.skip ?? []) {
            if (!STUB_SKIPPABLE.has(field)) throw new Error(`Stub ${signature} cannot skip ${field}: only ${[...STUB_SKIPPABLE].join(', ')}`);
        }
        if (!stub.reason) throw new Error(`Stub ${signature} needs a reason`);
        if (!live[signature]) problems.push({ signature, field: 'stub', expected: 'a live signature', actual: 'not in the catalog: remove the stub' });
        else if (!actual[signature]) problems.push({ signature, field: 'stub', expected: 'created by the suite', actual: 'absent: remove the stub' });
    }

    for (const signature of Object.keys(actual).sort()) {
        const fingerprint = actual[signature];
        const reference = live[signature];
        if (!reference) {
            const name = functionName(signature);
            if (liveNames.has(name)) {
                problems.push({ signature, field: 'signature', expected: liveNames.get(name).join(' | '), actual: signature });
            } else if (dropped.has(name)) {
                problems.push({ signature, field: 'dropped', expected: 'absent (a migration drops it)', actual: signature });
            }
            continue;
        }
        const stub = stubs[signature];
        const skip = new Set(stub?.skip ?? []);
        let differs = false;
        for (const field of FIELDS) {
            if (field === 'execute') {
                const roles = executeDifferences(reference.execute, fingerprint.execute);
                if (roles.length === 0) continue;
                differs = true;
                problems.push({
                    signature,
                    field: 'execute',
                    expected: roles.map((role) => `${role}=${reference.execute[role]}`).join(', '),
                    actual: roles.map((role) => `${role}=${fingerprint.execute[role]}`).join(', '),
                });
                continue;
            }
            if (JSON.stringify(reference[field]) === JSON.stringify(fingerprint[field])) continue;
            differs = true;
            if (!skip.has(field)) problems.push({ signature, field, expected: reference[field], actual: fingerprint[field] });
        }
        if (stub && !differs) problems.push({ signature, field: 'stub', expected: 'differs from live', actual: 'matches live: remove the stub' });
    }
    return problems;
}

function describe(problem) {
    const show = (value) => (typeof value === 'string' ? value : JSON.stringify(value));
    return `${problem.signature}: ${problem.field} (live ${show(problem.expected)}; suite ${show(problem.actual)})`;
}

/**
 * Checks problems against the ratchet entry of a suite: signatures listed there are known drift
 * that may still mismatch; a listed signature that matches again is obsolete and fails, so the
 * ratchet only shrinks.
 */
function checkAgainstRatchet(problems, allowed) {
    const allowedSet = new Set(allowed);
    const failing = new Set(problems.map((problem) => problem.signature));
    return {
        unexpected: problems.filter((problem) => !allowedSet.has(problem.signature)),
        obsolete: allowed.filter((signature) => !failing.has(signature)),
    };
}

function finish(output, { suite, stubs }) {
    const problems = compareFunctions(loadCatalog(), lastJsonLine(output), { stubs });
    if (process.env.SQL_PARITY_COLLECT) {
        const signatures = [...new Set(problems.map((problem) => problem.signature))].sort();
        console.log(`SQL_PARITY ${JSON.stringify({ suite, signatures, problems: problems.map(describe) })}`);
        return;
    }
    const { unexpected, obsolete } = checkAgainstRatchet(problems, loadRatchet()[suite] ?? []);
    if (unexpected.length === 0 && obsolete.length === 0) return;
    const lines = [
        `${suite}: functions differ from the migration chain (supabase/generated/function-catalog.json).`,
        ...unexpected.map((problem) => `- ${describe(problem)}`),
        ...obsolete.map((signature) => `- ${signature}: listed in scripts/sql-parity-ratchet.json but matches now; remove the entry`),
        'Apply the real migration, install the live definition (installLiveFunction) or declare a stub with a reason.',
    ];
    throw new Error(lines.join('\n'));
}

/**
 * Compares the functions of the suite database with the catalog. `query` runs SQL as postgres and
 * returns its psql -At output, as a string or a promise of one.
 */
function assertLiveFunctions(query, { suite, stubs = {} }) {
    if (!suite) throw new Error('assertLiveFunctions needs the suite file name');
    const output = query(FINGERPRINT_SQL);
    if (output && typeof output.then === 'function') return output.then((text) => finish(text, { suite, stubs }));
    finish(output, { suite, stubs });
    return undefined;
}

function loadDefinitions() {
    if (!fs.existsSync(DEFINITIONS_PATH)) throw new Error('supabase/generated/function-definitions.sql is missing. Run pnpm generate:function-catalog.');
    const definitions = new Map();
    const blocks = fs.readFileSync(DEFINITIONS_PATH, 'utf8').replace(/\r\n/g, '\n').split(/^-- signature: /m).slice(1);
    for (const block of blocks) {
        const newline = block.indexOf('\n');
        definitions.set(block.slice(0, newline), block.slice(newline + 1).trimEnd());
    }
    return definitions;
}

/**
 * SQL that installs the live definition and ACL of one function, for a dependency of the behaviour
 * a suite tests. The migration under test must still be applied from its real file.
 */
function liveFunctionSql(signature) {
    const definition = loadDefinitions().get(signature);
    const fingerprint = loadCatalog().functions[signature];
    if (!definition || !fingerprint) throw new Error(`${signature} is not in the function catalog`);
    const grants = Object.entries(fingerprint.execute)
        .filter(([, allowed]) => allowed)
        .map(([role]) => role);
    const literal = signature.replace(/'/g, "''");
    return `${definition}
do $acl$ declare r text; begin
    execute format('revoke all on function %s from public', '${literal}');
    foreach r in array array[${CLIENT_ROLES.map((role) => `'${role}'`).join(', ')}] loop
        if to_regrole(r) is not null then execute format('revoke all on function %s from %I', '${literal}', r); end if;
    end loop;
    foreach r in array array[${grants.map((role) => `'${role}'`).join(', ') || "''"}]::text[] loop
        if r = 'public' then execute format('grant execute on function %s to public', '${literal}');
        elsif r <> '' and to_regrole(r) is not null then execute format('grant execute on function %s to %I', '${literal}', r);
        end if;
    end loop;
end $acl$;`;
}

function installLiveFunction(query, signature) {
    return query(liveFunctionSql(signature));
}

/**
 * SQL that runs each statement of a grant-and-config migration (statements like `revoke ... on
 * function f(...) from ...;` or `alter function f(...) set ...;`) and skips the ones whose function,
 * table or role the suite database does not have. A suite that builds only part of the schema can
 * then apply the real migration file to the part it has, instead of copying its grants by hand.
 */
function migrationWhereObjectsExistSql(file) {
    const text = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', file), 'utf8')
        .replace(/\r/g, '')
        .replace(/--[^\n]*/g, '');
    const statements = text.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
        if (!/^(revoke|grant|alter\s+function)\b/i.test(statement) || statement.includes('$')) {
            throw new Error(`${file}: only grant, revoke and alter function statements can be applied per object: ${statement.slice(0, 60)}`);
        }
    }
    return statements.map((statement) => `do $guard$ begin
    execute $statement$${statement}$statement$;
exception when undefined_function or undefined_table or undefined_object then null;
end $guard$;`).join('\n');
}

function applyMigrationWhereObjectsExist(query, file) {
    return query(migrationWhereObjectsExistSql(file));
}

/**
 * SQL that runs each `create or replace function` of a migration made only of such redefinitions
 * (plus begin, set local and commit), and only for the functions the suite database already has
 * (matched by schema and name). A suite that holds some of those functions from an earlier
 * migration then gets the real later definitions, and keeps owner and grants (create or replace
 * leaves them as they were); functions the suite does not build are not created.
 */
function migrationFunctionsWhereExistSql(file) {
    const text = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', file), 'utf8').replace(/\r/g, '');
    const blocks = [...text.matchAll(/CREATE OR REPLACE FUNCTION ([a-z_]+)\.([a-z0-9_]+)\([\s\S]*?\n\$function\$\n;/g)];
    const rest = blocks.reduce((remaining, block) => remaining.replace(block[0], ''), text)
        .replace(/--[^\n]*/g, '')
        .split(';').map((statement) => statement.trim()).filter(Boolean);
    const unexpected = rest.filter((statement) => !/^(begin|commit|set local [a-z_]+ = '[^']*')$/i.test(statement));
    if (!blocks.length || unexpected.length) {
        throw new Error(`${file}: only create or replace function blocks can be applied per function: ${(unexpected[0] ?? 'no function').slice(0, 60)}`);
    }
    return blocks.map(([definition, schema, name]) => {
        if (definition.includes('$apply$')) throw new Error(`${file}: ${schema}.${name} contains $apply$`);
        return `do $apply$ begin
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = '${schema}' and p.proname = '${name}') then
        execute $statement$${definition.slice(0, -1)}$statement$;
    end if;
end $apply$;`;
    }).join('\n');
}

function applyMigrationFunctionsWhereExist(query, file) {
    return query(migrationFunctionsWhereExistSql(file));
}

module.exports = {
    CATALOG_PATH,
    DEFINITIONS_PATH,
    RATCHET_PATH,
    FINGERPRINT_SQL,
    DEFINITIONS_SQL,
    SUPABASE_DEFAULT_PRIVILEGES,
    STUB_SKIPPABLE,
    applyMigrationFunctionsWhereExist,
    applyMigrationWhereObjectsExist,
    assertLiveFunctions,
    checkAgainstRatchet,
    compareFunctions,
    functionName,
    installLiveFunction,
    lastJsonLine,
    liveFunctionSql,
    loadCatalog,
    loadRatchet,
    migrationFunctionsWhereExistSql,
    migrationWhereObjectsExistSql,
    sortKeys,
};
