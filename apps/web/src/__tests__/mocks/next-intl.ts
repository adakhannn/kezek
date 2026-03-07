/**
 * Mock for next-intl in tests (useTranslations etc.)
 */
export function useTranslations() {
    return (key: string, fallback?: string) => fallback ?? key;
}
