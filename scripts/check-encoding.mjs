// Fails on source text that users would see garbled:
//  - invalid UTF-8 or U+FFFD replacement characters;
//  - UTF-8 Cyrillic that was decoded as Windows-1251 and saved again
//    ("РќРµ СѓРґР°Р»РѕСЃСЊ" instead of "Не удалось"). That text is valid UTF-8,
//    so only a round-trip check finds it. In November 2026 it was found in 16
//    web files, including the guest booking flow and weekday labels.
// Usage: node scripts/check-encoding.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['apps/web/src', 'apps/web/e2e', 'apps/mobile/src', 'packages'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.expo', 'coverage', 'dist', 'build']);
const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|md)$/;

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
const cp1251 = new TextDecoder('windows-1251');
const toCp1251Byte = new Map();
for (let byte = 0; byte < 256; byte++) toCp1251Byte.set(cp1251.decode(Uint8Array.of(byte)), byte);

// Candidate run: non-ASCII text containing a two-byte UTF-8 Cyrillic lead byte
// rendered in Windows-1251 (Р = 0xD0, С = 0xD1).
const CANDIDATE = /[^\x00-\x7F]*[РС][^\x00-\x7F]+(?:[\x20-\x7E]{0,3}[^\x00-\x7F]+)*/g;

/** The original text if `run` is Windows-1251-decoded UTF-8 Cyrillic, otherwise null. */
export function decodeMojibake(run) {
    const bytes = [];
    for (const char of run) {
        const byte = toCp1251Byte.get(char);
        if (byte === undefined) return null;
        bytes.push(byte);
    }
    let text;
    try {
        text = strictUtf8.decode(Uint8Array.from(bytes));
    } catch {
        return null;
    }
    const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
    const cyrillic = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
    return cyrillic >= 2 && cyrillic >= letters.length * 0.7 ? text : null;
}

function* files(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* files(full);
        } else if (EXTENSIONS.test(entry.name)) {
            yield full;
        }
    }
}

function check() {
    const problems = [];
    let checked = 0;
    for (const dir of SOURCE_DIRS) {
        for (const file of files(path.join(root, dir))) {
            checked++;
            const rel = path.relative(root, file).split(path.sep).join('/');
            let text;
            try {
                text = strictUtf8.decode(fs.readFileSync(file));
            } catch {
                problems.push(`${rel}: invalid UTF-8`);
                continue;
            }
            if (text.includes('�')) problems.push(`${rel}: contains U+FFFD`);
            for (const match of text.matchAll(CANDIDATE)) {
                const original = decodeMojibake(match[0]);
                if (original !== null) {
                    const line = text.slice(0, match.index).split('\n').length;
                    problems.push(`${rel}:${line}: Windows-1251 mojibake "${match[0].slice(0, 30)}" (should read "${original.slice(0, 30)}")`);
                }
            }
        }
    }
    return { checked, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { checked, problems } = check();
    if (problems.length) {
        console.error(`Encoding check failed (${problems.length}):`);
        for (const problem of problems.slice(0, 50)) console.error(`  ${problem}`);
        process.exit(1);
    }
    console.log(`Encoding check passed: ${checked} files.`);
}
