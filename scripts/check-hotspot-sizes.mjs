import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const hotspots = [
    {
        file: 'apps/web/src/app/staff/finance/components/FinancePage.tsx',
        maxLines: 320,
        reason: 'finance page should stay a composition layer, not regain orchestration bulk',
    },
    {
        file: 'apps/web/src/lib/whatsAppWebhookService.ts',
        maxLines: 320,
        reason: 'webhook service should remain a coordinator after decomposition',
    },
    {
        file: 'apps/web/src/app/auth/sign-in/SignInPage.tsx',
        maxLines: 120,
        reason: 'sign-in page should remain a thin container over extracted hooks and view code',
    },
];

function countLines(absolutePath) {
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content.split(/\r?\n/u).length;
}

const failures = [];
const report = [];

for (const hotspot of hotspots) {
    const absolutePath = path.resolve(repoRoot, hotspot.file);
    const lines = countLines(absolutePath);

    report.push(`${hotspot.file}: ${lines}/${hotspot.maxLines} lines`);

    if (lines > hotspot.maxLines) {
        failures.push(
            `${hotspot.file} has ${lines} lines, above limit ${hotspot.maxLines} (${hotspot.reason})`,
        );
    }
}

for (const line of report) {
    console.log(line);
}

if (failures.length > 0) {
    console.error('\nHotspot size limits exceeded:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('\nHotspot size check passed.');
