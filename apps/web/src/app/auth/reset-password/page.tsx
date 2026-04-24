'use client';

import { useState } from 'react';

import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const toast = useToast();

    async function sendLink() {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/auth/update-password`,
        });

        if (error) {
            toast.showError(error.message);
            return;
        }

        toast.showSuccess(
            'Письмо для восстановления отправлено (если пользователь найден)',
        );
    }

    return (
        <>
            <div className="space-y-2">
                <input
                    className="w-full rounded border px-2 py-1"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <button className="w-full rounded border px-3 py-1" onClick={sendLink}>
                    Отправить ссылку
                </button>
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}

