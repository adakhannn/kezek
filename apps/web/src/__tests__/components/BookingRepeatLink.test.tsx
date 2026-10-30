/** @jest-environment jsdom */
import {render,screen} from '@testing-library/react';
import BookingCard from '@/app/cabinet/components/BookingCard';
jest.mock('@/app/_components/i18n/LanguageProvider',()=>({useLanguage:()=>({locale:'ru',t:(_key:string,fallback?:string)=>fallback})}));
jest.mock('@/app/cabinet/components/MapDialog',()=>({__esModule:true,default:()=>null}));
jest.mock('@/app/cabinet/components/ReviewDialog',()=>({__esModule:true,default:()=>null}));
test('repeat is a direct booking link with visit selection and no expired date/time',()=>{
 render(<BookingCard bookingId="old" status="cancelled" start_at="2020-01-01T03:00:00Z" end_at="2020-01-01T04:01:00Z" service={{id:'service1',name_ru:'Test',duration_min:60}} servicesList={[{id:'service1',name_ru:'Test',duration_min:60},{id:'service2',name_ru:'Second',duration_min:1}]} staff={{id:'staff1',full_name:'Test'}} branch={{id:'branch1',name:'Test',lat:null,lon:null,address:null}} business={{id:'biz1',name:'Test',slug:'test-business'}} canCancel={false}/>);
 const url=new URL(screen.getByRole('link',{name:'Повторить'}).getAttribute('href')!,'http://localhost');
 expect(url.pathname).toBe('/b/test-business/booking');
 expect(url.searchParams.get('branch')).toBe('branch1');
 expect(url.searchParams.get('staff')).toBe('staff1');
 expect(url.searchParams.getAll('service')).toEqual(['service1','service2']);
 expect(url.searchParams.get('day')).toBeNull();
 expect(url.searchParams.get('time')).toBeNull();
});
