import { TelegramLinkWidget } from './TelegramLinkWidget';
import { isTelegramAlreadyLinkedError, type ProfileFormProfile } from './profileFormHelpers';

type TranslateFn = (key: string, fallback?: string) => string;

type ProfileNotificationSettingsProps = {
    profile: ProfileFormProfile;
    setProfile: (profile: ProfileFormProfile) => void;
    otpCode: string;
    setOtpCode: (value: string) => void;
    otpSending: boolean;
    otpVerifying: boolean;
    showOtpInput: boolean;
    setShowOtpInput: (value: boolean) => void;
    error: string | null;
    handleSendOtp: () => void;
    handleVerifyOtp: () => void;
    handleTelegramLinkSuccess: () => void;
    handleTelegramLinkError: (err: string) => void;
    t: TranslateFn;
};

export function ProfileNotificationSettings({
    profile,
    setProfile,
    otpCode,
    setOtpCode,
    otpSending,
    otpVerifying,
    showOtpInput,
    setShowOtpInput,
    error,
    handleSendOtp,
    handleVerifyOtp,
    handleTelegramLinkSuccess,
    handleTelegramLinkError,
    t,
}: ProfileNotificationSettingsProps) {
    return (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('cabinet.profile.notifications.title', 'Уведомления о бронированиях')}
            </h3>
            <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('cabinet.profile.notifications.email', 'Email')}
                        </span>
                    </div>
                    <input
                        type="checkbox"
                        checked={profile.notify_email}
                        onChange={(e) => setProfile({ ...profile, notify_email: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                </label>

                {false && (
                    <div className="space-y-2">
                        <label className="flex cursor-pointer items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('cabinet.profile.notifications.whatsapp', 'WhatsApp')}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_whatsapp}
                                onChange={(e) => setProfile({ ...profile, notify_whatsapp: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>

                        {profile.notify_whatsapp ? (
                            <div className="ml-7 space-y-2">
                                {profile.whatsapp_verified ? (
                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{t('cabinet.profile.whatsapp.verified', 'Номер подтвержден')}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span>{t('cabinet.profile.whatsapp.notVerified', 'Номер не подтвержден. Подтвердите для получения уведомлений.')}</span>
                                        </div>
                                        {!showOtpInput ? (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={otpSending || !profile.phone}
                                                className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {otpSending
                                                    ? t('cabinet.profile.whatsapp.sending', 'Отправка...')
                                                    : t('cabinet.profile.whatsapp.sendCode', 'Отправить код')}
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        maxLength={6}
                                                        value={otpCode}
                                                        onChange={(e) => setOtpCode(e.target.value)}
                                                        placeholder={t('cabinet.profile.whatsapp.codePlaceholder', '000000')}
                                                        className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleVerifyOtp}
                                                        disabled={otpVerifying || otpCode.length !== 6}
                                                        className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {otpVerifying
                                                            ? t('cabinet.profile.whatsapp.verifying', 'Проверка...')
                                                            : t('cabinet.profile.whatsapp.verify', 'Подтвердить')}
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowOtpInput(false);
                                                        setOtpCode('');
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                                >
                                                    {t('cabinet.profile.whatsapp.cancel', 'Отменить')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                <label className="flex cursor-pointer items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.371 0 0 5.371 0 12s5.371 12 12 12 12-5.371 12-12S18.629 0 12 0zm5.496 8.246l-1.89 8.91c-.143.637-.523.793-1.059.494l-2.93-2.162-1.414 1.362c-.156.156-.287.287-.586.287l.21-3.004 5.472-4.946c.238-.21-.051-.328-.369-.118l-6.768 4.263-2.91-.909c-.633-.197-.647-.633.133-.936l11.37-4.386c.523-.189.983.118.812.935z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('cabinet.profile.notifications.telegram', 'Telegram')}
                        </span>
                    </div>
                    <input
                        type="checkbox"
                        checked={profile.notify_telegram}
                        onChange={(e) => setProfile({ ...profile, notify_telegram: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                </label>

                {!profile.telegram_connected ? (
                    <div className="ml-7 mt-2 space-y-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('cabinet.profile.telegram.notConnected', 'Чтобы получать уведомления в Telegram, подключите Telegram аккаунт:')}
                        </p>
                        <div className="flex justify-start">
                            <TelegramLinkWidget
                                onSuccess={handleTelegramLinkSuccess}
                                onError={handleTelegramLinkError}
                                size="medium"
                            />
                        </div>
                        {isTelegramAlreadyLinkedError(error) ? (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                                    {t('cabinet.profile.telegram.alreadyLinked.title', 'Этот Telegram аккаунт уже привязан к другому пользователю.')}
                                </p>
                                <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                                    {t('cabinet.profile.telegram.alreadyLinked.desc', 'Чтобы использовать другой Telegram аккаунт:')}
                                </p>
                                <ol className="ml-2 list-inside list-decimal space-y-1 text-xs text-amber-700 dark:text-amber-300">
                                    <li>
                                        {t('cabinet.profile.telegram.alreadyLinked.step1.prefix', 'Откройте')}{' '}
                                        <a href="https://web.telegram.org" target="_blank" rel="noopener noreferrer" className="underline">
                                            web.telegram.org
                                        </a>{' '}
                                        {t('cabinet.profile.telegram.alreadyLinked.step1.suffix', 'в новой вкладке')}
                                    </li>
                                    <li>{t('cabinet.profile.telegram.alreadyLinked.step2', 'Выйдите из текущего Telegram аккаунта')}</li>
                                    <li>{t('cabinet.profile.telegram.alreadyLinked.step3', 'Войдите в нужный Telegram аккаунт')}</li>
                                    <li>{t('cabinet.profile.telegram.alreadyLinked.step4', 'Вернитесь на эту страницу и попробуйте снова')}</li>
                                </ol>
                                <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
                                    {t('cabinet.profile.telegram.alreadyLinked.hint', 'Или используйте режим инкогнито браузера для входа в другой аккаунт.')}
                                </p>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('cabinet.profile.notifications.desc', 'Выберите способы получения уведомлений о ваших бронированиях')}
            </p>
        </div>
    );
}
