'use client';

import { ProfileNotificationSettings } from './ProfileNotificationSettings';
import { ProfilePhoneField } from './ProfilePhoneField';
import { useProfileForm } from './useProfileForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function ProfileForm() {
    const { t } = useLanguage();
    const {
        loading,
        saving,
        message,
        error,
        profile,
        setProfile,
        otpCode,
        setOtpCode,
        otpSending,
        otpVerifying,
        showOtpInput,
        setShowOtpInput,
        handleSubmit,
        handleSendOtp,
        handleVerifyOtp,
        handleTelegramLinkSuccess,
        handleTelegramLinkError,
    } = useProfileForm(t);

    if (loading) {
        return (
            <div className="py-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                <p className="mt-4 text-gray-500 dark:text-gray-400">
                    {t('cabinet.profile.loading', 'Загрузка...')}
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('cabinet.profile.name.label', 'Имя')}
                </label>
                <input
                    type="text"
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={profile.full_name || ''}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value || null })}
                    placeholder={t('cabinet.profile.name.placeholder', 'Ваше имя')}
                />
            </div>

            <ProfilePhoneField profile={profile} setProfile={setProfile} t={t} />

            <ProfileNotificationSettings
                profile={profile}
                setProfile={setProfile}
                otpCode={otpCode}
                setOtpCode={setOtpCode}
                otpSending={otpSending}
                otpVerifying={otpVerifying}
                showOtpInput={showOtpInput}
                setShowOtpInput={setShowOtpInput}
                error={error}
                handleSendOtp={handleSendOtp}
                handleVerifyOtp={handleVerifyOtp}
                handleTelegramLinkSuccess={handleTelegramLinkSuccess}
                handleTelegramLinkError={handleTelegramLinkError}
                t={t}
            />

            {message ? (
                <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100">
                    {message}
                </div>
            ) : null}
            {error ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            ) : null}

            <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {saving ? t('cabinet.profile.saving', 'Сохранение...') : t('cabinet.profile.save', 'Сохранить')}
            </button>
        </form>
    );
}
