import { createErrorResponse } from '@/lib/apiErrorHandler';

/**
 * Handlers for API paths that match no route (API-12). Without them Next.js rendered the HTML
 * not-found page, and for POST even with status 200, so an API client took a mistyped or removed
 * endpoint for success. Every method now gets a JSON 404.
 */
export function unknownApiRoute() {
    return createErrorResponse('not_found', 'Unknown API endpoint', undefined, 404);
}

