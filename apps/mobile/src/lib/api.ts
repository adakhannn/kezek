/**
 * API клиент для мобильного приложения
 * Использует shared-client для единообразной обработки запросов
 */

import Constants from 'expo-constants';
import { supabase } from './supabase';
import { logWarn } from './log';
import { createApiClient } from '@shared-client/api';

const API_URL = 
    process.env.EXPO_PUBLIC_API_URL || 
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl ||
    'https://kezek.kg';

// Создаём API клиент с конфигурацией для mobile
const { apiRequest: sharedApiRequest } = createApiClient({
    baseUrl: API_URL,
    getAuthToken: async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                logWarn('apiRequest', 'Session error', { message: sessionError.message });
            }
            const token = session?.access_token || null;
            if (!token) {
                logWarn('apiRequest', 'No access token in session');
            }
            return token;
        } catch (error) {
            logWarn('apiRequest', 'Failed to get session token', error);
            return null;
        }
    },
    onError: (error) => {
        logWarn('apiRequest', 'API error', {
            message: error.message,
            status: error.status,
            details: error.details,
        });
    },
});

/**
 * Выполняет API запрос с автоматической обработкой ошибок и авторизацией
 * 
 * @deprecated Используйте прямой импорт из @shared-client/api для новых файлов
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    return sharedApiRequest<T>(endpoint, options);
}

