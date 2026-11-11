import fs from 'node:fs';
import path from 'node:path';
import { documentationFiles, repoRoot, markdownLinks, headingAnchors, resolveDocLink, jsonFenceFailures } from './docs-lib.mjs';
import { generateDocsCatalog } from './generate-docs-catalog.mjs';
import { generateApiCatalog } from './generate-api-catalog.mjs';

const documents = documentationFiles().filter(document => ['current', 'design'].includes(document.kind));
const failures = [];
const anchors = new Map();
let linkCount = 0;
for (const document of documents) {
    const content = fs.readFileSync(path.join(repoRoot, document.file), 'utf8');
    for (const link of markdownLinks(content)) {
        if (link.error) { failures.push(`${document.file}:${link.line}: ${link.error}`); continue; }
        const target = resolveDocLink(document.file, link.target);
        if (!target) continue;
        linkCount++;
        if (target.error) { failures.push(`${document.file}:${link.line}: ${target.error}`); continue; }
        if (!fs.existsSync(target.filePath)) { failures.push(`${document.file}:${link.line}: missing target ${link.target}`); continue; }
        if (!target.anchor) continue;
        if (!fs.statSync(target.filePath).isFile()) { failures.push(`${document.file}:${link.line}: anchor on directory ${link.target}`); continue; }
        const text = fs.readFileSync(target.filePath, 'utf8');
        if (!target.filePath.endsWith('.md') && /^L\d+(?:-L\d+)?$/.test(target.anchor)) {
            const [start, end = start] = target.anchor.match(/\d+/g).map(Number);
            if (start < 1 || end < start || end > text.split(/\r?\n/).length) failures.push(`${document.file}:${link.line}: invalid source line ${link.target}`);
        } else {
            if (!anchors.has(target.filePath)) anchors.set(target.filePath, headingAnchors(text));
            if (!anchors.get(target.filePath).has(target.anchor)) failures.push(`${document.file}:${link.line}: missing anchor ${link.target}`);
        }
    }
    for (const issue of jsonFenceFailures(content)) failures.push(`${document.file}:${issue.line}: ${issue.error}`);
    if (/\uFFFD/.test(content)) failures.push(`${document.file}: replacement character U+FFFD found`);
    if (/(?:[РС][^\s]){5,}/u.test(content)) failures.push(`${document.file}: probable UTF-8/Windows-1251 mojibake; inspect text encoding`);
}
for (const [file, generate] of [['docs/DOCUMENTATION_MAP.md', generateDocsCatalog], ['docs/api/ROUTE_CATALOG.md', generateApiCatalog]]) {
    if (!fs.existsSync(path.join(repoRoot, file)) || fs.readFileSync(path.join(repoRoot, file), 'utf8').replace(/\r\n/g, '\n') !== generate()) failures.push(`${file}: generated catalog is stale`);
}
if (failures.length) {
    console.error('Documentation checks failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Checked ${documents.length} current/reference documents and ${linkCount} local links: links, anchors, JSON examples and generated catalogs are consistent.`);
}
