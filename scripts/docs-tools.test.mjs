import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
    headingAnchors,
    jsonFenceFailures,
    markdownLinks,
    repoRoot,
    resolveDocLink,
    stripFences,
} from './docs-lib.mjs';

// Pure documentation checks: fixtures are strings, no application imports,
// filesystem writes, environment reads, network requests, or product runtime.
const lines = (...values) => values.join('\n');

test('links in fenced code, inline code, and HTML comments are ignored with source line numbers preserved', () => {
    const markdown = lines(
        '[first](first.md)',
        '```md',
        '[hidden](fenced.md)',
        '```',
        '`[hidden](inline.md)` and ``text ` [hidden](wide-code.md)``',
        '<!-- [hidden](comment.md) -->',
        '~~~text',
        '[hidden](tilde.md)',
        '~~~',
        '[last](last.md)',
    );
    assert.deepEqual(markdownLinks(markdown), [
        { target: 'first.md', line: 1 },
        { target: 'last.md', line: 10 },
    ]);
});

test('a shorter fence does not close a longer fence', () => {
    const markdown = lines('````md', '```', '[hidden](bad.md)', '````', '[shown](good.md)');
    assert.deepEqual(markdownLinks(markdown), [{ target: 'good.md', line: 5 }]);
    assert.equal(stripFences(markdown).split('\n').length, 5);
});

test('full, collapsed, shortcut, and image reference links resolve normalized definitions', () => {
    const markdown = lines(
        '[visible][Mixed   Case]',
        '[Collapsed][]',
        '[Shortcut]',
        '![diagram][picture]',
        '',
        '[mixed case]: ./target.md "Title"',
        '[collapsed]: <./file with spaces.md>',
        '[shortcut]: ../README.md',
        '[picture]: ./diagram.svg',
    );
    assert.deepEqual(markdownLinks(markdown), [
        { target: './target.md', line: 1 },
        { target: './file with spaces.md', line: 2 },
        { target: '../README.md', line: 3 },
        { target: './diagram.svg', line: 4 },
    ]);
});

test('explicit missing references are reported while ordinary bracketed prose is ignored', () => {
    assert.deepEqual(markdownLinks(lines('[text][MISSING]', '[empty][]', 'ordinary [prose]')), [
        { error: 'undefined reference [missing]', line: 1 },
        { error: 'undefined reference [empty]', line: 2 },
    ]);
});

test('the first duplicate reference definition is authoritative', () => {
    const markdown = lines('[text][ref]', '[ref]: first.md', '[REF]: second.md');
    assert.deepEqual(markdownLinks(markdown), [{ target: 'first.md', line: 1 }]);
});

test('balanced parentheses, escaped delimiters, angle targets, and optional titles are parsed', () => {
    const markdown = lines(
        '[nested](./design(v2(part)).md#part "A title")',
        '[escaped](./literal\\(name\\).md)',
        '[spaces](<./folder/file with spaces.md#part> "A title")',
        '![image](./image(v1).svg)',
    );
    assert.deepEqual(markdownLinks(markdown), [
        { target: './design(v2(part)).md#part', line: 1 },
        { target: './literal(name).md', line: 2 },
        { target: './folder/file with spaces.md#part', line: 3 },
        { target: './image(v1).svg', line: 4 },
    ]);
});

test('headings preserve underscores and Unicode, remove formatting, and allocate collision-free duplicate anchors', () => {
    const markdown = lines(
        '# API_NAME',
        '## API_NAME',
        '### API_NAME-1',
        '# Привет, мир!',
        '## `код` и [ссылка](./page.md) ###',
    );
    assert.deepEqual([...headingAnchors(markdown)], [
        'api_name', 'api_name-1', 'api_name-1-1', 'привет-мир', 'код-и-ссылка',
    ]);
});

test('setext and explicit anchors are found, but fenced headings are not', () => {
    const markdown = lines(
        'Section One', '===',
        'Section Two', '---',
        '<a id="manual_anchor"></a>',
        '<a name="legacy-anchor"></a>',
        '```md', '# Hidden', '<a id="hidden-anchor"></a>', '```',
    );
    assert.deepEqual([...headingAnchors(markdown)], [
        'section-one', 'section-two', 'manual_anchor', 'legacy-anchor',
    ]);
});

