'use client';

import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Profile = {
    full_name: string | null;
    phone: string | null;
};

export default function ProfileForm() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile>({ full_name: null, phone: null });

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
                .select('full_name, phone')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                console.error('Error loading profile:', fetchError);
                return;
            }

            setProfile({
                full_name: data?.full_name ?? null,
                phone: data?.phone ?? null,
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
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
                <div className="text-gray-500">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-600 to-pink-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Мой профиль</h2>
            </div>
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
        </div>
    );
}

