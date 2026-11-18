import fs from 'node:fs';
import path from 'node:path';

// ARCH-03: account lookups go through exact paths (auth.admin.getUserById, find_accounts_by_contact)
// and the super-admin directory through admin_list_users / admin_user_stats; nothing pages through
// Auth users and filters a page in JavaScript.
const ALLOWED = new Set<string>();
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
