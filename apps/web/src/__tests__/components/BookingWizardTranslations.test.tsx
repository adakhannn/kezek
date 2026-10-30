/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { BookingSteps } from '@/app/b/[slug]/components/BookingSteps';
import { BookingSummary } from '@/app/b/[slug]/components/BookingSummary';
import { SlotPicker } from '@/app/b/[slug]/components/SlotPicker';
import { StaffSelector } from '@/app/b/[slug]/components/StaffSelector';
import { ServiceSelector } from '@/app/b/[slug]/components/ServiceSelector';
import { BranchSelector } from '@/app/b/[slug]/components/BranchSelector';
import { BookingDateCalendar } from '@/app/b/[slug]/components/BookingDateCalendar';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

test.each([
    ['ru', ru, 'На эту дату нет доступных специалистов'],
    ['en', en, 'No specialists available on this date'],
    ['ky', ky, 'Бул күнү жеткиликтүү адистер жок'],
] as const)('localizes the actual off-day staff empty-state title in %s', (locale, dictionary, title) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({locale, t} as ReturnType<typeof useLanguage>);
    render(<StaffSelector staff={[]} selectedStaffId="staff-1" dayStr="2026-10-20" onSelect={jest.fn()} />);
    expect(screen.getByText(title, {exact:true})).toBeTruthy();
    expect(screen.getByText(dictionary['booking.empty.noStaff'], {exact:true})).toBeTruthy();
    expect(screen.queryByTestId('master-card')).toBeNull();
    expect(screen.queryByTestId('master-card-any')).toBeNull();
});

test.each([['ru', ru], ['en', en], ['ky', ky]] as const)('localizes first two steps and calendar static labels in %s', (locale, dictionary) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    for (const key of [
        'booking.flow.step1Title', 'booking.flow.step1Description', 'booking.flow.step1Next',
        'booking.flow.step2Title', 'booking.flow.step2Description', 'booking.flow.step2Next',
        'booking.step1.kicker', 'booking.step1.description', 'booking.step1.availableBranch',
        'booking.step1.selectedBranch', 'booking.step2.kicker', 'booking.step2.description',
        'datePicker.calendarLabel', 'datePicker.chooseDate', 'datePicker.legend.selected', 'datePicker.legend.disabled',
    ]) expect(dictionary[key]).toEqual(expect.any(String));
    render(<>
        <BranchSelector branches={[
            { id: 'branch-1', name: 'Fixture one', rating_score: null },
            { id: 'branch-2', name: 'Fixture two', rating_score: null },
        ]} selectedBranchId="branch-2" onSelect={jest.fn()} formatBranchName={name => name} t={t} />
        <BookingDateCalendar value={new Date('2026-10-18T18:00:00Z')} min={new Date('2026-10-14T18:00:00Z')}
            max={new Date('2026-12-14T18:00:00Z')} timezone="Asia/Bishkek" onChange={jest.fn()} />
    </>);
    expect(screen.getByRole('button', { name: `Fixture one: ${t('booking.step1.availableBranch')}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Fixture two: ${t('booking.step1.selectedBranch')}` }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: t('datePicker.calendarLabel') })).toBeTruthy();
    for (const key of ['datePicker.chooseDate', 'datePicker.legend.selected', 'datePicker.legend.disabled']) {
        expect(screen.getByText(t(key), { exact: true })).toBeTruthy();
    }
});

test.each(['ru', 'en', 'ky'] as const)('localizes branch counter template for zero, one and many in %s', locale => {
    const dictionary = { ru, en, ky }[locale];
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    const template = dictionary['booking.step1.branchesCount'];
    expect(template).toEqual(expect.any(String));
    for (const count of [0, 1, 2, 5, 21]) {
        const view = render(<BranchSelector branches={Array.from({ length: count }, (_, i) => ({
            id: `branch-${i}`, name: `Branch ${i}`, rating_score: null,
        }))} selectedBranchId="" onSelect={jest.fn()} formatBranchName={name => name} t={t} />);
        expect(screen.getByText(template.replace('{count}', String(count)), { exact: true })).toBeTruthy();
        view.unmount();
    }
});

