import {cabinetBookingServices} from '@/lib/cabinetBookingServices';
const s={id:'s1',name_ru:'Test',duration_min:90};
test('prefers historical visit duration and every service, without mutating catalog',()=>{
 expect(cabinetBookingServices({services:s,booking_services:[{duration_min:60,service:s},{duration_min:1,service:[{...s,id:'s2'}]}]})).toEqual([{...s,duration_min:60},{...s,id:'s2',duration_min:1}]);
 expect(s.duration_min).toBe(90);
});
test('keeps explicit zero snapshot and falls back only missing duration',()=>{
 expect(cabinetBookingServices({booking_services:[{duration_min:0,service:s},{duration_min:null,service:s}]}).map(row=>row.duration_min)).toEqual([0,90]);
});
test.each([undefined,null,[]])('legacy single and array relations remain supported %j',booking_services=>{
 expect(cabinetBookingServices({services:s,booking_services})).toEqual([s]);
 expect(cabinetBookingServices({services:[s],booking_services})).toEqual([s]);
});
test('missing joins and no visit/catalog are safe',()=>{
 expect(cabinetBookingServices({booking_services:[{duration_min:1,service:null},{duration_min:1,service:[]}]})).toEqual([]);
 expect(cabinetBookingServices({services:null})).toEqual([]);
});
