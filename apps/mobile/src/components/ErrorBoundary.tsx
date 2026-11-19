import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorDisplay from './ErrorDisplay';
import { logError } from '../lib/log';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // The Error itself, so monitoring reports it as an exception with its stack (MOB-07).
        logError('ErrorBoundary', 'Caught an error', { error, componentStack: errorInfo.componentStack });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
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


