/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import MapPageClient from '@/app/map/MapPageClient';
import { branchBookingHref } from '@/app/map/branchBookingHref';

jest.mock('@/app/_components/i18n/LanguageProvider',()=>({useLanguage:()=>({t:(_key:string,fallback:string)=>fallback})}));
jest.mock('@/lib/yamaps',()=>({loadYandexMaps:async()=>({
    Map:class { geoObjects={add:jest.fn(),removeAll:jest.fn()};controls={add:jest.fn()};setCenter=jest.fn();destroy=jest.fn(); },
    control:{ZoomControl:class{}},
})}));

it('keeps each branch identity in list and selected-card booking links', async () => {
    global.fetch = jest.fn().mockResolvedValue({json:async()=>({ok:true,data:[
        {id:'branch-1',businessId:'biz',businessName:'Business',businessSlug:'test-biz',branchName:'Branch One',address:'Street One',lat:40,lon:72,categoryId:'salon',categoryName:'Salon'},
        {id:'branch-2',businessId:'biz',businessName:'Business',businessSlug:'test-biz',branchName:'Branch Two',address:'Street Two',lat:40,lon:72,categoryId:'salon',categoryName:'Salon'},
    ]})});
    render(<MapPageClient />);
    const listLinks = await screen.findAllByRole('link',{name:'Записаться'});
    expect(listLinks.map(link=>link.getAttribute('href'))).toEqual([
        '/b/test-biz/booking?branch=branch-1','/b/test-biz/booking?branch=branch-2',
    ]);
    fireEvent.click(screen.getByRole('button',{name:/2 Branch Two/}));
    const selectedLinks = screen.getAllByRole('link',{name:'Записаться'});
    expect(selectedLinks[selectedLinks.length-1].getAttribute('href')).toBe('/b/test-biz/booking?branch=branch-2');
});

it('encodes a business path separately from branch query identity', () => {
    expect(branchBookingHref('business / test','branch&x=1')).toBe('/b/business%20%2F%20test/booking?branch=branch%26x%3D1');
});
