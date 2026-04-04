'use client';

import { useState } from 'react';

import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabaseClient';

export default function UpdatePasswordPage() {
    const [pass, setPass] = useState('');
    const toast = useToast();

    async function update() {
        const { error } = await supabase.auth.updateUser({ password: pass });
        if (error) {
            toast.showError(error.message);
            return;
        }
        location.href = '/';
    }

    return (
        <>
            <div className="space-y-2">
                <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ"
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                />
                <button className="w-full rounded border px-3 py-1" onClick={update}>
                    РЎРјРµРЅРёС‚СЊ РїР°СЂРѕР»СЊ
                </button>
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
