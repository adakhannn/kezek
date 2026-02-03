'use client';

type GuestBookingForm = {
    client_name: string;
    client_phone: string;
    client_email: string;
};

type GuestBookingModalProps = {
    isOpen: boolean;
    loading: boolean;
    form: GuestBookingForm;
    onClose: () => void;
    onFormChange: (form: GuestBookingForm) => void;
    onSubmit: () => void;
    t: (key: string, fallback?: string) => string;
};

export function GuestBookingModal({
    isOpen,
    loading,
    form,
    onClose,
    onFormChange,
    onSubmit,
    t,
}: GuestBookingModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && onClose()}>
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('booking.guest.title', 'Быстрая бронь без регистрации')}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('booking.guest.subtitle', 'Заполните ваши данные для бронирования')}
                    </p>
                </div>
                
                <div className="px-4 py-4 space-y-3">
                    {/* Имя */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('booking.guest.name', 'Ваше имя')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.client_name}
                            onChange={(e) => onFormChange({ ...form, client_name: e.target.value })}
                            placeholder={t('booking.guest.namePlaceholder', 'Введите ваше имя')}
                            disabled={loading}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 sm:py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 min-h-[44px] sm:min-h-[40px] touch-manipulation"
                            autoFocus
                        />
                    </div>
                    
                    {/* Телефон */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('booking.guest.phone', 'Телефон')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={form.client_phone}
                            onChange={(e) => onFormChange({ ...form, client_phone: e.target.value })}
                            placeholder={t('booking.guest.phonePlaceholder', '+996555123456')}
                            disabled={loading}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 sm:py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 min-h-[44px] sm:min-h-[40px] touch-manipulation"
                        />
                    </div>
                    
                    {/* Email (опционально) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('booking.guest.email', 'Email')} <span className="text-xs text-gray-400">({t('booking.guest.optional', 'необязательно')})</span>
                        </label>
                        <input
                            type="email"
                            value={form.client_email}
                            onChange={(e) => onFormChange({ ...form, client_email: e.target.value })}
                            placeholder={t('booking.guest.emailPlaceholder', 'you@example.com')}
                            disabled={loading}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 sm:py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 min-h-[44px] sm:min-h-[40px] touch-manipulation"
                        />
                    </div>
                </div>
                
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800 min-h-[44px] sm:min-h-[32px] touch-manipulation"
                    >
                        {t('booking.guest.cancel', 'Отмена')}
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={loading}
                        className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2.5 sm:py-2 text-sm sm:text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400 min-h-[44px] sm:min-h-[32px] touch-manipulation"
                    >
                        {loading 
                            ? t('booking.guest.booking', 'Бронируем...') 
                            : t('booking.guest.book', 'Забронировать')}
                    </button>
                </div>
            </div>
        </div>
    );
}

