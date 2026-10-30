import {repeatBookingHref} from '@/lib/repeatBookingHref';
const base={slug:'test',branchId:'branch',staffId:'staff',serviceIds:['s1','s2']};
const parse=(data:Parameters<typeof repeatBookingHref>[0])=>new URL(repeatBookingHref(data),'http://localhost');
test('preserves ordered complex and context without old date/slot',()=>{
 const url=parse(base);
 expect(url.pathname).toBe('/b/test/booking');
 expect(url.searchParams.get('step')).toBe('4');
 expect(url.searchParams.getAll('service')).toEqual(['s1','s2']);
 expect(url.searchParams.has('day')).toBe(false);
 expect(url.searchParams.has('slot')).toBe(false);
});
test.each([{branchId:null},{staffId:null},{serviceIds:[]}])('incomplete context starts selection rather than skips required step: %j',partial=>{
 expect(parse({...base,...partial}).searchParams.get('step')).toBe('1');
});
test('deduplicates identifiers, keeps single service and safely encodes path',()=>{
 const url=parse({...base,slug:'test/other',serviceIds:['s1','','s1']});
 expect(url.pathname).toBe('/b/test%2Fother/booking');
 expect(url.searchParams.getAll('service')).toEqual(['s1']);
});
