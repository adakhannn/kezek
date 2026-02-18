'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

import { ErrorDisplay } from './ErrorDisplay';

import { reportErrorToMonitoring } from '@/lib/errorMonitoring';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary для веб-приложения
 * Перехватывает ошибки в дочерних компонентах и отображает fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const timestamp = new Date().toISOString();
        const url = typeof window !== 'undefined' ? window.location.href : undefined;
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;

        // Логируем ошибку и отправляем в систему мониторинга (если подключена)
        reportErrorToMonitoring({
            scope: 'ErrorBoundary',
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            componentStack: errorInfo.componentStack,
            url,
            userAgent,
            timestamp,
        });
        
        // Вызываем callback если передан
        if (this.props.onError) {
            try {
                this.props.onError(error, errorInfo);
            } catch (callbackError: unknown) {
                // Логируем ошибки внутри onError через общую систему мониторинга
                reportErrorToMonitoring({
                    scope: 'ErrorBoundary',
                    error: {
                        name: callbackError instanceof Error ? callbackError.name : 'Error',
                        message: callbackError instanceof Error ? callbackError.message : String(callbackError),
                        stack: callbackError instanceof Error ? callbackError.stack : undefined,
                    },
                    componentStack: errorInfo.componentStack,
                    url,
                    userAgent,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            // Если передан кастомный fallback, используем его
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Иначе используем стандартный ErrorDisplay
            return (
                <ErrorDisplay
                    error={this.state.error}
                    onRetry={this.handleReset}
                />
            );
        }

        return this.props.children;
    }
}

