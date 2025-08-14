// apps/web/src/app/dev/super/page.tsx
'use client';
import { useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function DevSuper() {
    const [msg, setMsg] = useState<string>('');

    async function becomeSuper() {
        const { error } = await supabase.rpc('dev_become_superadmin');
        setMsg(error ? `Ошибка: ${error.message}` : 'Готово: вы супер-админ. Обновите страницу и откройте /dashboard/bookings');
    }

    return (
        <main className="mx-auto max-w-md p-6 space-y-3">
            <h1 className="text-xl font-semibold">Dev: сделать себя супер-админом</h1>
            <button className="border px-3 py-1 rounded" onClick={becomeSuper}>
                Стать супер-админом
            </button>
            {msg && <div className="text-sm text-gray-700">{msg}</div>}
        </main>
    );
}
