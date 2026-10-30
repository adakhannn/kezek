import type { ShiftItem } from '@/app/staff/finance/types';
import {
    collapseItem,
    createNewClientShiftItem,
    duplicateShiftItem,
    expandItem,
    hasMeaningfulShiftItemData,
    insertShiftItemAtIndex,
    isAutoClientName,
    mergeShiftItemsWithServer,
    prepareShiftItemsForSave,
    removeShiftItemAtIndex,
    serializeShiftItems,
    shiftExpandedItemsAfterDelete,
    shiftExpandedItemsAfterInsert,
} from '@/app/staff/finance/utils/itemLogic';

describe('finance itemLogic', () => {
    test.each([null, undefined, '', '   ', 'Client'])('does not mistake empty or incomplete names %p for auto names', name => {
        expect(isAutoClientName(name,'Client')).toBe(false);
    });

    test('empty generated draft stays unsaved and missing values serialize consistently', () => {
        const draft = createNewClientShiftItem([], 'Client');
        expect(prepareShiftItemsForSave([draft],{autoClientLabel:'Client'})).toEqual([]);
        expect(serializeShiftItems([{}])).toBe('[{"id":null,"clientName":"","serviceName":"","serviceAmount":0,"consumablesAmount":0,"bookingId":null}]');
    });

    test('unacknowledged stable draft is not merged into a different matching row', () => {
        const draft = createNewClientShiftItem([], 'Client');
        Object.assign(draft,{clientName:'Same',serviceName:'Cut',serviceAmount:10});
        const server = {...draft,id:'different-row',clientId:undefined};
        expect(mergeShiftItemsWithServer([draft],[server])).toEqual([server,draft]);
    });

    test('legacy acknowledgement skips malformed server rows and recognizes persisted content', () => {
        const draft = {clientName:'Same',serviceName:'Cut',serviceAmount:10,consumablesAmount:0,bookingId:null};
        const server = {...draft,id:'row'};
        expect(mergeShiftItemsWithServer([draft],[{},server])).toEqual([server]);
    });

    test('draft identity survives acknowledgement with changed server timestamp', () => {
        const draft = createNewClientShiftItem([], 'Client');
        Object.assign(draft, {clientName:'LIVE TEST', serviceName:'Cut',serviceAmount:251,consumablesAmount:49});
        expect(draft.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        const server = {...draft,id:draft.clientId,clientId:undefined,createdAt:'2026-10-12T05:00:00Z'};
        const merged = mergeShiftItemsWithServer([draft],[server]);
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe(draft.clientId);
        expect(merged[0].clientId).toBeUndefined();
        expect(serializeShiftItems(merged)).toBe(serializeShiftItems([draft]));
    });

    test('two deliberately identical drafts keep independent identities', () => {
        const first = createNewClientShiftItem([], 'Client');
        Object.assign(first,{clientName:'LIVE TEST',serviceName:'Cut',serviceAmount:251});
        const second = duplicateShiftItem([first], first);
        expect(second.clientId).not.toBe(first.clientId);
        const acknowledged = {...first,id:first.clientId,clientId:undefined};
        const merged = mergeShiftItemsWithServer([first,second],[acknowledged]);
        expect(merged).toHaveLength(2);
        expect(merged[1].clientId).toBe(second.clientId);
    });

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
            '[{"id":"item-1","clientName":"A","serviceName":"Cut","serviceAmount":100,"consumablesAmount":5,"bookingId":"booking-1"}]',
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
            clientId: expect.any(String),
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
