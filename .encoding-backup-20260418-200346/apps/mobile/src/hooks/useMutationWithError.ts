import {
    useMutation,
    UseMutationOptions,
    UseMutationResult,
} from '@tanstack/react-query';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';

/**
 * ??? useMutation ? ?????????????? ?????????? ?????? ? ???????? ???????? ????? Toast
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
        onError: (error, variables, onMutateResult, context) => {
            if (showErrorToast) {
                const message = errorMessage || getErrorMessage(error);
                showToast(message, 'error');
            }
            onError?.(error, variables, onMutateResult, context);
        },
        onSuccess: (data, variables, onMutateResult, context) => {
            if (showSuccessToast && successMessage) {
                showToast(successMessage, 'success');
            }
            onSuccess?.(data, variables, onMutateResult, context);
        },
    });
}

