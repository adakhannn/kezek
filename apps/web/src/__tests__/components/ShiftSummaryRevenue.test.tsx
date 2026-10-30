/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ShiftSummary } from '@/app/staff/finance/components/ShiftSummary';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import { staffKy } from '@/app/_components/i18n/dictionaries/staff.ky';
import { staffEn } from '@/app/_components/i18n/dictionaries/staff.en';
import type { Shift } from '@/app/staff/finance/types';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage:jest.fn()}));
const shift:Shift={id:'test-shift',shift_date:'2026-10-12',opened_at:'2026-10-12T05:00:00Z',closed_at:null,
    expected_start:null,late_minutes:0,status:'open',total_amount:251,consumables_amount:49,
    master_share:151,salon_share:149,percent_master:60,percent_salon:40};

test.each([
    ['ru',{...financeRu,...staffRu},'Сводка по смене','Экспорт'],
    ['ky',{...financeKy,...staffKy},'Сменанын жыйынтыгы','Экспорт'],
    ['en',{...financeEn,...staffEn},'Shift summary','Export'],
] as const)(
    'identifies full receipt and both components in %s without changing payout shares', (locale,dictionary,title,exportLabel) => {
        jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string,fallback?:string) =>
            (dictionary as Record<string,string>)[key] ?? fallback ?? key} as ReturnType<typeof useLanguage>);
        render(<ShiftSummary calculations={{totalAmount:251,totalConsumables:49,displayTotalAmount:251,masterShare:151,salonShare:149}}
            shift={shift} isOpen hourlyRate={null} currentHoursWorked={null} currentGuaranteedAmount={null}
            items={[]} shiftDate={new Date('2026-10-12T06:00:00Z')} />);
        expect(screen.getByText(dictionary['finance.totalWithConsumables'])).toBeTruthy();
        expect(screen.getByRole('heading',{name:title,exact:true})).toBeTruthy();
        expect(screen.getByRole('button',{name:exportLabel,exact:true})).toBeTruthy();
        expect(screen.getByText('300')).toBeTruthy();
        const currency = dictionary['staff.finance.shift.som'];
        expect(screen.getByText(`${dictionary['finance.servicesRevenue']}: 251 ${currency} · ${dictionary['finance.consumablesRevenue']}: 49 ${currency}`)).toBeTruthy();
        expect(screen.getByText('151')).toBeTruthy();
        expect(screen.getByText('149')).toBeTruthy();
    },
);
