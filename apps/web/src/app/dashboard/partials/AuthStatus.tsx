'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import {supabase} from '@/lib/supabaseClient';

type U = {
    id: string;
    email?: string | null;
    phone?: string | null;
} | null;

export default function AuthStatus() {
    const [user, setUser] = useState<U>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // 1) стартовое состояние
    useEffect(() => {
        let isMounted = true;

        supabase.auth.getUser().then(({data}) => {
            if (!isMounted) return;
            setUser(data.user ? {id: data.user.id, email: data.user.email, phone: data.user.phone} : null);
            setLoading(false);
        });

        // 2) подписка на изменения (в том числе из других вкладок)
        const {data: sub} = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ? {id: session.user.id, email: session.user.email, phone: session.user.phone} : null);
            setLoading(false);
            router.refresh(); // обновим серверные компоненты, если надо
        });

        return () => {
            isMounted = false;
            sub.subscription.unsubscribe();
        };
    }, [router]);

    if (loading) {
        return <div className="text-xs text-gray-400">Проверка авторизации…</div>;
    }

    if (user) {
        const label = user.email ?? user.phone ?? 'Аккаунт';
        return (
            <div className="mt-4 rounded border p-3">
                <div className="text-xs text-gray-500 mb-1">Статус</div>
                <div className="text-sm">Вы вошли как <span className="font-medium">{label}</span></div>
                <button
                    className="mt-2 text-sm border rounded px-3 py-1"
                    onClick={async () => {
                        await supabase.auth.signOut();
                        router.push('/'); // можно оставить router.refresh() если хочешь оставаться на странице
                    }}
                    type="button"
                >
                    Выйти
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4 rounded border p-3">
            <div className="text-xs text-gray-500 mb-1">Статус</div>
            <div className="text-sm mb-2">Вы не авторизованы</div>
            <Link href="/auth/sign-in" className="text-sm border rounded px-3 py-1 inline-block">
                Войти
            </Link>
        </div>
    );
}
