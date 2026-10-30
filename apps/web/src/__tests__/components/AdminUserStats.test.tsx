/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import UsersClient from '@/app/admin/users/UsersClient';
const router={push:jest.fn()};
jest.mock('next/navigation',()=>({useRouter:()=>router,useSearchParams:()=>new URLSearchParams()}));
jest.mock('@/app/_components/i18n/LanguageProvider',()=>({useLanguage:()=>({t:()=> 'Статистика недоступна'})}));
const props={initialUsers:[],initialPage:1,initialPerPage:50,initialTotal:0,initialSearch:'',initialStatus:'all'};
it('does not present unavailable statistics as zero while retaining list controls',()=>{
    const {container}=render(<UsersClient {...props} stats={null}/>);
    expect(screen.getByRole('status').textContent).toBe('Статистика недоступна');
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(container.textContent).not.toContain('Super Admin0');
});
it('renders successful global counts independent of a currently empty filtered list',()=>{
    render(<UsersClient {...props} stats={{total:7,active:7,blocked:0,super:1}}/>);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByText('7')).toHaveLength(2);
    expect(screen.getByText('1')).toBeTruthy();
});
