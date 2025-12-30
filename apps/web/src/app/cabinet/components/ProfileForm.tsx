'use client';

import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Profile = {
    full_name: string | null;
    phone: string | null;
    notify_email: boolean;
    notify_sms: boolean;
    notify_whatsapp: boolean;
};

export default function ProfileForm() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile>({ 
        full_name: null, 
        phone: null,
        notify_email: true,
        notify_sms: true,
        notify_whatsapp: true,
    });

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('full_name, phone, notify_email, notify_sms, notify_whatsapp')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                console.error('Error loading profile:', fetchError);
                return;
            }

            setProfile({
                full_name: data?.full_name ?? null,
                phone: data?.phone ?? null,
                notify_email: data?.notify_email ?? true,
                notify_sms: data?.notify_sms ?? true,
                notify_whatsapp: data?.notify_whatsapp ?? true,
            });
        } catch (e) {
            console.error('Error loading profile:', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        setError(null);

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name || null,
                    phone: profile.phone || null,
                    notify_email: profile.notify_email,
                    notify_sms: profile.notify_sms,
                    notify_whatsapp: profile.notify_whatsapp,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.message || data.error || 'Ошибка при сохранении');
            }

            setMessage('Профиль обновлен');
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Загрузка...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Имя
                    </label>
                    <input
                        type="text"
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={profile.full_name || ''}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value || null })}
                        placeholder="Ваше имя"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Телефон <span className="text-gray-500 text-xs">(для связи, не используется для входа)</span>
                    </label>
                    <input
                        type="tel"
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                        placeholder="+996XXXXXXXXX"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Укажите номер телефона, чтобы мастера могли связаться с вами при необходимости
                    </p>
                </div>
                
                {/* Настройки уведомлений */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Уведомления о бронированиях
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_email}
                                onChange={(e) => setProfile({ ...profile, notify_email: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SMS</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_sms}
                                onChange={(e) => setProfile({ ...profile, notify_sms: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={profile.notify_whatsapp}
                                onChange={(e) => setProfile({ ...profile, notify_whatsapp: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Выберите способы получения уведомлений о ваших бронированиях
                    </p>
                </div>
                
                {message && (
                    <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:border-green-900/60 dark:text-green-100">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-100">
                        {error}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </form>
    );
}

