import { createApiClient } from '@shared-client/api';
import { getMobileApiUrl } from './apiUrl';
import { logDebug, logWarn } from './log';
import { supabase } from './supabase';

function normalizeApiEndpoint(endpoint: string): string {
    if (!endpoint) {
        return '/api';
    }

    // Absolute URLs are passed through unchanged.
    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }

    const withLeadingSlash = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Keep endpoints that already include an API segment.
    if (withLeadingSlash.startsWith('/api/') || withLeadingSlash.includes('/api/')) {
        return withLeadingSlash;
    }

    return `/api${withLeadingSlash}`;
}

function createMobileApiRequest(apiUrl: string) {
    return createApiClient({
        baseUrl: apiUrl,
        getAuthToken: async () => {
            try {
                const {
                    data: { session },
                    error: sessionError,
                } = await supabase.auth.getSession();

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
    }).apiRequest;
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const apiUrl = getMobileApiUrl();
    const sharedApiRequest = createMobileApiRequest(apiUrl);
    const normalizedEndpoint = normalizeApiEndpoint(endpoint);
    const fullUrl =
        /^https?:\/\//i.test(normalizedEndpoint)
            ? normalizedEndpoint
            : `${apiUrl}${normalizedEndpoint}`;

    try {
        const response = await sharedApiRequest<T>(normalizedEndpoint, options);

        logDebug('apiRequest', 'API success', {
            endpoint,
            normalizedEndpoint,
            url: fullUrl,
            method: options.method || 'GET',
        });

        return response;
    } catch (error) {
        logWarn('apiRequest', 'API request failed', {
            endpoint,
            normalizedEndpoint,
            url: fullUrl,
            method: options.method || 'GET',
            error,
        });

        throw error;
    }
}

