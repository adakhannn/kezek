import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function UserNewPage() {
    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Новый пользователь</h1>
                <Link href="/admin/users" className="underline">← К списку</Link>
            </div>
            <UserCreateForm />
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

    // Валидация по нашим правилам
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

function UserCreateForm() {
    return (
        <form className="space-y-4 max-w-xl" action={createUserAction}>
            <input name="full_name" className="border rounded px-3 py-2 w-full" placeholder="Имя" />

            <div className="grid md:grid-cols-2 gap-2">
                <input name="email" type="email" className="border rounded px-3 py-2 w-full" placeholder="Email" />
                <input name="phone" className="border rounded px-3 py-2 w-full" placeholder="Телефон (+996…)" />
            </div>

            <input
                name="password"
                type="password"
                className="border rounded px-3 py-2 w-full"
                placeholder="Пароль (обязателен, если указан email)"
            />

            <ul className="text-xs text-gray-600 space-y-1">
                <li>• Если указан <b>email</b> — нужно задать <b>пароль</b> (минимум 8 символов). Вход: email + пароль.</li>
                <li>• Если указан <b>только телефон</b> — пароль <b>не нужен</b>. Вход по <b>OTP</b>-коду (SMS).</li>
            </ul>

            <button className="border rounded px-3 py-2" type="submit">Создать</button>
        </form>
    );
}
