'use client';


type EmptyStateType = 
    | 'error' 
    | 'warning' 
    | 'info' 
    | 'empty';

type EmptyStateProps = {
    type: EmptyStateType;
    message: string;
    hint?: string;
    icon?: React.ReactNode;
};

export function BookingEmptyState({ type, message, hint, icon }: EmptyStateProps) {
    const baseClasses = 'rounded-lg border px-3 py-2 text-xs';
    
    const typeClasses = {
        error: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200',
        warning: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
        info: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
        empty: 'border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
    };

    const defaultIcon = {
        error: (
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        warning: (
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        empty: (
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
        ),
    };

    const displayIcon = icon ?? defaultIcon[type];

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            <div className="flex items-start gap-2">
                {displayIcon && (
                    <div className="mt-0.5 flex-shrink-0">
                        {displayIcon}
                    </div>
                )}
                <div className="flex-1">
                    <p className="font-medium">{message}</p>
                    {hint && (
                        <p className="mt-1 opacity-90">{hint}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

