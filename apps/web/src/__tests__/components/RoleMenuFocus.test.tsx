/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { RoleAndBusinessSwitcher } from '@/app/_components/RoleAndBusinessSwitcher';

jest.mock('next/navigation', () => ({ usePathname: () => '/cabinet/bookings' }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: {
    auth: {
        getSession: jest.fn(async () => ({data:{session:{user:{id:'fixture-client'}}}})),
        onAuthStateChange: jest.fn(() => ({data:{subscription:{unsubscribe:jest.fn()}}})),
    },
    rpc: jest.fn(async (name:string) => ({data:name==='is_super_admin'?false:[]})),
} }));

describe.each([['ru',ru],['en',en],['ky',ky]] as const)('cabinet menu focus %s', (locale,dictionary) => {
    let savedFetch:typeof fetch;
    beforeEach(() => {
        savedFetch=global.fetch;
        global.fetch=jest.fn(async () => ({ok:true,json:async()=>({ok:true,data:{businesses:[]}})})) as jest.Mock;
        jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string,fallback?:string)=>dictionary[key]??fallback??key} as ReturnType<typeof useLanguage>);
    });
    afterEach(() => {global.fetch=savedFetch;});

    async function openMenu() {
        render(<><RoleAndBusinessSwitcher /><input aria-label="Outside fixture" /></>);
        const trigger=await screen.findByRole('button',{name:dictionary['header.myBookings'],exact:true});
        trigger.focus(); fireEvent.click(trigger);
        return {trigger,item:screen.getByRole('menuitem',{name:dictionary['header.myBookings'],exact:true}),outside:screen.getByRole('textbox',{name:'Outside fixture'})};
    }

    it('returns focus to the original trigger when Escape closes from its menu item', async () => {
        const {trigger,item}=await openMenu();
        item.focus(); fireEvent.keyDown(item,{key:'Escape'});
        expect(screen.queryByRole('menu')).toBeNull();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger);
    });

    it('does not steal focus on an outside pointer dismissal', async () => {
        const {outside}=await openMenu();
        outside.focus(); fireEvent.mouseDown(outside);
        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(outside);
    });

    it('does not steal focus when Escape is pressed after focus already left the menu', async () => {
        const {outside}=await openMenu();
        outside.focus(); fireEvent.keyDown(outside,{key:'Escape'});
        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(outside);
    });
});
