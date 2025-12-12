'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';


export default function VerifyEmailPage() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';
    const redirect = searchParams.get('redirect') || '/';

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-800 space-y-6">
                    {/* Иконка */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-2xl mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Проверьте почту</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Мы отправили вам письмо со ссылкой для входа на адрес
                        </p>
                        {email && (
                            <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">
                                {email}
                            </p>
                        )}
                    </div>

                    {/* Инструкции */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                <p className="font-medium mb-1">Что делать дальше:</p>
                                <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                    <li>Откройте почтовый ящик</li>
                                    <li>Найдите письмо от Kezek</li>
                                    <li>Нажмите на ссылку в письме</li>
                                    <li>Вы будете автоматически авторизованы</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Дополнительная информация */}
                    <div className="text-center space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Не получили письмо? Проверьте папку «Спам» или попробуйте войти снова.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link 
                                href={`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Вернуться к входу
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
