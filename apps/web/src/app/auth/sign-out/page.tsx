'use client';
import {useEffect} from 'react';

import {supabase} from '@/lib/supabaseClient';

export default function SignOutPage() {
    useEffect(() => {
        supabase.auth.signOut().finally(() => (location.href = '/'));
    }, []);
    return <div>Выходим…</div>;
}
