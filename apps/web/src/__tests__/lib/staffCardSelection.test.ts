import { pickStaffCard, sortStaffCards } from '@core-domain/staff';

// ARCH-02: which staff card a request acts as, shared by web and mobile.
describe('pickStaffCard', () => {
    const older = { id: 'b-card', biz_id: 'biz-1', created_at: '2026-01-01T00:00:00Z' };
    const newer = { id: 'a-card', biz_id: 'biz-2', created_at: '2026-03-01T00:00:00Z' };

    test('no cards', () => {
        expect(pickStaffCard([], { explicitStaffId: 'a-card' })).toEqual({ status: 'none', options: [] });
    });

    test('a single card is used as is; a stale remembered choice is ignored', () => {
        expect(pickStaffCard([older], { preferredStaffId: 'gone' })).toEqual({ status: 'selected', record: older, options: [older] });
    });

    test('two cards without a choice ask to choose, oldest first', () => {
        expect(pickStaffCard([newer, older])).toEqual({ status: 'selection_required', options: [older, newer] });
        expect(pickStaffCard([newer, older], { preferredStaffId: 'gone' }).status).toBe('selection_required');
    });

    test('the remembered card is used while it is still active', () => {
        expect(pickStaffCard([older, newer], { preferredStaffId: 'a-card' })).toMatchObject({ status: 'selected', record: newer });
    });

    test('an explicit card beats the remembered one and is never replaced', () => {
        expect(pickStaffCard([older, newer], { explicitStaffId: 'b-card', preferredStaffId: 'a-card' })).toMatchObject({
            status: 'selected',
            record: older,
        });
        expect(pickStaffCard([older], { explicitStaffId: 'foreign' })).toEqual({ status: 'forbidden', options: [older] });
    });

    test('equal creation times are ordered by id', () => {
        const same = '2026-01-01T00:00:00Z';
        expect(sortStaffCards([{ id: 'b', biz_id: '1', created_at: same }, { id: 'a', biz_id: '2', created_at: same }]).map((row) => row.id)).toEqual(['a', 'b']);
    });
});
