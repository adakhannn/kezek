import {createClient} from "@supabase/supabase-js";

import { getSupabaseUrl, getSupabaseServiceRoleKey } from './env';

/**
 * Создает Supabase клиент с Service Role Key
 * 
 * ⚠️ КРИТИЧЕСКИ ВАЖНО: Service Role Key обходит все RLS политики!
 * 
 * Используйте только в:
 * - Server components
 * - API routes
 * - Server Actions
 * 
 * НИКОГДА не используйте в:
 * - Client components ('use client')
 * - Браузерном коде
 * 
 * @throws Error если вызывается в клиентском коде
 */
export function getServiceClient() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceRoleKey(); // Защита от клиентского использования встроена в функцию
    return createClient(url, key, {auth: {persistSession: false}});
}