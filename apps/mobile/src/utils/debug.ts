/**
 * Утилиты для отладки
 */

import Constants from 'expo-constants';
import { logDebug } from '../lib/log';

/**
 * Выводит информацию о переменных окружения в консоль
 */
export function logEnvVars() {
    logDebug('Debug', 'Environment Variables Debug', {
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        apiUrl: process.env.EXPO_PUBLIC_API_URL ? 'SET' : 'NOT SET',
        expoConfigExtra: Constants.expoConfig?.extra,
        manifestExtra: Constants.manifest?.extra,
    });
}

/**
 * Получает значение переменной окружения из разных источников
 */
export function getEnvVar(key: string, fallback?: string): string | undefined {
    const envKey = `EXPO_PUBLIC_${key}`;
    return (
        process.env[envKey] ||
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest?.extra?.[key] ||
        fallback
    );
}

