import { analyticsReportDates } from '@/lib/analyticsReportDates';
test('default revisit covers western business day after the next scheduler execution', () => {
    expect(analyticsReportDates('2026-11-03', 'Pacific/Kiritimati')).toContain('2026-11-01');
    expect(analyticsReportDates('2026-11-04', 'Pacific/Kiritimati')).toContain('2026-11-01');
});
test('explicit dates across DST are calendar dates without duplicates or gaps', () => {
    expect(analyticsReportDates('2026-03-10', 'America/New_York', '2026-03-07', '2026-03-09')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
});
test.each([['2026-02-30', '2026-03-02'], ['2020-01-01', '2026-01-01'], ['2026-01-02', '2026-01-01'], ['2026-01-01', null]])('bad explicit dates reject instead of silently running yesterday %s %s', (start, end) => {
    expect(() => analyticsReportDates('2026-11-10', 'UTC', start, end)).toThrow();
});
