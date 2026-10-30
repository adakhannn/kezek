/** @jest-environment jsdom */

import { act, render, renderHook, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BookingFormSections } from '@/app/b/[slug]/components/BookingFormSections';
import { useBookingSteps } from '@/app/b/[slug]/hooks/useBookingSteps';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/b/[slug]/components/BookingDateCalendar', () => ({ BookingDateCalendar: () => null }));
jest.mock('@/app/b/[slug]/components/BookingSummary', () => ({ BookingSummary: () => null }));
jest.mock('@/app/b/[slug]/components/SlotPicker', () => ({ SlotPicker: () => null }));

it.each([
    ['2026-10-15', 2, false], ['2026-12-16', 2, false],
    ['2026-10-16', 2, true], ['2026-12-15', 2, true],
    ['2026-10-15', 3, false], ['2026-12-16', 4, false],
    ['2026-10-15', 1, true], ['', 2, false],
] as const)('enforces business-calendar bounds for %s at step %s', (dayStr, initialStep, allowed) => {
    const params = {
        branchId:'branch', dayStr, minDayStr:'2026-10-16', maxDayStr:'2026-12-15',
        staffId:'staff', staffAvailable:true, serviceIds:['service'],
        servicesFiltered:[{id:'service',branch_id:'branch',name_ru:'Fixture',duration_min:60}],
        t:(_key:string, fallback?:string) => fallback ?? _key, initialStep,
    };
    const { result } = renderHook(() => useBookingSteps(params));
    expect(result.current.canGoNext).toBe(allowed);
    act(() => result.current.goNext());
    expect(result.current.step).toBe(allowed ? initialStep + 1 : initialStep);
});

it.each([
    ['ru', ru, 'Выберите доступный день в календаре. Дата из ссылки или сохранённого выбора уже недоступна.'],
    ['en', en, 'Choose an available day in the calendar. The date from the link or saved selection is no longer available.'],
    ['ky', ky, 'Календардан жеткиликтүү күндү тандаңыз. Шилтемедеги же сакталган тандоодогу күн эми жеткиликсиз.'],
] as const)('explains an out-of-range restored day in %s', (locale, dictionary, message) => {
    const t = (key:string, fallback?:string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({locale,t} as ReturnType<typeof useLanguage>);
    const props:ComponentProps<typeof BookingFormSections> & {dayInRange:boolean} = {
        bizId:'biz',branchId:'branch',branches:[],branchPromotions:[],businessTz:'Asia/Bishkek',
        canGoNext:false,canGoPrev:true,dayInRange:false,clientBookingsCount:0,clientBookingsLoading:false,
        createBooking:jest.fn(),day:new Date('2026-10-14T18:00:00Z'),dayStr:'2026-10-15',dayLabel:'15.10.2026',
        formatBranchName:x=>x,goNext:jest.fn(),goPrev:jest.fn(),isAuthed:true,bookingLoading:false,
        serviceCurrent:null,serviceId:'',serviceIds:[],serviceStaff:[],servicesFiltered:[],selectedServicesForStep4:[],
        slots:[],slotsError:null,slotsLoading:false,staff:[],staffCurrent:null,staffFiltered:[],staffId:'',
        step:2,t,totalDurationStep4:0,totalPriceFromStep4:0,totalPriceToStep4:0,totalSteps:5,
        onBranchSelect:jest.fn(),onDayChange:jest.fn(),onServiceToggle:jest.fn(),onSlotSelect:jest.fn(),onStaffSelect:jest.fn(),onRetrySlots:jest.fn(),
    };
    render(<BookingFormSections {...props} />);
    expect(screen.getByText(message,{exact:true})).toBeTruthy();
    expect((screen.getByRole('button',{name:dictionary['booking.nav.next'],exact:true}) as HTMLButtonElement).disabled).toBe(true);
});
