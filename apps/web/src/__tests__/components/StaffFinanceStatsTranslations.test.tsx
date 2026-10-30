/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import StaffFinanceStatsPageClient from '@/app/dashboard/staff/[id]/finance/stats/StaffFinanceStatsPageClient';
import { StaffFinanceStatsFilters, StaffFinanceStatsSummary, StaffFinanceStatsShifts } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsSections';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import { commonRu } from '@/app/_components/i18n/dictionaries/common.ru';
import { commonKy } from '@/app/_components/i18n/dictionaries/common.ky';
import { commonEn } from '@/app/_components/i18n/dictionaries/common.en';
import type { StaffFinanceStatsPayload } from '@/lib/finance/types';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage:jest.fn()}));
jest.mock('@/app/dashboard/staff/[id]/finance/components/StaffFinanceStats', () => ({__esModule:true,default:() => null}));
jest.mock('@/app/dashboard/staff/[id]/finance/components/FinanceSettingsAuditLog', () => ({__esModule:true,default:() => null}));

const zeroStats: StaffFinanceStatsPayload = {
    period:'day',dateFrom:'2026-10-12',dateTo:'2026-10-12',staffName:'LIVE TEST',
    shiftsCount:1,openShiftsCount:0,closedShiftsCount:1,totalAmount:0,totalMaster:0,totalSalon:0,
    totalConsumables:0,totalLateMinutes:0,totalClients:0,totalBaseMasterShare:0,totalBaseSalonShare:0,
    totalGuaranteedAmount:0,hasGuaranteedPayment:false,
    shifts:[{id:'shift-test',shift_date:'2026-10-12',status:'closed',opened_at:'2026-10-11T22:47:00Z',
        closed_at:'2026-10-11T22:48:00Z',total_amount:0,consumables_amount:0,master_share:0,
        salon_share:0,late_minutes:0,hours_worked:null,hourly_rate:null,guaranteed_amount:0,items:[]}],
};
const locales = [
    ['ru',{...financeRu,...commonRu}],['ky',{...financeKy,...commonKy}],['en',{...financeEn,...commonEn}],
] as const;

test.each(locales)('localizes the observed finance statistics and editor in %s without finance fallbacks', (locale,dictionary) => {
    const t = (key:string,fallback:string) => {
        if (key.startsWith('finance.') || key === 'common.save') expect(Object.hasOwn(dictionary,key)).toBe(true);
        return (dictionary as Record<string,string>)[key] ?? fallback;
    };
    jest.mocked(useLanguage).mockReturnValue({locale,t} as ReturnType<typeof useLanguage>);
    render(<>
        <StaffFinanceStatsPageClient id="staff-test" fullName="LIVE TEST" />
        <StaffFinanceStatsFilters period="day" date="2026-10-12" loading={false}
            onPeriodChange={jest.fn()} onDateChange={jest.fn()} onRefresh={jest.fn()} t={t} />
        <StaffFinanceStatsSummary stats={zeroStats} period="day" periodLabel="12.10.2026" locale={locale} t={t} />
        <StaffFinanceStatsShifts stats={zeroStats} locale={locale} t={t} onHoursUpdated={jest.fn()} />
    </>);
    expect(screen.getByText(dictionary['finance.meta.moneyTitle'])).toBeTruthy();
    expect(screen.getByText(dictionary['finance.meta.guaranteesTitle'])).toBeTruthy();
    expect(screen.getByText(dictionary['finance.meta.auditTitle'])).toBeTruthy();
    expect(screen.getByRole('heading',{name:dictionary['finance.filters.title']})).toBeTruthy();
    expect(screen.getByLabelText(dictionary['finance.filters.dateLabel'])).toBeTruthy();
    expect(screen.getByText(dictionary['finance.guarantees.notUsed'])).toBeTruthy();
    expect(screen.getByRole('heading',{name:dictionary['finance.operational.readout']})).toBeTruthy();
    expect(screen.queryByText('day',{exact:true})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:/12\.10\.2026/}));
    for (const key of ['client','service','amount','createdAt','noClients'] as const) {
        expect(screen.getByText(dictionary[`finance.staffStats.${key}`])).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button',{name:dictionary['finance.staffStats.editHours'],exact:true}));
    expect(screen.getByRole('spinbutton',{name:dictionary['finance.staffStats.editHoursPrompt']})).toBeTruthy();
    expect(screen.getByRole('button',{name:dictionary['common.save'],exact:true})).toBeTruthy();
    expect(screen.getByRole('button',{name:dictionary['common.cancel'],exact:true})).toBeTruthy();
});

test.each(locales)('keeps populated guarantee/review entries localized in %s', (locale,dictionary) => {
    const t = (key:string,fallback:string) => {
        expect(Object.hasOwn(dictionary,key)).toBe(true);
        return (dictionary as Record<string,string>)[key] ?? fallback;
    };
    const stats = {...zeroStats,totalLateMinutes:5,totalConsumables:20,totalGuaranteedAmount:40};
    render(<StaffFinanceStatsSummary stats={stats} period="month" periodLabel="October2026" locale={locale} t={t} />);
    expect(screen.getByText(dictionary['finance.flags.reviewNeeded'])).toBeTruthy();
    expect(screen.getByText(`${dictionary['finance.flags.late']}: 5`)).toBeTruthy();
    expect(screen.getByText(dictionary['finance.period.month'])).toBeTruthy();
});
