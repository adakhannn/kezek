import { renderToStaticMarkup } from 'react-dom/server';
import HealthCheckPage from '@/app/admin/health-check/page';
import { readAdminHealthCheckForCaller } from '@/lib/adminHealthCheckReadService';

jest.mock('@/lib/adminHealthCheckReadService',()=>({readAdminHealthCheckForCaller:jest.fn()}));
jest.mock('@/app/_components/i18n/server',()=>({getT:async()=> (_key:string,fallback:string)=>fallback}));
jest.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error('redirect:'+url);}}));

describe('HealthCheck server page uses authorized request read, not self HTTP',()=>{
  const originalFetch=global.fetch;
  const report={ok:true,alerts:[],checks:{shifts:{ok:true,openShiftsOlderThan2Days:0,lastCheckDate:'2026-10-20'},ratings:{ok:true,staffLastMetricDate:null,branchLastMetricDate:null,bizLastMetricDate:null,daysSinceLastMetric:1},promotions:{ok:true,activePromotionsCount:0,lastAppliedDate:null,daysSinceLastApplication:null}}};
  beforeEach(()=>{jest.clearAllMocks();global.fetch=jest.fn(async()=>({status:401,json:async()=>({ok:false,error:'auth'})})) as unknown as typeof fetch;});
  afterEach(()=>{global.fetch=originalFetch;});
  test('renders successful read directly with no credential forwarding or internal HTTP',async()=>{
    (readAdminHealthCheckForCaller as jest.Mock).mockResolvedValue({ok:true,data:report});
    const html=renderToStaticMarkup(await HealthCheckPage());
    expect(html).toContain('Health Check системы');expect(html).toContain('Система здорова');
    expect(readAdminHealthCheckForCaller).toHaveBeenCalledTimes(1);expect(global.fetch).not.toHaveBeenCalled();
  });
  test('renders degraded report as report, not auth failure',async()=>{
    (readAdminHealthCheckForCaller as jest.Mock).mockResolvedValue({ok:true,data:{...report,ok:false,alerts:[{type:'warning',message:'Existing data requires attention',details:{count:1}}]}});
    const html=renderToStaticMarkup(await HealthCheckPage());
    expect(html).toContain('Обнаружены проблемы');expect(html).toContain('Existing data requires attention');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test.each([401,403])('keeps denied caller redirect for %s',async statusCode=>{
    (readAdminHealthCheckForCaller as jest.Mock).mockResolvedValue({ok:false,statusCode,errorType:'auth',message:'Denied'});
    await expect(HealthCheckPage()).rejects.toThrow('redirect:/auth/sign-in?redirect=/admin/health-check');
    expect(readAdminHealthCheckForCaller).toHaveBeenCalledTimes(1);
  });
  test.each([400,500])('renders read failure inline for %s, never as a healthy report',async statusCode=>{
    (readAdminHealthCheckForCaller as jest.Mock).mockResolvedValue({ok:false,statusCode,errorType:'internal',message:'Read unavailable'});
    const html=renderToStaticMarkup(await HealthCheckPage());
    expect(html).toContain('Ошибка health check');expect(html).toContain('Read unavailable');expect(html).not.toContain('Система здорова');
  });
});
