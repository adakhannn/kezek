import { shiftSummaryAmounts } from '@/app/staff/finance/utils/summaryAmounts';

test.each([[251,49,300],[0,0,0],[251,0,251],[0,49,49],[10.25,0.75,11]])(
    'separates services%s and consumables%s into full receipt%s', (services,consumables,total) => {
        expect(shiftSummaryAmounts({displayTotalAmount:services,totalConsumables:consumables}))
            .toEqual({services,consumables,total});
    },
);
