'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

export default function AuthPanel() {
    const [user, setUser] = useState<{email?: string|null; phone?: string|null} | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    }, []);

    if (!user) {
        return (
            <div className="flex gap-2">
                <Link className="border px-3 py-1 rounded" href="/auth/sign-in">Войти</Link>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className="text-sm text-gray-400">
                {user.email || user.phone}
            </div>
            <Link className="border px-3 py-1 rounded" href="/auth/sign-out">Выйти</Link>
        </div>
    );
}
