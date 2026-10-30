/** @jest-environment jsdom */
import { exportShiftSummaryToCSV } from '@/app/staff/finance/utils/export';

test('summary CSV uses one full-receipt basis and explicit components', async () => {
    let captured:Blob | undefined;
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn((blob:Blob | MediaSource) => {captured=blob as Blob;return 'blob:test';});
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {});
    try {
        exportShiftSummaryToCSV(null,{displayTotalAmount:251,totalConsumables:49,masterShare:151,salonShare:149},[],new Date('2026-10-12T06:00:00Z'));
        const csv = await new Promise<string>((resolve,reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsText(captured!);
        });
        expect(csv).toContain('"Общий оборот (сом)","300.00"');
        expect(csv).toContain('"Сумма услуг (сом)","251.00"');
        expect(csv).toContain('"Расходники (сом)","49.00"');
        expect(csv).toContain('"Сотруднику (сом)","151.00"');
        expect(csv).toContain('"Бизнесу (сом)","149.00"');
    } finally {
        URL.createObjectURL = previousCreate;
        URL.revokeObjectURL = previousRevoke;
        click.mockRestore();
    }
});
