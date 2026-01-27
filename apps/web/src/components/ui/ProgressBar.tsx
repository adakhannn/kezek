'use client';

import { clsx } from 'clsx';

interface ProgressBarProps {
    progress: number; // 0-100
    label?: string;
    showPercentage?: boolean;
    className?: string;
}

export function ProgressBar({ progress, label, showPercentage = true, className }: ProgressBarProps) {
    const clampedProgress = Math.max(0, Math.min(100, progress));

    return (
        <div className={clsx('w-full', className)}>
            {label && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    {showPercentage && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round(clampedProgress)}%</span>
                    )}
                </div>
            )}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-pink-600 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${clampedProgress}%` }}
                />
            </div>
        </div>
    );
}

interface LoadingOverlayProps {
    message?: string;
    progress?: number;
    showProgress?: boolean;
}

export function LoadingOverlay({ message, progress, showProgress = false }: LoadingOverlayProps) {
    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="loading-message"
            aria-busy="true"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative" aria-hidden="true">
                        <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    {message && (
                        <p id="loading-message" className="text-center text-gray-900 dark:text-gray-100 font-medium">{message}</p>
                    )}
                    {showProgress && progress !== undefined && (
                        <div className="w-full mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                            <ProgressBar progress={progress} showPercentage={true} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

