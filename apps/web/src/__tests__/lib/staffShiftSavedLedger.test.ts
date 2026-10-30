import { matchesSavedShiftLedger, savedShiftLedgerItems } from '@/lib/staffShift/savedLedger';

test('normalizes null saved amounts without using a client total', () => {
    const saved = savedShiftLedgerItems([{id:'empty',service_amount:null,consumables_amount:null,booking_id:null}]);
    expect(saved).toEqual([{id:'empty',serviceAmount:0,consumablesAmount:0,bookingId:null}]);
    expect(matchesSavedShiftLedger([{}],saved)).toBe(true);
});

test('matches the legacy snake-case snapshot and null booking fields', () => {
    const saved = savedShiftLedgerItems([{id:'item',service_amount:301,consumables_amount:49,booking_id:'booking'}]);
    expect(matchesSavedShiftLedger([{service_amount:301,consumables_amount:49,booking_id:'booking'}],saved)).toBe(true);
    expect(matchesSavedShiftLedger([{amount:301,consumables_amount:50,booking_id:'booking'}],saved)).toBe(false);
});

test('compares unordered rows as a multiset and cannot reuse one matching row twice', () => {
    const saved = savedShiftLedgerItems([
        {id:'first',service_amount:1,consumables_amount:0,booking_id:null},
        {id:'second',service_amount:2,consumables_amount:0,booking_id:null},
    ]);
    expect(matchesSavedShiftLedger([{amount:2},{amount:1}],saved)).toBe(true);
    expect(matchesSavedShiftLedger([{amount:1},{amount:1}],saved)).toBe(false);
    expect(matchesSavedShiftLedger([],[])).toBe(true);
});
