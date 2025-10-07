import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function UserNewPage() {
    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Новый пользователь</h1>
                <Link href="/admin/users" className="underline">← К списку</Link>
            </div>

            <UserCreateForm/>
        </main>
    );
}

function UserCreateForm() {
    return (
        <form className="space-y-3 max-w-xl" action={async (formData) => {
            'use server';
            const payload = {
                email: (formData.get('email') as string) || null,
                phone: (formData.get('phone') as string) || null,
                full_name: (formData.get('full_name') as string) || null,
                password: (formData.get('password') as string) || null,
            };
            const res = await fetch('/admin/api/users/create', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify(payload),
            });
            const j = await res.json();
            if (!j?.ok) throw new Error(j?.error || 'Ошибка создания');
        }}>
            <input name="full_name" className="border rounded px-3 py-2 w-full" placeholder="Имя"/>
            <input name="email" type="email" className="border rounded px-3 py-2 w-full" placeholder="Email"/>
            <input name="phone" className="border rounded px-3 py-2 w-full" placeholder="Телефон (+996…)"/>
            <input name="password" type="password" className="border rounded px-3 py-2 w-full"
                   placeholder="Пароль (опционально)"/>
            <p className="text-xs text-gray-500">Если пароль не указать, сгенерируем автоматически.</p>
            <button className="border rounded px-3 py-2" type="submit">Создать</button>
        </form>
    );
}
