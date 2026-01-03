/**
 * Утилиты для отладки
 */

import Constants from 'expo-constants';

/**
 * Выводит информацию о переменных окружения в консоль
 */
export function logEnvVars() {
    console.log('=== Environment Variables Debug ===');
    console.log('process.env.EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('process.env.EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL ? 'SET' : 'NOT SET');
    console.log('Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
    console.log('Constants.manifest?.extra:', Constants.manifest?.extra);
    console.log('===================================');
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

