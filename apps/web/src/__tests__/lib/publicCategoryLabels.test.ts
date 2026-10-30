import { loadPublicCategoryLabels, publicCategoryLabel } from '@/lib/publicCategoryLabels';
jest.mock('@/lib/log', () => ({logWarn: jest.fn()}));

it('reads public names once per distinct slug without changing filter identities', async () => {
    const inQuery = jest.fn().mockResolvedValue({data:[{slug:'zhenskaya-parikmaherskaya',name_ru:' Женская парикмахерская '},{slug:'empty',name_ru:''}],error:null});
    const select = jest.fn().mockReturnValue({in:inQuery});
    const from = jest.fn().mockReturnValue({select});
    const labels = await loadPublicCategoryLabels({from},['zhenskaya-parikmaherskaya','zhenskaya-parikmaherskaya','','empty']);
    expect(from).toHaveBeenCalledWith('categories');
    expect(select).toHaveBeenCalledWith('slug,name_ru');
    expect(inQuery).toHaveBeenCalledWith('slug',['zhenskaya-parikmaherskaya','empty']);
    expect(publicCategoryLabel(labels,'zhenskaya-parikmaherskaya')).toBe('Женская парикмахерская');
    expect(publicCategoryLabel(labels,'empty')).toBe('empty');
    expect(publicCategoryLabel(labels,'toString')).toBe('toString');
});

it('does not query empty identities and tolerates unavailable optional names', async () => {
    const from = jest.fn();
    expect(await loadPublicCategoryLabels({from},[])).toEqual({});
    expect(from).not.toHaveBeenCalled();
    from.mockReturnValue({select:()=>({in:async()=>({data:null,error:{message:'unavailable'}})})});
    expect(await loadPublicCategoryLabels({from},['cat'])).toEqual({});
});
