'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

import { ErrorDisplay } from './ErrorDisplay';

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
        // Логируем ошибку с детальной информацией
        try {
            const { logError } = require('@/lib/log');
            logError('ErrorBoundary', 'Caught an error', { 
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
                errorInfo: {
                    componentStack: errorInfo.componentStack,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (logErr) {
            // Если логирование не удалось, используем console.error
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
        
        // Вызываем callback если передан
        if (this.props.onError) {
            try {
                this.props.onError(error, errorInfo);
            } catch (callbackError) {
                console.error('Error in onError callback:', callbackError);
            }
        }

        // В продакшене можно отправить ошибку в систему мониторинга (Sentry, LogRocket и т.д.)
        if (process.env.NODE_ENV === 'production') {
            // TODO: Интеграция с системой мониторинга ошибок
            // logErrorToService(error, errorInfo);
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

