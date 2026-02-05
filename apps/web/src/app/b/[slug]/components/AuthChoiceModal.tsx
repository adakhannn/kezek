'use client';

type AuthChoiceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onAuth: () => void;
    onGuestBooking: () => void;
    t: (key: string, fallback?: string) => string;
};

export function AuthChoiceModal({
    isOpen,
    onClose,
    onAuth,
    onGuestBooking,
    t,
}: AuthChoiceModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('booking.authChoice.title', 'Выберите способ бронирования')}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('booking.authChoice.subtitle', 'Вы можете авторизоваться или забронировать без регистрации')}
                    </p>
                </div>
                
                <div className="px-4 py-4 space-y-3">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onAuth();
                        }}
                        className="w-full rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 dark:border-indigo-400 min-h-[44px] sm:min-h-[40px] touch-manipulation"
                    >
                        {t('booking.authChoice.authButton', 'Войти или зарегистрироваться')}
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onGuestBooking();
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800 min-h-[44px] sm:min-h-[40px] touch-manipulation"
                    >
                        {t('booking.authChoice.guestButton', 'Запись без регистрации')}
                    </button>
                </div>
                
                <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800 min-h-[44px] sm:min-h-[32px] touch-manipulation"
                    >
                        {t('booking.authChoice.cancel', 'Отмена')}
                    </button>
                </div>
            </div>
        </div>
    );
}

