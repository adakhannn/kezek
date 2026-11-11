import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

test('every limited route passes its stable route template explicitly', () => {
    const root = path.resolve(__dirname, '../../app');
    const failures: string[] = [];
    let calls = 0;
    function walk(directory: string) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) { walk(filename); continue; }
            if (!/^route\.tsx?$/.test(entry.name)) continue;
            const text = fs.readFileSync(filename, 'utf8');
            const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
            const expected = '/' + path.relative(root, directory).split(path.sep)
                .filter(segment => !segment.startsWith('(')).join('/');
            function visit(node: ts.Node) {
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'withRateLimit') {
                    calls++;
                    const route = node.arguments[3];
                    if (node.arguments.length !== 4 || !route || !ts.isStringLiteral(route) || route.text !== expected) {
                        failures.push(path.relative(root, filename));
                    }
                }
                ts.forEachChild(node, visit);
            }
            visit(source);
        }
    }
    walk(root);
    expect(calls).toBeGreaterThanOrEqual(67);
    expect(failures).toEqual([]);
});
