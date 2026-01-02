import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { useEffect } from 'react';
import { getErrorMessage } from '../lib/errors';

/**
 * Хук useQuery с автоматической обработкой ошибок через Toast
 */
export function useQueryWithError<TData = unknown, TError = Error>(
    options: UseQueryOptions<TData, TError> & {
        showErrorToast?: boolean;
        errorMessage?: string;
    }
): UseQueryResult<TData, TError> {
    const { showToast } = useToast();
    const { showErrorToast = true, errorMessage, ...queryOptions } = options;

    const query = useQuery<TData, TError>(queryOptions);

    useEffect(() => {
        if (query.isError && showErrorToast && query.error) {
            const message = errorMessage || getErrorMessage(query.error);
            showToast(message, 'error');
        }
    }, [query.isError, query.error, showErrorToast, errorMessage, showToast]);

    return query;
}

