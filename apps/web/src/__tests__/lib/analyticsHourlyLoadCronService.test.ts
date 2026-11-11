import { recalcHourlyForDate } from '@/lib/analyticsHourlyLoadCronService';
jest.mock('@/lib/time', () => ({ getTimezone: () => 'Asia/Bishkek' }));
test('always runs complete atomic replacement, including zero-result days', async () => {
    const supabase = { from: jest.fn(), rpc: jest.fn().mockResolvedValue({ data: { date: '2026-03-27', updated: 0 }, error: null }) };
    expect(await recalcHourlyForDate({ supabase, dateStr: '2026-03-27' })).toEqual({ date: '2026-03-27', updated: 0 });
    expect(supabase.rpc).toHaveBeenCalledWith('recalculate_business_hourly_load', { p_date: '2026-03-27', p_default_tz: 'Asia/Bishkek' });
    expect(supabase.from).not.toHaveBeenCalled();
});
test('does not hide a timezone/business dependency failure as empty data', async () => {
    const supabase = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'invalid business timezone' } }) };
    await expect(recalcHourlyForDate({ supabase, dateStr: '2026-03-27' })).rejects.toThrow('invalid business timezone');
});
