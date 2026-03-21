import {
    useMutation,
    UseMutationOptions,
    UseMutationResult,
} from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';

/**
 * Хук useMutation с автоматической обработкой ошибок и успешных операций через Toast
 */
export function useMutationWithError<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
    options: UseMutationOptions<TData, TError, TVariables, TContext> & {
        showErrorToast?: boolean;
        showSuccessToast?: boolean;
        errorMessage?: string;
        successMessage?: string;
    }
): UseMutationResult<TData, TError, TVariables, TContext> {
    const { showToast } = useToast();
    const {
        showErrorToast = true,
        showSuccessToast = false,
        errorMessage,
        successMessage,
        onError,
        onSuccess,
        ...mutationOptions
    } = options;

    return useMutation<TData, TError, TVariables, TContext>({
        ...mutationOptions,
        onError: (error, variables, context) => {
            if (showErrorToast) {
                const message = errorMessage || getErrorMessage(error);
                showToast(message, 'error');
            }
            onError?.(error, variables, context);
        },
        onSuccess: (data, variables, context) => {
            if (showSuccessToast && successMessage) {
                showToast(successMessage, 'success');
            }
            onSuccess?.(data, variables, context);
        },
    });
}

