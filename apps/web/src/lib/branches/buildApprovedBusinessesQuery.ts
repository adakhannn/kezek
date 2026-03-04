/**
 * Общая логика фильтрации одобренных бизнесов для API филиалов (nearby, map).
 * Централизует применение categoryId и city_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ApprovedBusinessesFilters = {
    categoryId?: string;
    cityId?: string;
};

/**
 * Строит запрос к таблице businesses: только одобренные, опционально по категории и городу.
 * Возвращает query builder — вызывающая сторона добавляет .select() и .limit().
 */
export function buildApprovedBusinessesQuery(
    supabase: SupabaseClient,
    filters: ApprovedBusinessesFilters,
) {
    let query = supabase
        .from('businesses')
        .eq('is_approved', true);

    const categoryId = filters.categoryId?.trim();
    if (categoryId) {
        query = query.contains('categories', [categoryId]);
    }

    const cityId = filters.cityId?.trim();
    if (cityId) {
        query = query.eq('city_id', cityId);
    }

    return query;
}
