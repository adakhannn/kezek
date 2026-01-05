// apps/web/src/app/admin/users/new/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import UserCreateFormClient from '@/components/admin/users/UserCreateFormClient';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default function UserNewPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Заголовок */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                                Новый пользователь
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Создайте нового пользователя в системе
                            </p>
                        </div>
                        <Link href="/admin/users">
                            <Button variant="outline">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                К списку пользователей
                            </Button>
                        </Link>
                    </div>
                </section>

                {/* Форма */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg p-6">
                    <UserCreateFormClient action={createUserAction} />
                </section>
            </div>
        </main>
    );
}

async function createUserAction(formData: FormData) {
    'use server';

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const url = new URL('/admin/api/users/create', base).toString();

    const cookieHeader = (await cookies()).getAll().map(c => `${c.name}=${c.value}`).join('; ');

    const norm = (v: FormDataEntryValue | null) => {
        const s = typeof v === 'string' ? v.trim() : '';
        return s || null;
    };

    const payload = {
        full_name: norm(formData.get('full_name')),
        email: norm(formData.get('email')),
        phone: norm(formData.get('phone')),
        password: norm(formData.get('password')),
    };

    // Серверная валидация (осталась как была)
    if (!payload.email && !payload.phone) {
        throw new Error('Нужен email или телефон');
    }
    if (payload.email && (!payload.password || payload.password.length < 8)) {
        throw new Error('Для email требуется пароль (минимум 8 символов)');
    }
    if (!payload.email && payload.phone && payload.password) {
        throw new Error('Для телефона пароль не нужен — вход через OTP');
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok !== true) {
        throw new Error(j?.error || `HTTP ${res.status}`);
    }

    redirect('/admin/users?created=1');
}
