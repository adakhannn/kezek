/**
 * Общая логика фильтрации одобренных бизнесов для API филиалов (nearby, map).
 * Централизует применение categoryId и city_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

export type ApprovedBusinessesFilters = {
    categoryId?: string;
    cityId?: string;
};

/**
 * Строит запрос к таблице businesses: только одобренные, опционально по категории и городу.
 * В Supabase JS v2 у .from() нет .eq() — фильтры вызываются только после .select(), поэтому сначала вызываем .select().
 * Возвращает query builder — вызывающая сторона добавляет .limit().
 */
export function buildApprovedBusinessesQuery(
    supabase: SupabaseClient<Database>,
    filters: ApprovedBusinessesFilters,
    selectColumns: string = 'id,name,slug,categories',
) {
    const cityId = filters.cityId?.trim();
    const categoryId = filters.categoryId?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table: any = supabase.from('businesses');
    let query = table.select(selectColumns).eq('is_approved', true);
    if (cityId) query = query.eq('city_id', cityId);
    if (categoryId) query = query.contains('categories', [categoryId]);
    return query;
}
