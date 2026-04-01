import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const activeDocs = [
    'README.md',
    'GETTING_STARTED.md',
    'CONTRIBUTING.md',
    'TESTING_GUIDE.md',
    'PROJECT_DOCUMENTATION.md',
    'docs/README.md',
    'docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md',
    'apps/web/README.md',
    'apps/mobile/README.md',
    'apps/web/e2e/README.md',
];

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

function normalizeDocPath(linkTarget, sourceFile) {
    const [rawPath, rawAnchor] = linkTarget.split('#');
    const anchor = rawAnchor?.trim() || null;

    if (!rawPath || rawPath === '') {
        return { filePath: sourceFile, anchor };
    }

    if (/^(https?:|mailto:)/i.test(rawPath)) {
        return null;
    }

    if (rawPath.startsWith('/C:/') || rawPath.startsWith('/c:/')) {
        return { filePath: rawPath.slice(1), anchor };
    }

    if (path.win32.isAbsolute(rawPath) || path.posix.isAbsolute(rawPath)) {
        return { filePath: rawPath, anchor };
    }

    return {
        filePath: path.resolve(path.dirname(sourceFile), rawPath),
        anchor,
    };
}

function slugifyHeading(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function collectAnchors(markdown) {
    const anchors = new Set();
    for (const line of markdown.split(/\r?\n/u)) {
        const match = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
        if (!match) {
            continue;
        }

        const heading = match[2].trim();
        anchors.add(slugifyHeading(heading));
    }

    return anchors;
}

const failures = [];

for (const relativeDocPath of activeDocs) {
    const sourceFile = path.resolve(repoRoot, relativeDocPath);
    const content = fs.readFileSync(sourceFile, 'utf8');
    const links = [...content.matchAll(markdownLinkPattern)];

    for (const link of links) {
        const target = link[1].trim();
        const normalized = normalizeDocPath(target, sourceFile);
        if (!normalized) {
            continue;
        }

        const { filePath, anchor } = normalized;
        if (!fs.existsSync(filePath)) {
            failures.push(`${relativeDocPath}: missing target ${target}`);
            continue;
        }

        if (anchor) {
            const targetMarkdown = fs.readFileSync(filePath, 'utf8');
            const anchors = collectAnchors(targetMarkdown);
            if (!anchors.has(anchor.toLowerCase())) {
                failures.push(`${relativeDocPath}: missing anchor ${target}`);
            }
        }
    }
}

if (failures.length > 0) {
    console.error('Broken markdown links found in active docs:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log(`Checked active docs links: ${activeDocs.length} files, no broken local links found.`);
