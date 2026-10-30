/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import StaffSchedulePage from '@/app/staff/schedule/page';
import { StaffMobileSidebar } from '@/app/staff/components/StaffMobileSidebar';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { staffRu } from '@/app/_components/i18n/dictionaries/staff.ru';
import { staffKy } from '@/app/_components/i18n/dictionaries/staff.ky';
import { staffEn } from '@/app/_components/i18n/dictionaries/staff.en';

jest.mock('next/navigation', () => ({usePathname: () => '/staff/schedule', notFound: jest.fn()}));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage:jest.fn()}));
jest.mock('@/lib/scheduling/config', () => ({explicitSchedulingEnabled: () => true}));
jest.mock('@/lib/authBiz', () => ({getStaffContext: async () => ({staffId:'staff-test',bizId:'biz-test',branchId:'branch-test',supabase:{from: (table:string) => {
    const query = {select:jest.fn(),eq:jest.fn(),maybeSingle:async () => ({data:{id:'staff-test',biz_id:'biz-test',branch_id:'branch-test'}}),order:async () => ({data:[{id:'branch-test',name:'LIVE TEST',is_active:true}]})};
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    if (!['staff','branches'].includes(table)) throw new Error('Unexpected table');
    return query;
}}})}));
jest.mock('@/components/scheduling/ScheduleCalendar', () => ({__esModule:true,default:({endpoint,branches}:{endpoint:string;branches:{name:string}[]}) => <p>{endpoint} {branches[0]?.name}</p>}));
jest.mock('@/app/_components/workspace/WorkspaceNavigation', () => ({WorkspaceSidebarShell:({badge,navTitle,items}:{badge:string;navTitle:string;items:{href:string;label:string}[]}) => <aside><p>{badge}</p><p>{navTitle}</p>{items.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</aside>}));

const cases = [
    ['ru',staffRu,'Кабинет сотрудника','Разделы кабинета','Расписание','Финансы'],
    ['ky',staffKy,'Кызматкердин кабинети','Кабинеттин бөлүмдөрү','График','Каржы'],
    ['en',staffEn,'Staff workspace','Workspace sections','Schedule','Finance'],
] as const;

test.each(cases)('localizes staff workspace sidebar in %s', (locale,dictionary,badge,sections,schedule,finance) => {
    jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string,fallback?:string)=>(dictionary as Record<string,string>)[key]??fallback??key} as ReturnType<typeof useLanguage>);
    render(<StaffMobileSidebar staffId="staff-test"/>);
    expect(screen.getByText(badge)).toBeTruthy();
    expect(screen.getByText(sections)).toBeTruthy();
    expect(screen.getByRole('link',{name:schedule}).getAttribute('href')).toBe('/staff/schedule');
    expect(screen.getByRole('link',{name:finance}).getAttribute('href')).toBe('/staff/finance');
});

test.each(cases)('localizes deployed explicit schedule heading in %s', async (locale,dictionary) => {
    jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string,fallback?:string)=>(dictionary as Record<string,string>)[key]??fallback??key} as ReturnType<typeof useLanguage>);
    render(await StaffSchedulePage());
    expect(screen.getByRole('heading',{level:1,name:dictionary['staff.schedule.title']})).toBeTruthy();
    expect(screen.getByText('/api/staff/me/schedule LIVE TEST')).toBeTruthy();
});