test('headings and anchors inside HTML comments do not create valid targets', () => {
    const markdown = lines('<!--', '# Hidden heading', '<a id="hidden-id"></a>', '-->', '# Visible');
    assert.deepEqual([...headingAnchors(markdown)], ['visible']);
});

test('relative and same-document targets resolve with decoded URI path and anchor', () => {
    assert.deepEqual(resolveDocLink('docs/api/guide.md', '../file%20name.md#%D1%82%D0%B5%D0%BC%D0%B0'), {
        filePath: path.join(repoRoot, 'docs', 'file name.md'),
        anchor: 'тема',
    });
    assert.deepEqual(resolveDocLink('docs/api/guide.md', '#api_name'), {
        filePath: path.join(repoRoot, 'docs', 'api', 'guide.md'),
        anchor: 'api_name',
    });
    assert.deepEqual(resolveDocLink('docs/api/guide.md', '../../README.md'), {
        filePath: path.join(repoRoot, 'README.md'),
        anchor: '',
    });
});

test('external URI schemes are left to external-link checks', () => {
    for (const target of ['https://example.invalid/a', 'HTTP://example.invalid', 'mailto:user@example.invalid', 'tel:+1234567890', 'data:image/svg+xml,test']) {
        assert.equal(resolveDocLink('docs/guide.md', target), null, target);
    }
});

test('paths escaping the repository and malformed URI encoding are rejected', () => {
    for (const target of ['../../outside.md', '%2e%2e/%2e%2e/outside.md', '../../../README.md#x']) {
        assert.match(resolveDocLink('docs/guide.md', target).error, /leaves repository/, target);
    }
    for (const target of ['file%ZZ.md', '#anchor%E0%A4%A']) {
        assert.match(resolveDocLink('docs/guide.md', target).error, /invalid URI encoding/, target);
    }
});

test('Windows, POSIX, network, and file absolute targets are rejected on every host', () => {
    for (const target of [
        'C:\\projects\\kezek\\README.md',
        'C:/projects/kezek/README.md',
        '\\\\server\\share\\README.md',
        '/tmp/README.md',
        '//server/share/README.md',
        'file:///C:/projects/kezek/README.md',
        'FILE:///tmp/README.md',
    ]) {
        assert.match(resolveDocLink('docs/guide.md', target).error, /repository-relative link/, target);
    }
});

test('URI encoding cannot hide an absolute path even when it points inside the repository', () => {
    for (const target of [
        encodeURIComponent(path.join(repoRoot, 'README.md')),
        'file%3A%2F%2F%2FC%3A%2Fprojects%2Fkezek%2FREADME.md',
        'C%3A%2Fprojects%2Fkezek%2FREADME.md',
        '%2Ftmp%2FREADME.md',
    ]) {
        assert.match(resolveDocLink('docs/guide.md', target).error, /repository-relative link/, target);
    }
});

test('valid JSON fences accept objects, arrays, primitives, tilde fences, and CRLF', () => {
    const markdown = lines(
        '```json', '{"ok":true,"items":[1,null]}', '```',
        '~~~json', '[1,2,3]', '~~~~',
        '```JSON', 'false', '```',
        '```js', 'not JSON', '```',
    ).replaceAll('\n', '\r\n');
    assert.deepEqual(jsonFenceFailures(markdown), []);
});

test('invalid JSON examples report their opening line without validating non-JSON fences', () => {
    const markdown = lines(
        '# Examples',
        '```json', '{"value": undefined}', '```',
        '```json', '{"value": 1,}', '```',
        '```ts', '{value: undefined}', '```',
    );
    const failures = jsonFenceFailures(markdown);
    assert.deepEqual(failures.map(({ line }) => line), [2, 5]);
    for (const failure of failures) assert.match(failure.error, /^invalid JSON example:/);
});

test('unclosed and mismatched fences are reported rather than silently dropping examples', () => {
    for (const markdown of [
        lines('text', '```json', '{"ok":true}'),
        lines('text', '```json', '{"ok":true}', '~~~'),
        lines('text', '````json', '{"ok":true}', '```'),
        lines('text', '~~~text', 'unfinished'),
    ]) {
        assert.deepEqual(jsonFenceFailures(markdown), [{ line: 2, error: 'unclosed code fence' }]);
    }
});
