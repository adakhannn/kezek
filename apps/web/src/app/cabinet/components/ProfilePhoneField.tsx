import type { ProfileFormProfile } from './profileFormHelpers';

type TranslateFn = (key: string, fallback?: string) => string;

type ProfilePhoneFieldProps = {
    profile: ProfileFormProfile;
    setProfile: (profile: ProfileFormProfile) => void;
    t: TranslateFn;
};

export function ProfilePhoneField({ profile, setProfile, t }: ProfilePhoneFieldProps) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('cabinet.profile.phone.label', 'Телефон')}{' '}
                <span className="text-xs text-gray-500">
                    ({t('cabinet.profile.phone.hint', 'для связи, не используется для входа')})
                </span>
            </label>
            <div className="relative">
                <input
                    type="tel"
                    className={`w-full rounded border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 dark:text-gray-100 ${
                        !profile.phone
                            ? 'border-amber-300 bg-amber-50/50 focus:border-amber-400 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-950/20'
                            : 'border-gray-300 bg-white focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800'
                    }`}
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                    placeholder={t('cabinet.profile.phone.placeholder', '+996555123456')}
                />
                {!profile.phone ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                ) : null}
            </div>
            {!profile.phone ? (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="font-medium">{t('cabinet.profile.phone.warning.title', 'Заполните номер телефона')}</p>
                        <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                            {t('cabinet.profile.phone.warning.desc', 'Это нужно для связи с вами')}
                        </p>
                    </div>
                </div>
            ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'cabinet.profile.phone.description',
                        'Укажите номер телефона, чтобы мастера могли связаться с вами при необходимости',
                    )}
                </p>
            )}
        </div>
    );
}
