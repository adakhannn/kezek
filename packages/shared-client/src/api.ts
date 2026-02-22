/**
 * Базовый HTTP клиент для API запросов
 * 
 * Предоставляет общую логику для web и mobile приложений:
 * - обработка ошибок
 * - добавление авторизации
 * - типизация ответов
 */

/**
 * Конфигурация для создания API клиента
 */
export type ApiClientConfig = {
    baseUrl: string;
    getAuthToken?: () => Promise<string | null>;
    onError?: (error: ApiError) => void;
};

/**
 * Ошибка API запроса
 */
export class ApiError extends Error {
    public readonly status?: number;
    public readonly details?: unknown;
    public readonly response?: Response;

    constructor(message: string, status?: number, details?: unknown, response?: Response) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
        this.response = response;
    }
}

/**
 * Опции для API запроса
 */
export type ApiRequestOptions = RequestInit & {
    skipAuth?: boolean; // Пропустить добавление токена авторизации
};

/**
 * Создаёт функцию для выполнения API запросов
 */
export function createApiClient(config: ApiClientConfig) {
    const { baseUrl, getAuthToken, onError } = config;

    /**
     * Выполняет API запрос с автоматической обработкой ошибок и авторизацией
     */
    async function apiRequest<T>(
        endpoint: string,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        const url = `${baseUrl}${endpoint}`;
        
        // Получаем токен авторизации, если нужно
        let authToken: string | null = null;
        if (!options.skipAuth && getAuthToken) {
            try {
                authToken = await getAuthToken();
            } catch (error) {
                // Игнорируем ошибки получения токена, запрос пойдёт без авторизации
            }
        }
        
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            // Добавляем существующие заголовки
            if (options.headers) {
                if (options.headers instanceof Headers) {
                    options.headers.forEach((value, key) => {
                        headers[key] = value;
                    });
                } else if (Array.isArray(options.headers)) {
                    for (const [key, value] of options.headers) {
                        headers[key] = value;
                    }
                } else {
                    Object.assign(headers, options.headers);
                }
            }
            
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
                    const errorData = await response.json() as unknown;
                    errorDetails = errorData;
                    
                    // Проверяем, что errorData - объект с возможными полями
                    if (errorData && typeof errorData === 'object') {
                        const errObj = errorData as Record<string, unknown>;
                        errorMessage = (typeof errObj.message === 'string' ? errObj.message : null) ||
                                      (typeof errObj.error === 'string' ? errObj.error : null) ||
                                      errorMessage;
                        
                        // Если есть детали ошибки, добавляем их
                        if (typeof errObj.details === 'string') {
                            errorMessage += `: ${errObj.details}`;
                        }
                    }
                } catch {
                    // Если не JSON, пытаемся получить текст
                    try {
                        const errorText = await response.text();
                        if (errorText) {
                            errorMessage = errorText.length > 200 
                                ? `${errorText.substring(0, 200)}...` 
                                : errorText;
                        }
                    } catch {
                        // Если ничего не получилось, используем стандартные сообщения
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

                const error = new ApiError(errorMessage, response.status, errorDetails, response);
                
                // Вызываем обработчик ошибок, если он есть
                if (onError) {
                    onError(error);
                }
                
                throw error;
            }

            // Пытаемся распарсить JSON ответ
            try {
                const json = await response.json();
                return json as T;
            } catch {
                // Если ответ не JSON, возвращаем пустой объект
                // Это может быть проблемой для некоторых типов, но лучше чем ничего
                return {} as T;
            }
        } catch (error: unknown) {
            // Если это уже наша ошибка, пробрасываем её дальше
            if (error instanceof ApiError) {
                throw error;
            }
            
            // Если это сетевая ошибка
            if (error instanceof Error) {
                if (
                    error.message?.includes('Network request failed') || 
                    error.message?.includes('Failed to fetch') ||
                    error.message?.includes('NetworkError')
                ) {
                    const networkError = new ApiError(
                        'Нет подключения к интернету. Проверьте соединение и попробуйте снова',
                        undefined,
                        error
                    );
                    if (onError) {
                        onError(networkError);
                    }
                    throw networkError;
                }
            }
            
            // Если это другая ошибка, оборачиваем её в ApiError
            const apiError = new ApiError(
                error instanceof Error ? error.message : 'Неизвестная ошибка',
                undefined,
                error
            );
            if (onError) {
                onError(apiError);
            }
            throw apiError;
        }
    }

    return { apiRequest };
}

/**
 * Тип для успешного API ответа
 */
export type ApiSuccessResponse<T = unknown> = {
    ok: true;
    data: T;
};

/**
 * Тип для ошибки API ответа
 */
export type ApiErrorResponse = {
    ok: false;
    error: string;
    code?: string;
    details?: unknown;
};

/**
 * Тип для API ответа (успех или ошибка)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

