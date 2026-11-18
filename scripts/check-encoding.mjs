// Fails on source text that users would see garbled:
//  - invalid UTF-8 or U+FFFD replacement characters;
//  - UTF-8 Cyrillic that was decoded as Windows-1251 and saved again
//    ("РќРµ СѓРґР°Р»РѕСЃСЊ" instead of "Не удалось"). That text is valid UTF-8,
//    so only a round-trip check finds it. In November 2026 it was found in 16
//    web files, including the guest booking flow and weekday labels;
//  - the same garbling repeated (text decoded as Windows-1251 more than once),
//    including mixtures of levels, which no single round decodes;
//  - garbled typographic punctuation: dashes, quotes, ellipsis, № ("вЂ”" for "—",
//    "В«" for "«"); the Cyrillic check missed these, and slot times read
//    "10:00вЂ“11:00" in the staff schedule until 18 Nov 2026.
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
// A garbled punctuation token: UTF-8 E2 xx xx (в + two) or C2 xx (В + one) read as Windows-1251.
const PUNCTUATION_CANDIDATE = /в[\u0080-￿]{2}|В[\u0080-￿]/g;
const TYPOGRAPHIC = /^[ -¿ -⁯℀-⅏←-⇿∀-⋿]$/u;
// Р/С followed by a Windows-1251 character of bytes 0x80-0xBF that never follows them in Russian
// or Kyrgyz text: the second byte of a garbled Cyrillic letter.
const GARBLED_PAIR = /[РС][ЂЃ‚ѓ„†‡€‰Љ‹ЊЌЋЏђ‘’•™љ›њќћџЎўЈ¤Ґ¦Є¬®Ї±Ііґµ¶·єјЅѕї]/g;

/** One round: the UTF-8 text whose bytes `run` shows in Windows-1251, or null. */
function decodeRound(run) {
    const bytes = [];
    for (const char of run) {
        const byte = toCp1251Byte.get(char);
        if (byte === undefined) return null;
        bytes.push(byte);
    }
    try {
        return strictUtf8.decode(Uint8Array.from(bytes));
    } catch {
        return null;
    }
}

function looksLikeCyrillicText(text) {
    const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
    const cyrillic = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
    return cyrillic >= 2 && cyrillic >= letters.length * 0.7;
}

/** The original text if `run` is Windows-1251-decoded UTF-8 Cyrillic, otherwise null. */
export function decodeMojibake(run) {
    const text = decodeRound(run);
    return text !== null && looksLikeCyrillicText(text) ? text : null;
}

/**
 * Like decodeMojibake, for text garbled up to `rounds` times in a row. Garbled Cyrillic is itself
 * mostly Cyrillic letters (Р, С), so rounds continue while they decode, and the last result that
 * reads as text wins.
 */
export function decodeMojibakeDeep(run, rounds = 6) {
    let current = run;
    let best = null;
    for (let round = 0; round < rounds; round++) {
        const next = decodeRound(current);
        if (next === null || next === current) break;
        if (looksLikeCyrillicText(next)) best = next;
        current = next;
    }
    return best;
}

/** The typographic character a garbled token stands for ("вЂ”" -> "—"), otherwise null. */
export function decodePunctuationMojibake(token) {
    const text = decodeRound(token);
    return text !== null && TYPOGRAPHIC.test(text) ? text : null;
}

/** True for text garbled at mixed levels: three or more garbled letter pairs. */
export function looksGarbled(run) {
    return (run.match(GARBLED_PAIR) ?? []).length >= 3;
}

/** Problems of one file's text, with 1-based line numbers. */
export function findEncodingProblems(text) {
    const problems = [];
    const lineOf = (index) => text.slice(0, index).split('\n').length;
    if (text.includes('�')) problems.push('contains U+FFFD');
    for (const match of text.matchAll(CANDIDATE)) {
        const original = decodeMojibakeDeep(match[0]);
        if (original !== null) {
            problems.push(`${lineOf(match.index)}: Windows-1251 mojibake "${match[0].slice(0, 30)}" (should read "${original.slice(0, 30)}")`);
        } else if (looksGarbled(match[0])) {
            problems.push(`${lineOf(match.index)}: garbled text (Windows-1251 at several levels) "${match[0].slice(0, 30)}"`);
        }
    }
    for (const match of text.matchAll(PUNCTUATION_CANDIDATE)) {
        const original = decodePunctuationMojibake(match[0]);
        if (original !== null) {
            problems.push(`${lineOf(match.index)}: Windows-1251 mojibake "${match[0]}" (should read "${original}")`);
        }
    }
    return problems;
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
            for (const problem of findEncodingProblems(text)) problems.push(`${rel}:${problem}`);
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
