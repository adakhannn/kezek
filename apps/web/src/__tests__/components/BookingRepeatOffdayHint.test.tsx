/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BookingFormSections } from '@/app/b/[slug]/components/BookingFormSections';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/b/[slug]/components/BookingDateCalendar', () => ({ BookingDateCalendar: () => null }));
jest.mock('@/app/b/[slug]/components/BookingSummary', () => ({ BookingSummary: () => null }));
jest.mock('@/app/b/[slug]/components/SlotPicker', () => ({ SlotPicker: () => null }));

const service = { id:'service', branch_id:'branch', name_ru:'Fixture service', duration_min:60, price_from:100, price_to:300 };
const member = { id:'staff', branch_id:'branch', full_name:'Fixture staff', rating_score:null };

describe.each([['ru',ru],['en',en],['ky',ky]] as const)('restored service-step off-day guidance %s', (locale,dictionary) => {
    const t = (key:string, fallback?:string) => dictionary[key] ?? fallback ?? key;
    beforeEach(() => jest.mocked(useLanguage).mockReturnValue({locale,t} as ReturnType<typeof useLanguage>));

    function show(overrides:Partial<ComponentProps<typeof BookingFormSections>> = {}) {
        const props:ComponentProps<typeof BookingFormSections> = {
            bizId:'biz', branchId:'branch', branches:[], branchPromotions:[], businessTz:'Asia/Bishkek',
            canGoNext:false, canGoPrev:true, clientBookingsCount:5, clientBookingsLoading:false,
            createBooking:jest.fn(), day:new Date('2026-10-15T03:00:00Z'), dayLabel:'15Oct', dayStr:'2026-10-15',
            formatBranchName:x=>x, goNext:jest.fn(), goPrev:jest.fn(), isAuthed:true, bookingLoading:false,
            serviceCurrent:service, serviceId:'service', serviceIds:['service'], serviceStaff:[], servicesFiltered:[service],
            selectedServicesForStep4:[service], slots:[], slotsError:null, slotsLoading:false,
            staff:[member], staffCurrent:member, staffFiltered:[], staffLoading:false, staffError:false, staffId:'staff',
            step:4, t, totalDurationStep4:60, totalPriceFromStep4:100, totalPriceToStep4:300, totalSteps:5,
            onBranchSelect:jest.fn(), onDayChange:jest.fn(), onServiceToggle:jest.fn(), onSlotSelect:jest.fn(),
            onStaffSelect:jest.fn(), onRetrySlots:jest.fn(), ...overrides,
        };
        render(<BookingFormSections {...props} />);
    }

    it('explains the authoritative empty day instead of asking to finish selected services', () => {
        show();
        expect(screen.getByText(dictionary['booking.empty.noStaffTitle'],{exact:true})).toBeTruthy();
        expect(screen.getByText(dictionary['booking.empty.noStaff'],{exact:true})).toBeTruthy();
        expect((screen.getByRole('button',{name:dictionary['booking.nav.next'],exact:true}) as HTMLButtonElement).disabled).toBe(true);
    });

    it('preserves ready guidance when the restored staff is available', () => {
        show({staffFiltered:[member],canGoNext:true});
        expect(screen.getByText(dictionary['booking.nav.ready'],{exact:true})).toBeTruthy();
        expect(screen.queryByText(dictionary['booking.empty.noStaffTitle'],{exact:true})).toBeNull();
    });

    it.each([{staffLoading:true},{staffError:true}])('does not treat unresolved/error availability as an empty day: %j', flags => {
        show(flags);
        expect(screen.queryByText(dictionary['booking.empty.noStaffTitle'],{exact:true})).toBeNull();
        expect(screen.getByText(dictionary['booking.nav.pendingHint'],{exact:true})).toBeTruthy();
    });
});
