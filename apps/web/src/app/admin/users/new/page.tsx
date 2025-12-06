// apps/web/src/app/admin/users/new/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';

import UserCreateFormClient from '@/components/admin/users/UserCreateFormClient';

export const dynamic = 'force-dynamic';

export default function UserNewPage() {
    return (
        <main className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Новый пользователь</h1>
                <Link href="/admin/users" className="underline">← К списку</Link>
            </div>
            <UserCreateFormClient action={createUserAction} />
        </main>
    );
}

async function createUserAction(formData: FormData) {
    'use server';

    // Используем общую логику напрямую, без внутреннего HTTP запроса
    const { createUser } = await import('@/app/admin/api/users/create/_lib');
    
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

    const result = await createUser(payload);

    if (!result.ok) {
        throw new Error(result.error);
    }

    redirect('/admin/users?created=1');
}
