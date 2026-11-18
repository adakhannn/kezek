/** @jest-environment jsdom */
import {render,screen} from '@testing-library/react';
import BookingPage from '@/app/booking/[id]/page';
const rpc=jest.fn();
const maybeSingle=jest.fn();
jest.mock('@supabase/ssr',()=>({createServerClient:()=>({
    from:()=>({select:()=>({eq:()=>({maybeSingle})})}),rpc,
})}));
jest.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
const mockLanguage={locale:'ru',t:(_key:string,fallback?:string)=>fallback??_key};
jest.mock('@/app/_components/i18n/LanguageProvider',()=>({LanguageProvider:({children}:{children:React.ReactNode})=>children,useLanguage:()=>mockLanguage}));
jest.mock('next/navigation',()=>({useRouter:()=>({refresh:jest.fn()})}));
jest.mock('@/app/booking/[id]/NotFoundMessage',()=>({__esModule:true,default:()=> <div>Receipt not found</div>}));
jest.mock('@/app/booking/[id]/BookingLayoutClient',()=>({__esModule:true,default:({services,status}:{services:{name_ru:string;duration_min:number}[];status:string})=><div>{status}{services?.map(s=><span key={s.name_ru}>{s.name_ru}:{s.duration_min}</span>)}</div>}));
beforeEach(()=>{rpc.mockReset();maybeSingle.mockReset();maybeSingle.mockResolvedValue({data:null});});
async function renderGuestReceipt(){
    const page=await BookingPage({params:Promise.resolve({id:'booking'})});
    const fallback=page as React.ReactElement<{id:string}>;
    render(await (fallback.type as (props:{id:string})=>Promise<React.ReactNode>)(fallback.props));
}
it('renders guest receipt composition from narrow public receipt RPC, not an admin client',async()=>{
    rpc.mockResolvedValue({data:[{id:'booking',status:'confirmed',start_at:'2026-10-12T03:00:00Z',staff_name:'Test',services:[{name_ru:'First',duration_min:60},{name_ru:'Second',duration_min:1}]}],error:null});
    await renderGuestReceipt();
    expect(rpc).toHaveBeenCalledWith('booking_receipt_public',{p_id:'booking'});
    expect(screen.getByText('First:60')).toBeTruthy();expect(screen.getByText('Second:1')).toBeTruthy();
});
it('keeps a missing receipt on the safe not-found surface',async()=>{
    rpc.mockResolvedValue({data:[],error:null});await renderGuestReceipt();
    expect(screen.getByText('Receipt not found')).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
});
// FE-08: an unavailable receipt is an error with a retry, not "not found" right after booking.
it('shows an unavailable receipt as a load error with a retry',async()=>{
    rpc.mockResolvedValue({data:null,error:{message:'Unavailable'}});
    const page=await BookingPage({params:Promise.resolve({id:'booking'})});
    const fallback=page as React.ReactElement<{id:string}>;
    const content=await (fallback.type as (props:{id:string})=>Promise<React.ReactElement>)(fallback.props);
    render(content);
    expect(screen.queryByText('Receipt not found')).toBeNull();
    expect(screen.getByRole('button',{name:'Повторить'})).toBeTruthy();
});
