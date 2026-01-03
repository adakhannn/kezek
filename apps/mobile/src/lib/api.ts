/**
 * API клиент для мобильного приложения
 * Использует те же endpoints, что и web версия
 */

import Constants from 'expo-constants';

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
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            let errorDetails: any = null;

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

            const error = new Error(errorMessage);
            // @ts-ignore
            error.status = response.status;
            // @ts-ignore
            error.details = errorDetails;
            throw error;
        }

        return response.json();
    } catch (error: any) {
        // Если это уже наша ошибка, пробрасываем её дальше
        if (error.message && error.status) {
            throw error;
        }
        
        // Если это сетевая ошибка
        if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
            throw new Error('Нет подключения к интернету. Проверьте соединение и попробуйте снова');
        }
        
        // Если это другая ошибка, пробрасываем её
        throw error;
    }
}