test.each([['ru', ru], ['en', en], ['ky', ky]] as const)('localizes selected and available selector states and step3/4 guidance in %s', (locale, dictionary) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    for (const key of [
        'booking.flow.step3Title', 'booking.flow.step3Description', 'booking.flow.step3Next',
        'booking.flow.step4Title', 'booking.flow.step4Description', 'booking.flow.step4Next',
        'booking.step3.kicker', 'booking.step4.kicker', 'booking.step4.selectedSummary',
        'booking.nav.ready', 'booking.summary.pending',
    ]) expect(dictionary[key]).toBeTruthy();
    render(<>
        <StaffSelector staff={[
            { id:'staff-1', full_name:'First', branch_id:'branch', rating_score:null },
            { id:'staff-2', full_name:'Second', branch_id:'branch', rating_score:null },
        ]} selectedStaffId="staff-1" dayStr="2026-10-19" onSelect={jest.fn()} />
        <ServiceSelector services={[
            { id:'service-1', branch_id:'branch', name_ru:'First service', duration_min:60, price_from:100, price_to:300 },
            { id:'service-2', branch_id:'branch', name_ru:'Second service', duration_min:30 },
        ]} selectedServiceIds={['service-1']} staffId="staff-1" onToggle={jest.fn()} />
    </>);
    for (const key of ['booking.step3.description', 'booking.step3.selectedMaster', 'booking.step3.availableMaster',
        'booking.step4.hint', 'booking.step4.selected', 'booking.step4.available', 'booking.step4.priceHint']) {
        expect(dictionary[key]).toBeTruthy();
        expect(screen.getAllByText(dictionary[key], { exact:true }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name:`First: ${dictionary['booking.step3.selectedMaster']}` })).toBeTruthy();
    expect(screen.getByRole('button', { name:`Second service: ${dictionary['booking.step4.available']}` })).toBeTruthy();
    expect(screen.getByText(new RegExp(`${dictionary['booking.step4.total']}.*60`))).toBeTruthy();
});

test.each([['ru', ru], ['en', en], ['ky', ky]] as const)('localizes common booking wizard navigation and interpolated summary in %s', (locale, dictionary) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    render(<>
        <BookingSteps stepsMeta={[{id: 1, label: 'Branch'}, {id: 5, label: 'Time'}]} step={5}
            totalSteps={5} canGoNext={false} goToStep={jest.fn()} stepIndicatorText="Localized 5/5" />
        <BookingSummary branchName="Test branch" dayLabel="12 Oct" staffCurrent={null} serviceCurrent={null}
            servicesSelected={[{id: 'service', branch_id: 'branch', name_ru: 'Service', duration_min: 60, price_from: 100, price_to: 300}]}
            branchId="branch" branchPromotions={[]} isAuthed={false} step={5} />
    </>);
    expect(screen.getByRole('button', {name: t('booking.steps.backLabel').replace('{step}', '1').replace('{label}', 'Branch')})).toBeTruthy();
    expect(screen.getByText(t('booking.steps.current'))).toBeTruthy();
    expect(screen.getByText(t('booking.summary.selectedCount').replace('{count}', '1'))).toBeTruthy();
    expect(screen.getByText(t('booking.summary.step').replace('{step}', '5'))).toBeTruthy();
    expect(screen.getByText(t('booking.summary.authTitle'))).toBeTruthy();
    if (locale !== 'ru') {
        expect(screen.queryByText('Итого')).toBeNull();
        expect(screen.queryByText('1 выбрано')).toBeNull();
    }
    expect(screen.queryByText(/\{count\}|\{step\}|\{label\}/)).toBeNull();
});

test.each([
    ['ru', ru, 'Финальный шаг'],
    ['en', en, 'Final step'],
    ['ky', ky, 'Акыркы кадам'],
] as const)('localizes authenticated slot guidance with one date separator in %s', (locale, dictionary, finalTitle) => {
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    render(<>
        <SlotPicker slots={[]} selectedSlot={null} onSelect={jest.fn()} loading error={null}
            dayStr="2026-10-19" dayLabel="19 Oct" staffId="staff" staff={[]} serviceId="service"
            servicesFiltered={[{ id: 'service' }]} serviceStaff={[]} isAuthed clientBookingsCount={0}
            clientBookingsLoading={false} bookingLoading={false} />
        <BookingSummary branchName="Test branch" dayLabel="19 Oct" staffCurrent={null} serviceCurrent={null}
            servicesSelected={[]} branchId="branch" branchPromotions={[]} isAuthed step={5} />
    </>);
    expect(screen.getByText(`${dictionary['booking.step5.selectedDate']} 19 Oct`, { exact: true })).toBeTruthy();
    expect(screen.getByText(finalTitle, { exact: true })).toBeTruthy();
    expect(dictionary['booking.loadingSlotsHint']).toBeTruthy();
    expect(screen.getByText(dictionary['booking.loadingSlotsHint'], { exact: true })).toBeTruthy();
    expect(screen.queryByText(/:\s*:/)).toBeNull();
});
