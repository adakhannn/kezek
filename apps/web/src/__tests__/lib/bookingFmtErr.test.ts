import { fmtErr } from '@/app/b/[slug]/utils';

describe('fmtErr on the public booking page', () => {
    it('shows clients the message without database details, hints or codes', () => {
        const text = fmtErr({
            message: 'Не удалось создать запись',
            details: 'Key (staff_id, time_range) conflicts with existing key',
            hint: 'Check the no_overlap constraint',
            code: '23P01',
        });

        expect(text).toBe('Не удалось создать запись');
        expect(text).not.toMatch(/Details|Hint|Code|no_overlap|23P01/);
    });

    it('keeps the friendly texts for known business errors', () => {
        expect(fmtErr({ code: 'booking_slot_unavailable', message: 'x' })).toBe('Это время уже занято. Выберите другой свободный слот.');
        expect(fmtErr({ message: 'staff is not assigned to branch' })).toContain('мастер не прикреплён');
    });
});
