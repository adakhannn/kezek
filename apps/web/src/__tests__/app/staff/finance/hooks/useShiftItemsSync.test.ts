import { mergeShiftItems } from '@/app/staff/finance/hooks/useShiftItemsSync';
import type { ShiftItem } from '@/app/staff/finance/types';

describe('mergeShiftItems', () => {
    it('preserves local edits for items with the same id', () => {
        const loaded: ShiftItem[] = [
            {
                id: '1',
                clientName: 'Server Name',
                serviceAmount: 100,
                createdAt: '2026-03-20T10:00:00.000Z',
            },
        ];

        const local: ShiftItem[] = [
            {
                id: '1',
                clientName: 'Local Name',
                serviceAmount: 200,
                createdAt: '2026-03-20T09:59:00.000Z',
            },
        ];

        expect(mergeShiftItems(loaded, local)).toEqual([
            expect.objectContaining({
                id: '1',
                clientName: 'Local Name',
                serviceAmount: 200,
                createdAt: '2026-03-20T10:00:00.000Z',
            }),
        ]);
    });

    it('matches local unsaved item with loaded saved item by clientName and timestamp without duplicating entry', () => {
        const loaded: ShiftItem[] = [
            {
                id: 'saved-1',
                clientName: 'Alice',
                createdAt: '2026-03-20T10:00:03.000Z',
            },
        ];

        const local: ShiftItem[] = [
            {
                clientName: 'Alice',
                serviceAmount: 150,
                createdAt: '2026-03-20T10:00:00.000Z',
            },
        ];

        expect(mergeShiftItems(loaded, local)).toEqual([
            {
                id: 'saved-1',
                clientName: 'Alice',
                createdAt: '2026-03-20T10:00:03.000Z',
            },
        ]);
    });

    it('keeps unmatched local unsaved item', () => {
        const loaded: ShiftItem[] = [];
        const local: ShiftItem[] = [
            {
                clientName: 'Bob',
                serviceAmount: 90,
                createdAt: '2026-03-20T10:00:00.000Z',
            },
        ];

        expect(mergeShiftItems(loaded, local)).toEqual(local);
    });

    it('sorts newer items first', () => {
        const loaded: ShiftItem[] = [
            {
                id: 'older',
                clientName: 'Older',
                createdAt: '2026-03-20T09:00:00.000Z',
            },
            {
                id: 'newer',
                clientName: 'Newer',
                createdAt: '2026-03-20T11:00:00.000Z',
            },
        ];

        const local: ShiftItem[] = [];

        expect(mergeShiftItems(loaded, local).map((item) => item.id)).toEqual(['newer', 'older']);
    });
});
