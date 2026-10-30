import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const fontDir = path.resolve(__dirname, '../../app/fonts');
const provenance = JSON.parse(fs.readFileSync(path.join(fontDir, 'provenance.json'), 'utf8'));

describe('self-hosted Geist delivery', () => {
    test.each(provenance.fonts)('$family uses the unchanged official variable binary', (entry) => {
        const bytes = fs.readFileSync(path.join(fontDir, entry.file));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
        expect(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')).toBe(entry.gitBlobSha);
        // Metadata/cmap/axis parity is independently inspected with the real Next
        // fontkit in C57; next/jest intentionally stubs font loader internals.
        expect(bytes.readUInt32BE(0)).toBe(0x00010000);
    });

    test('layout preserves both variables and font settings without Google downloads', () => {
        const layout = fs.readFileSync(path.resolve(fontDir, '../layout.tsx'), 'utf8');
        expect(layout).toContain("import localFont from 'next/font/local'");
        expect(layout).not.toContain('next/font/google');
        for (const file of ['Geist.ttf', 'GeistMono.ttf']) expect(layout).toContain(`src: './fonts/${file}'`);
        for (const variable of ['--font-geist-sans', '--font-geist-mono']) expect(layout).toContain(`variable: '${variable}'`);
        for (const setting of ["weight: '100 900'", "style: 'normal'", "display: 'swap'"]) expect(layout.split(setting)).toHaveLength(3);
        expect(layout.split('adjustFontFallback: false')).toHaveLength(3);
        expect(layout).toContain("fallback: ['Geist Fallback']");
        expect(layout).toContain("fallback: ['Geist Mono Fallback']");
        expect(layout).toContain('${geistSans.variable} ${geistMono.variable}');
    });

    test('loading fallback retains the previous Google-loader metrics', () => {
        const css = fs.readFileSync(path.join(fontDir, 'fallbacks.css'), 'utf8');
        for (const metric of ['95.94%', '28.16%', '104.76%', '74.67%', '21.92%', '134.59%']) expect(css).toContain(metric);
        expect(css).not.toContain('http');
    });

    test('distribution retains the copyright and full OFL license', () => {
        const license = fs.readFileSync(path.join(fontDir, 'OFL.txt'), 'utf8');
        expect(license).toContain('Copyright 2024 The Geist Project Authors');
        expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
        expect(license).toContain('PERMISSION & CONDITIONS');
        expect(license).toContain('TERMINATION');
        expect(license).toContain('DISCLAIMER');
        expect(license).toContain('OTHER DEALINGS IN THE FONT SOFTWARE.');
    });
});
