import fs from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '..');
const ignoredDirectories = new Set(['node_modules', '.git', '.next', '.expo', '.turbo', 'dist', 'build', 'coverage', 'playwright-report', 'test-results']);
const evidenceFiles = new Set(['SCENARIO_TEST_REGISTRY.md', 'docs/MANUAL_TESTING_TRACKER.md', 'docs/MOBILE_BUG_REGISTRY.md', 'docs/MOBILE_TESTING_AREAS_CATALOG.md']);
const historicalSnapshots = new Map([
    ['docs/SCHEDULE_REMOTE_ROLLOUT.md', 'История включения расписаний: 1–9 октября 2026'],
    ['docs/STAFF_SCHEDULE_ROLLBACK.md', 'Исторический откат расписаний: 18 сентября 2026'],
]);
export const slash = value => value.split(path.sep).join('/');

export function walkFiles(relativeDirectory, accept) {
    const result = [];
    const visit = directory => {
        for (const entry of fs.readdirSync(path.join(repoRoot, directory), { withFileTypes: true })) {
            if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name)) continue;
            const relative = slash(path.join(directory, entry.name));
            if (relative === 'docs/verification' || relative === 'docs/mobile-visual-baselines') continue;
            if (entry.isDirectory()) visit(relative);
            else if (entry.isFile() && accept(relative)) result.push(relative);
        }
    };
    visit(relativeDirectory);
    return result.sort();
}

export function documentationFiles() {
    const roots = fs.readdirSync(repoRoot, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => entry.name);
    const nested = ['docs', 'apps', 'packages', 'supabase'].flatMap(directory => walkFiles(directory, file => file.endsWith('.md')));
    return [...new Set([...roots, ...nested])].sort().map(file => {
        if (file === 'AGENTS.md') return { file, kind: 'instructions', title: 'Инструкции агента' };
        if (historicalSnapshots.has(file)) return { file, kind: 'history', title: historicalSnapshots.get(file) };
        const campaign = evidenceFiles.has(file) || /^docs\/WEB_/.test(file) && !/(?:TASKS|HARDENING_PLAN)\.md$/.test(file);
        if (campaign) return { file, kind: 'evidence', title: path.basename(file, '.md') };
        const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
        const title = /^#\s+(.+)$/m.exec(content)?.[1].trim() || path.basename(file, '.md');
        const historical = file === 'CHANGELOG.md' || file.startsWith('docs/archive/') && file !== 'docs/archive/README.md' || /Статус: исторический/.test(content.slice(0, 1800));
        const kind = historical ? 'history' : /(?:_ADR|_DESIGN|_SCENARIOS|_CHECKLIST)\.md$/.test(file) || /Статус: проект решения/.test(content.slice(0, 1800)) ? 'design' : 'current';
        return { file, kind, title };
    });
}

export function stripFences(markdown) {
    let fence = null;
    return markdown.split(/\r?\n/).map(line => {
        const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (match && !fence) { fence = match[1]; return ''; }
        if (fence) {
            if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
            return '';
        }
        return line;
    }).join('\n');
}

function stripInlineCode(value) {
    return value.replace(/(`+)([\s\S]*?)\1/g, match => ' '.repeat(match.length));
}

export function markdownLinks(markdown) {
    const text = stripInlineCode(stripFences(markdown).replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' ')));
    const links = [];
    const definitions = new Map();
    const refKey = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
    const lineAt = index => text.slice(0, index).split('\n').length;
    for (const match of text.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
        const key = refKey(match[1]);
        if (!definitions.has(key)) definitions.set(key, match[2] || match[3]);
    }
    // Balanced link destinations support parentheses in filenames and optional titles.
    for (const match of text.matchAll(/!?\[((?:\\.|[^\]\\])*)\]\(/g)) {
        let offset = match.index + match[0].length;
        while (/\s/.test(text[offset] || '') && offset < text.length) offset++;
        const start = offset;
        let target = '';
        if (text[offset] === '<') {
            const end = text.indexOf('>', offset + 1);
            if (end < 0) continue;
            target = text.slice(offset + 1, end);
        } else {
            let depth = 0;
            for (; offset < text.length; offset++) {
                const character = text[offset];
                if (character === '\\') { offset++; continue; }
                if (character === '(') depth++;
                if (character === ')' && depth-- === 0 || /\s/.test(character) && depth <= 0) break;
            }
            target = text.slice(start, offset);
        }
        if (target) links.push({ target: target.replace(/\\([() ])/g, '$1'), line: lineAt(match.index) });
    }
    for (const match of text.matchAll(/!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
        const after = text[match.index + match[0].length];
        if (after === '(' || after === ':') continue;
        const key = refKey(match[2] || match[1]);
        if (definitions.has(key)) links.push({ target: definitions.get(key), line: lineAt(match.index) });
        else if (match[2] !== undefined) links.push({ error: `undefined reference [${key}]`, line: lineAt(match.index) });
    }
    return links;
}

export function headingAnchors(markdown) {
    const text = stripFences(markdown).replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));
    const anchors = new Set();
    const used = new Set();
    const lines = text.split('\n');
    const slug = heading => heading.replace(/<[^>]+>/g, '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    for (let index = 0; index < lines.length; index++) {
        const atx = /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(lines[index]);
        const heading = atx?.[1] || (index + 1 < lines.length && /^\s{0,3}(?:=+|-+)\s*$/.test(lines[index + 1]) && lines[index].trim() ? lines[index] : null);
        if (heading) {
            const base = slug(heading);
            let value = base;
            for (let suffix = 1; used.has(value); suffix++) value = `${base}-${suffix}`;
            used.add(value); anchors.add(value);
        }
    }
    for (const match of text.matchAll(/<(?:a|[a-z][a-z0-9]*)\b[^>]*(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
    return anchors;
}

export function resolveDocLink(source, target) {
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(target)) return null;
    if (/^file:/i.test(target) || path.win32.isAbsolute(target) || path.posix.isAbsolute(target)) return { error: `use a repository-relative link: ${target}` };
    const hash = target.indexOf('#');
    let rawPath = hash < 0 ? target : target.slice(0, hash);
    let anchor = hash < 0 ? '' : target.slice(hash + 1);
    try { rawPath = decodeURIComponent(rawPath); anchor = decodeURIComponent(anchor); } catch { return { error: `invalid URI encoding: ${target}` }; }
    if (/^file:/i.test(rawPath) || path.win32.isAbsolute(rawPath) || path.posix.isAbsolute(rawPath)) return { error: `use a repository-relative link: ${target}` };
    const filePath = rawPath ? path.resolve(repoRoot, path.dirname(source), rawPath) : path.join(repoRoot, source);
    const relative = path.relative(repoRoot, filePath);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) return { error: `link leaves repository: ${target}` };
    return { filePath, anchor };
}

export function jsonFenceFailures(markdown) {
    const errors = [];
    const lines = markdown.split(/\r?\n/);
    let open = null;
    for (let index = 0; index < lines.length; index++) {
        const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
        if (!open && match) open = { fence: match[1], language: match[2].trim().toLowerCase(), line: index + 1, body: [] };
        else if (open && match && match[1][0] === open.fence[0] && match[1].length >= open.fence.length && !match[2].trim()) {
            if (open.language === 'json') try { JSON.parse(open.body.join('\n')); } catch (error) { errors.push({ line: open.line, error: `invalid JSON example: ${error.message.split('\n')[0]}` }); }
            open = null;
        } else if (open) open.body.push(lines[index]);
    }
    if (open) errors.push({ line: open.line, error: 'unclosed code fence' });
    return errors;
}
