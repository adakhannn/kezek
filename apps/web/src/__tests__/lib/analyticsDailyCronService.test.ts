import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';
function client() { return { from: jest.fn(), rpc: jest.fn().mockImplementation(async (_name, args) => ({ data: { date: args.p_date, updated: 0 }, error: null })) }; }
test('calls atomic replacement even when the day has become empty', async () => {
    const supabase = client();
    const result = await runAnalyticsDailyCron({ supabase, tz: 'Asia/Almaty', today: '2026-03-27' });
    expect(result.data.results).toEqual(['2026-03-24', '2026-03-25', '2026-03-26'].map(date => ({ date, updated: 0 })));
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
    expect(supabase.rpc).toHaveBeenCalledWith('recalculate_business_daily_stats', { p_date: '2026-03-26', p_default_tz: 'Asia/Almaty' });
    expect(supabase.from).not.toHaveBeenCalled();
});
test('replaces each explicit calendar date across a DST transition', async () => {
    const supabase = client();
    const result = await runAnalyticsDailyCron({ supabase, tz: 'America/New_York', startDate: '2026-03-07', endDate: '2026-03-09' });
    expect(result.data.results.map(row => row.date)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(supabase.rpc).toHaveBeenCalledTimes(3);
});
test('a source or transaction failure stops the range and never returns overall success', async () => {
    const supabase = client(); supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'source read failed' } });
    await expect(runAnalyticsDailyCron({ supabase, tz: 'UTC', startDate: '2026-11-01', endDate: '2026-11-03' })).rejects.toThrow('source read failed');
    expect(supabase.rpc).toHaveBeenCalledTimes(1); expect(supabase.from).not.toHaveBeenCalled();
});
test.each([null, {}, { date: '2026-11-01', updated: -1 }, { date: '2026-11-02', updated: 2 }])('rejects unconfirmed aggregate result %j', async data => {
    const supabase = client(); supabase.rpc.mockResolvedValueOnce({ data, error: null });
    await expect(runAnalyticsDailyCron({ supabase, tz: 'UTC', today: '2026-11-02' })).rejects.toThrow('confirmed result');
});
