import fs from 'node:fs';
import path from 'node:path';

// ARCH-03: account lookups go through exact paths (auth.admin.getUserById, find_accounts_by_contact),
// never through paging Auth users and filtering a page in JavaScript. The super-admin user directory
// is the one remaining caller; it moves to a server-side query next.
const ALLOWED = new Set(['app/admin/api/users/list/route.ts']);
const SOURCE_ROOT = path.resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
}

test('production code does not page through Auth users to find an account', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
        // a call (auth.admin.listUsers(...)) or a typed client member (listUsers: ...), not a mention
        .filter((file) => /\.listUsers\s*\(|\blistUsers\s*:/.test(fs.readFileSync(file, 'utf8')))
        .map((file) => path.relative(SOURCE_ROOT, file).split(path.sep).join('/'))
        .filter((file) => !ALLOWED.has(file));

    expect(offenders).toEqual([]);
});
