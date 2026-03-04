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
 * Возвращает query builder — вызывающая сторона добавляет .select() и .limit().
 * Цепочка .eq().contains() в Supabase сужает тип, поэтому используем приведение для гибкой сборки запроса.
 */
export function buildApprovedBusinessesQuery(
    supabase: SupabaseClient<Database>,
    filters: ApprovedBusinessesFilters,
) {
    const cityId = filters.cityId?.trim();
    const categoryId = filters.categoryId?.trim();

    // Типы Supabase сужаются после .eq() и не экспонируют следующий .eq()/.contains() — приводим к any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table: any = supabase.from('businesses');
    let query = table.eq('is_approved', true);
    if (cityId) query = query.eq('city_id', cityId);
    if (categoryId) query = query.contains('categories', [categoryId]);
    return query;
}
