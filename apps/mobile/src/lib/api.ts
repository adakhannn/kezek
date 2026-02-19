/**
 * API клиент для мобильного приложения
 * Использует те же endpoints, что и web версия
 */

import Constants from 'expo-constants';
import { supabase } from './supabase';
import { logWarn } from './log';

const API_URL = 
    process.env.EXPO_PUBLIC_API_URL || 
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl ||
    'https://kezek.kg';

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    // Получаем токен авторизации из Supabase
    let authToken: string | null = null;
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            logWarn('apiRequest', 'Session error', { message: sessionError.message });
        }
        authToken = session?.access_token || null;
        if (!authToken) {
            logWarn('apiRequest', 'No access token in session');
        }
    } catch (error) {
        logWarn('apiRequest', 'Failed to get session token', error);
    }
    
    try {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        // Добавляем токен авторизации, если он есть
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            let errorDetails: unknown = null;

            // Пытаемся получить JSON ошибки
            try {
                const errorData = await response.json();
                errorDetails = errorData;
                errorMessage = errorData.message || errorData.error || errorMessage;
                
                // Если есть детали ошибки, добавляем их
                if (errorData.details) {
                    errorMessage += `: ${errorData.details}`;
                }
            } catch {
                // Если не JSON, пытаемся получить текст
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage = errorText.length > 200 ? `${errorText.substring(0, 200)}...` : errorText;
                    }
                } catch {
                    // Если ничего не получилось, используем стандартное сообщение
                    if (response.status === 401) {
                        errorMessage = 'Необходима авторизация';
                    } else if (response.status === 403) {
                        errorMessage = 'Доступ запрещен';
                    } else if (response.status === 404) {
                        errorMessage = 'Ресурс не найден';
                    } else if (response.status === 500) {
                        errorMessage = 'Ошибка сервера. Попробуйте позже';
                    } else if (response.status >= 400 && response.status < 500) {
                        errorMessage = 'Ошибка запроса';
                    } else if (response.status >= 500) {
                        errorMessage = 'Ошибка сервера';
                    }
                }
            }

            // Создаем ошибку с дополнительными полями
            const error = new Error(errorMessage) as Error & {
                status?: number;
                details?: unknown;
            };
            error.status = response.status;
            error.details = errorDetails;
            throw error;
        }

        return response.json();
    } catch (error: unknown) {
        // Если это уже наша ошибка с дополнительными полями, пробрасываем её дальше
        if (error instanceof Error) {
            const apiError = error as Error & {
                status?: number;
                details?: unknown;
            };
            if (apiError.status !== undefined) {
                throw apiError;
            }
            
            // Если это сетевая ошибка
            if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
                throw new Error('Нет подключения к интернету. Проверьте соединение и попробуйте снова');
            }
        }
        
        // Если это другая ошибка, пробрасываем её
        throw error;
    }
}

