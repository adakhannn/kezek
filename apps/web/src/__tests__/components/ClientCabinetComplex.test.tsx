/** @jest-environment jsdom */
import {fireEvent,render,screen} from '@testing-library/react';
import ClientCabinet from '@/app/cabinet/ClientCabinet';
jest.mock('@/app/_components/i18n/LanguageProvider',()=>({useLanguage:()=>({locale:'ru',t:(_key:string,fallback?:string)=>fallback??_key})}));
jest.mock('@/app/cabinet/components/MyVisitPackagesBlock',()=>({__esModule:true,default:()=>null}));
jest.mock('@/app/cabinet/components/MapDialog',()=>({__esModule:true,default:()=>null}));
jest.mock('@/app/cabinet/components/ReviewDialog',()=>({__esModule:true,default:()=>null}));
test('past cabinet uses all historical services and snapshotted duration for repeat',()=>{
 const primary={id:'s1',name_ru:'First',duration_min:90};
 const booking={id:'old',status:'cancelled' as const,start_at:'2020-01-01T03:00:00Z',end_at:'2020-01-01T04:01:00Z',services:primary,booking_services:[{duration_min:60,service:primary},{duration_min:1,service:{id:'s2',name_ru:'Second',duration_min:5}}],businesses:{id:'biz',name:'Test',slug:'test'},branches:{id:'branch',name:'Test',lat:null,lon:null,address:null},staff:{id:'staff',full_name:'Test'}};
 render(<ClientCabinet userId="owner-as-client" upcoming={[]} past={[booking]}/>);
 fireEvent.click(screen.getAllByRole('tab')[1]);
 expect(screen.getByText('Second')).toBeTruthy();
 expect(screen.getByText('61 мин')).toBeTruthy();
 const href=screen.getByRole('link',{name:'Повторить'}).getAttribute('href')!;
 expect(new URL(href,'http://localhost').searchParams.getAll('service')).toEqual(['s1','s2']);
});
