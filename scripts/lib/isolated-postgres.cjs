// The disposable PostgreSQL used by every isolated SQL suite (CI-01). Production runs Supabase
// Postgres 17, so the suites run 17 as well: PG17-only migration branches (the MAINTAIN privilege)
// were never executed on 16. Keep this the only place that names the image; never `latest` or 18
// (the 18 image moves PGDATA away from the /var/lib/postgresql/data tmpfs the suites mount).
const POSTGRES_MAJOR = 17;
const POSTGRES_IMAGE = 'postgres:17';

module.exports = { POSTGRES_IMAGE, POSTGRES_MAJOR };

// `node scripts/lib/isolated-postgres.cjs` prints the image (CI pulls it before the suites run).
if (require.main === module) process.stdout.write(POSTGRES_IMAGE);
