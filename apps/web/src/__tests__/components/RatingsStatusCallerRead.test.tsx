import { renderToStaticMarkup } from 'react-dom/server';
import RatingsStatusPage from '@/app/admin/ratings-status/page';
import { readRatingsJobsForCaller, readRatingsStatusForCaller } from '@/lib/ratingsAdminReadService';
jest.mock('@/lib/ratingsAdminReadService',()=>({readRatingsJobsForCaller:jest.fn(),readRatingsStatusForCaller:jest.fn()}));
jest.mock('@/app/_components/i18n/server',()=>({getT:async()=> (_key:string,fallback:string)=>fallback}));
jest.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error('redirect:'+url);}}));
describe('Ratings status server request-context read',()=>{
  const savedFetch=global.fetch;
  const data={staff_last_metric_date:null,branch_last_metric_date:null,biz_last_metric_date:null,staff_without_rating:1,branches_without_rating:4,businesses_without_rating:3,recent_errors_total:0,recent_errors_days:7,has_recent_errors:false};
  beforeEach(()=>{jest.clearAllMocks();global.fetch=jest.fn(async()=>{throw new TypeError('Failed to parse URL');}) as unknown as typeof fetch;(readRatingsStatusForCaller as jest.Mock).mockResolvedValue({ok:true,data});(readRatingsJobsForCaller as jest.Mock).mockResolvedValue({ok:true,data:{jobs:[]}});});
  afterEach(()=>{global.fetch=savedFetch;});
  test('renders status from shared read without self HTTP',async()=>{
    const html=renderToStaticMarkup(await RatingsStatusPage());expect(html).toContain('Здоровье рейтинговой системы');expect(html).toContain('Метрики сотрудников');expect(global.fetch).not.toHaveBeenCalled();
  });
  test('renders existing job history without invoking or creating jobs',async()=>{
    (readRatingsJobsForCaller as jest.Mock).mockResolvedValue({ok:true,data:{jobs:[{id:'history-job-id',created_at:'2026-10-20T00:00:00Z',date_from:'2026-10-01',date_to:'2026-10-02',scope:'all',status:'success',processed_days:2,total_days:2,error_message:null}]}});
    const html=renderToStaticMarkup(await RatingsStatusPage());expect(html).toContain('Задачи пересчёта рейтингов');expect(html).toContain('2/2');expect(global.fetch).not.toHaveBeenCalled();
  });
  test.each(['status','jobs'])('redirects when %s read denies the caller',async side=>{
    ((side==='status'?readRatingsStatusForCaller:readRatingsJobsForCaller) as jest.Mock).mockResolvedValue({ok:false,status:403,error:'forbidden'});
    await expect(RatingsStatusPage()).rejects.toThrow('redirect:/auth/sign-in?redirect=/admin/ratings-status');
  });
  test('retains explicit status read error',async()=>{
    (readRatingsStatusForCaller as jest.Mock).mockResolvedValue({ok:false,status:500,error:'internal',message:'Status unavailable'});
    const html=renderToStaticMarkup(await RatingsStatusPage());expect(html).toContain('Ошибка статуса рейтингов');expect(html).not.toContain('Метрики сотрудников');
  });
  test('retains thrown read error as an error surface',async()=>{
    (readRatingsStatusForCaller as jest.Mock).mockRejectedValue(new Error('read failed'));
    expect(renderToStaticMarkup(await RatingsStatusPage())).toContain('Ошибка статуса рейтингов');
  });
});
