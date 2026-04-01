import type { ShiftItem } from '@/app/staff/finance/types';
import {
    collapseItem,
    createNewClientShiftItem,
    duplicateShiftItem,
    expandItem,
    hasMeaningfulShiftItemData,
    insertShiftItemAtIndex,
    mergeShiftItemsWithServer,
    prepareShiftItemsForSave,
    removeShiftItemAtIndex,
    serializeShiftItems,
    shiftExpandedItemsAfterDelete,
    shiftExpandedItemsAfterInsert,
} from '@/app/staff/finance/utils/itemLogic';

describe('finance itemLogic', () => {
    test('serializes only persisted finance fields', () => {
        const items: ShiftItem[] = [
            {
                id: 'item-1',
                clientName: 'A',
                serviceName: 'Cut',
                serviceAmount: 100,
                consumablesAmount: 5,
                bookingId: 'booking-1',
                createdAt: '2026-03-31T10:00:00.000Z',
            },
        ];

        expect(serializeShiftItems(items)).toBe(
            '[{"id":"item-1","clientName":"A","serviceName":"Cut","serviceAmount":100,"consumablesAmount":5,"bookingId":"booking-1","createdAt":"2026-03-31T10:00:00.000Z"}]',
        );
    });

    test('treats auto-generated client names as empty draft data', () => {
        expect(
            hasMeaningfulShiftItemData(
                {
                    clientName: 'Client 1',
                    serviceName: '',
                    serviceAmount: 0,
                    consumablesAmount: 0,
                    bookingId: null,
                    createdAt: null,
                },
                { autoClientLabel: 'Client' },
            ),
        ).toBe(false);
    });

    test('keeps only meaningful items when preparing items for save', () => {
        const result = prepareShiftItemsForSave(
            [
                {
                    clientName: 'Client 1',
                    serviceName: '',
                    serviceAmount: 0,
                    consumablesAmount: 0,
                    bookingId: null,
                    createdAt: null,
                },
                {
                    clientName: 'Jane',
                    serviceName: '',
                    serviceAmount: 0,
                    consumablesAmount: 0,
                    bookingId: null,
                    createdAt: null,
                },
            ],
            { autoClientLabel: 'Client' },
        );

        expect(result).toHaveLength(1);
        expect(result[0].clientName).toBe('Jane');
    });

    test('merges server items with local unsaved drafts without duplicating saved content', () => {
        const localItems: ShiftItem[] = [
            {
                id: 'item-1',
                clientName: 'Local Name',
                serviceName: '',
                serviceAmount: 100,
                consumablesAmount: 5,
                bookingId: 'booking-1',
                createdAt: '2026-03-31T10:00:00.000Z',
            },
            {
                clientName: 'Draft Client',
                serviceName: 'Color',
                serviceAmount: 200,
                consumablesAmount: 20,
                bookingId: null,
                createdAt: '2026-03-31T10:01:00.000Z',
            },
        ];
        const serverItems: ShiftItem[] = [
            {
                id: 'item-1',
                clientName: 'Server Name',
                serviceName: 'Cut',
                serviceAmount: 90,
                consumablesAmount: 5,
                bookingId: 'booking-1',
                createdAt: '2026-03-31T09:59:00.000Z',
            },
        ];

        expect(mergeShiftItemsWithServer(localItems, serverItems)).toEqual([
            {
                id: 'item-1',
                clientName: 'Local Name',
                serviceName: 'Cut',
                serviceAmount: 100,
                consumablesAmount: 5,
                bookingId: 'booking-1',
                createdAt: '2026-03-31T10:00:00.000Z',
            },
            {
                clientName: 'Draft Client',
                serviceName: 'Color',
                serviceAmount: 200,
                consumablesAmount: 20,
                bookingId: null,
                createdAt: '2026-03-31T10:01:00.000Z',
            },
        ]);
    });

    test('creates the next sequential auto client name', () => {
        const result = createNewClientShiftItem(
            [
                { clientName: 'Client 1' },
                { clientName: 'Client 2' },
            ],
            'Client',
            Date.UTC(2026, 2, 31, 9, 0, 0),
        );

        expect(result.clientName).toBe('Client 3');
        expect(result.createdAt).toBe('2026-03-31T09:00:00.100Z');
    });

    test('duplicates shift items without id and booking binding', () => {
        const result = duplicateShiftItem(
            [
                {
                    id: 'item-1',
                    clientName: 'Jane',
                    serviceName: 'Cut',
                    serviceAmount: 100,
                    consumablesAmount: 5,
                    bookingId: 'booking-1',
                    createdAt: '2026-03-31T10:00:00.000Z',
                },
            ],
            {
                id: 'item-1',
                clientName: 'Jane',
                serviceName: 'Cut',
                serviceAmount: 100,
                consumablesAmount: 5,
                bookingId: 'booking-1',
                createdAt: '2026-03-31T10:00:00.000Z',
            },
            Date.UTC(2026, 2, 31, 10, 0, 0),
        );

        expect(result).toEqual({
            clientName: 'Jane',
            serviceName: 'Cut',
            serviceAmount: 100,
            consumablesAmount: 5,
            bookingId: null,
            createdAt: '2026-03-31T10:00:00.100Z',
        });
    });

    test('removes and inserts items at a given index', () => {
        const items: ShiftItem[] = [{ clientName: 'A' }, { clientName: 'B' }];

        expect(removeShiftItemAtIndex(items, 0)).toEqual([{ clientName: 'B' }]);
        expect(insertShiftItemAtIndex(items, 1, { clientName: 'X' })).toEqual([
            { clientName: 'A' },
            { clientName: 'X' },
            { clientName: 'B' },
        ]);
    });

    test('expands and collapses item indexes', () => {
        expect(expandItem(new Set([1]), 2)).toEqual(new Set([1, 2]));
        expect(collapseItem(new Set([1, 2]), 1)).toEqual(new Set([2]));
    });

    test('shifts expanded indexes after delete and insert', () => {
        expect(shiftExpandedItemsAfterDelete(new Set([0, 2, 3]), 2)).toEqual(
            new Set([0, 2]),
        );
        expect(shiftExpandedItemsAfterInsert(new Set([0, 2]), 1)).toEqual(
            new Set([0, 3, 2]),
        );
    });
});
