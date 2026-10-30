import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { getServiceClient } from '@/lib/supabaseService';
jest.mock('@/lib/supabaseService', () => ({getServiceClient:jest.fn()}));
jest.mock('@/lib/log', () => ({logError:jest.fn()}));

const key = 'ade307ae-6c38-424b-a9ee-63a32316c702';
type Row = Record<string, unknown>;
function database(initial:Row[] = [], collisionError = false) {
    const rows = [...initial];
    const writes: Array<{table:string;action:string;data:unknown;filters:unknown}> = [];
    const db = {from:jest.fn((table:string) => {
        let fields = '', action = '', payload:Row = {};
        const filters:Array<(row:Row) => boolean> = [];
        const q = {
            select(value:string) {fields=value; return q;},
            eq(field:string,value:unknown) {filters.push(row => row[field]===value); return q;},
            in(field:string,values:unknown[]) {filters.push(row => values.includes(row[field]));return q;},
            update(value:Row) {action='update';payload=value;return q;},
            maybeSingle:async () => ({data:table==='staff' ? {percent_master:60,percent_salon:40}
                : {id:'shift-test',status:'open',shift_date:'2026-10-12'},error:null}),
            upsert:jest.fn(async (values:Row[],options:{ignoreDuplicates:boolean}) => {
                writes.push({table,action:'upsert',data:values,filters:options});
                for (const value of values) if (!rows.some(row => row.id===value.id)) rows.push({...value});
                return {error:null};
            }),
            insert:jest.fn(async (values:Row[]) => {
                writes.push({table,action:'insert',data:values,filters:[]});
                rows.push(...values);return {error:null};
            }),
            delete() {action='delete';return q;},
            then(resolve:(value:{data:Row[];error:unknown}) => unknown) {
                if (collisionError && fields==='id, shift_id') return Promise.resolve(resolve({data:[],error:{message:'offline'}}));
                const selected = rows.filter(row => filters.every(predicate => predicate(row)));
                if (action) {
                    writes.push({table,action,data:payload,filters});
                    if (action==='update' && table==='staff_shift_items') selected.forEach(row => Object.assign(row,payload));
                    if (action==='delete') selected.forEach(row => rows.splice(rows.indexOf(row),1));
                }
                return Promise.resolve(resolve({data:selected,error:null}));
            },
        };
        return q;
    })};
    jest.mocked(getServiceClient).mockReturnValue(db as unknown as ReturnType<typeof getServiceClient>);
    return {db,rows,writes};
}
const draft = {clientId:key,clientName:'LIVE TEST',serviceName:'Cut',serviceAmount:251,consumablesAmount:49};
const save = (db:ReturnType<typeof database>['db'],items:Row[]) => runSaveStaffShiftItems({
    supabase:db,staffId:'staff-test',bizId:'biz-test',items,targetShiftDate:'2026-10-12',isOwnerMode:false,useServiceClient:false,
});

test('save/autosave/retry with same draft identity keeps one row, then updates it', async () => {
    const {db,rows,writes}=database();
    expect(await save(db,[draft])).toEqual({ok:true});
    expect(await save(db,[draft])).toEqual({ok:true});
    expect(await save(db,[{...draft,serviceAmount:252}])).toEqual({ok:true});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({id:key,shift_id:'shift-test',service_amount:252,consumables_amount:49});
    expect(writes.filter(write => write.action==='upsert')).toHaveLength(1);
    expect(writes.find(write => write.action==='upsert')?.filters).toEqual({onConflict:'id',ignoreDuplicates:true});
    expect(writes.some(write => write.action==='delete')).toBe(false);
});

test('identical deliberate rows with separate keys remain separate', async () => {
    const {db,rows}=database();
    expect(await save(db,[draft,{...draft,clientId:'86e044d6-d065-4875-9946-a3789d1266f3'}])).toEqual({ok:true});
    expect(rows).toHaveLength(2);
});

test('foreign draft collision rejects before any financial writes', async () => {
    const {db,rows,writes}=database([{id:key,shift_id:'foreign-shift',service_amount:777}]);
    expect(await save(db,[draft])).toMatchObject({ok:false,statusCode:403,errorType:'forbidden'});
    expect(writes).toHaveLength(0);
    expect(rows[0].service_amount).toBe(777);
});

test('unknown persisted ID cannot be used to edit another shift', async () => {
    const {db,writes}=database([{id:key,shift_id:'foreign-shift'}]);
    expect(await save(db,[{...draft,id:key,clientId:undefined}])).toMatchObject({ok:false,statusCode:403});
    expect(writes).toHaveLength(0);
});

test('identity lookup failure fails closed without writing', async () => {
    const {db,writes}=database([],true);
    expect(await save(db,[draft])).toMatchObject({ok:false,statusCode:500});
    expect(writes).toHaveLength(0);
});

test('empty list still removes owned items and resets totals', async () => {
    const {db,rows,writes}=database([{id:key,shift_id:'shift-test',service_amount:251,consumables_amount:49}]);
    expect(await save(db,[])).toEqual({ok:true});
    expect(rows).toHaveLength(0);
    expect(writes.find(write => write.table==='staff_shifts' && write.action==='update')?.data)
        .toMatchObject({total_amount:0,master_share:0,salon_share:0,consumables_amount:0});
});

test('acknowledged row updates only its shift and preserves creation time', async () => {
    const created = '2026-10-12T05:00:00Z';
    const {db,rows,writes}=database([{id:key,shift_id:'shift-test',created_at:created,service_amount:251}]);
    expect(await save(db,[{...draft,id:key,clientId:undefined,serviceAmount:252}])).toEqual({ok:true});
    expect(rows[0]).toMatchObject({created_at:created,service_amount:252});
    expect(writes.some(write => write.action==='upsert' || write.action==='insert' || write.action==='delete')).toBe(false);
});

test('empty legacy placeholder creates no row', async () => {
    const {db,rows,writes}=database();
    expect(await save(db,[{clientName:' ',serviceName:null,serviceAmount:0,consumablesAmount:0,bookingId:null}])).toEqual({ok:true});
    expect(rows).toHaveLength(0);
    expect(writes.some(write => write.action==='insert')).toBe(false);
});
