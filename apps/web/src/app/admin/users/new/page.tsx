// apps/web/src/app/admin/users/new/page.tsx
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

    // 1) База для абсолютного URL
    const base =
        process.env.NEXT_PUBLIC_APP_URL  // напр. https://app.example.com
        ?? 'http://localhost:3000';      // dev-фоллбек

    const url = new URL('/admin/api/users/create', base).toString();

    // 2) Сбор Cookie, чтобы API увидело сессию
    const cookieHeader = (await cookies()).getAll().map(c => `${c.name}=${c.value}`).join('; ');

    // 3) Нормализация формы
    const norm = (v: FormDataEntryValue | null) => {
        const s = typeof v === 'string' ? v.trim() : '';
        return s || null;
    };

    const payload = {
        full_name: norm(formData.get('full_name')),
        email:     norm(formData.get('email')),
        phone:     norm(formData.get('phone')),
        password:  norm(formData.get('password')),
    };

    if (!payload.email && !payload.phone) {
        throw new Error('Нужен email или телефон');
    }

    // 4) Вызов API с абсолютным URL + Cookie
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
        <form className="space-y-3 max-w-xl" action={createUserAction}>
            <input name="full_name" className="border rounded px-3 py-2 w-full" placeholder="Имя" />
            <input name="email" type="email" className="border rounded px-3 py-2 w-full" placeholder="Email" />
            <input name="phone" className="border rounded px-3 py-2 w-full" placeholder="Телефон (+996…)" />
            <input name="password" type="password" className="border rounded px-3 py-2 w-full" placeholder="Пароль (опционально)" />
            <p className="text-xs text-gray-500">Если пароль не указать — сгенерируется автоматически.</p>
            <button className="border rounded px-3 py-2" type="submit">Создать</button>
        </form>
    );
}
