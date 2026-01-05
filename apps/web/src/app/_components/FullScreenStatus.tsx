'use client';

import { Logo } from './Logo';

type FullScreenStatusProps = {
    title: string;
    subtitle?: string;
    message?: string;
    /** Показывать ли спиннер */
    loading?: boolean;
};

export function FullScreenStatus({
    title,
    subtitle,
    message,
    loading = true,
}: FullScreenStatusProps) {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/60 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="mb-6 flex justify-center">
                    <Logo />
                </div>

                <div className="rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-indigo-500/20 shadow-xl px-6 py-8 sm:px-8 sm:py-9 space-y-5 backdrop-blur">
                    <div className="flex flex-col items-center text-center space-y-4">
                        {loading && (
                            <div className="inline-block h-9 w-9 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin shadow-sm" />
                        )}
                        <div className="space-y-1.5">
                            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-50">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {message && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 max-w-sm">
                                {message}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}


