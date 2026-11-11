import fs from 'node:fs';
import path from 'node:path';

test('browser measurement dependency graph cannot import Redis, env or server exporters', () => {
    const root = path.resolve(__dirname, '../..');
    const visited = new Set<string>();
    function inspect(file: string) {
        if (visited.has(file)) return;
        visited.add(file);
        const source = fs.readFileSync(file, 'utf8');
        expect(source).not.toMatch(/@upstash\/redis|from\s+['"][^'"]*\/(env|performanceStore|performanceServer)['"]|UPSTASH_REDIS|server-only/);
        for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
            const specifier = match[1];
            if (specifier.startsWith('@/')) inspect(path.join(root, specifier.slice(2) + '.ts'));
            else if (specifier.startsWith('.')) inspect(path.resolve(path.dirname(file), specifier + '.ts'));
        }
    }
    inspect(path.join(root, 'lib/performance.ts'));
    expect(visited.size).toBeGreaterThanOrEqual(3);
});

test('server callers cannot accidentally import the browser facade', () => {
    const root = path.resolve(__dirname, '../..');
    for (const file of ['staffShiftCloseService.ts', 'dashboardStaffShiftCloseService.ts', 'markAttendanceService.ts', 'recalculateRatingsCronHttpService.ts']) {
        const source = fs.readFileSync(path.join(root, 'lib', file), 'utf8');
        expect(source).toContain("from '@/lib/performanceServer'");
        expect(source).not.toContain("from '@/lib/performance'");
    }
});
