// apps/web/src/components/admin/users/UserCreateFormClient.tsx
'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Props = {
    // типизировать Server Action строго можно через experimental types, но здесь оставим попроще
    action: (formData: FormData) => void | Promise<void>;
};

export default function UserCreateFormClient({ action }: Props) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    // когда есть телефон — скрываем и очищаем пароль
    const phoneProvided = useMemo(() => phone.trim().length > 0, [phone]);
    const emailProvided = useMemo(() => email.trim().length > 0, [email]);

    useEffect(() => {
        if (phoneProvided) {
            setPassword(''); // на всякий случай очищаем
        }
    }, [phoneProvided]);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        // Клиентская валидация
        if (!email.trim() && !phone.trim()) {
            setError('Нужен email или телефон');
            return;
        }

        if (email.trim() && (!password.trim() || password.length < 8)) {
            setError('Для email требуется пароль (минимум 8 символов)');
            return;
        }

        const formData = new FormData(e.currentTarget);
        
        startTransition(async () => {
            try {
                await action(formData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Произошла ошибка при создании пользователя');
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Основная информация */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="p-2 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Основная информация</h2>
                </div>

                <div className="space-y-4">
                    <Input
                        name="full_name"
                        label="Полное имя"
                        placeholder="Например: Иван Иванов"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        helperText="Имя пользователя (необязательно)"
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                        <Input
                            name="email"
                            type="email"
                            label="Email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            helperText={phoneProvided ? 'Email необязателен, если указан телефон' : 'Email для входа в систему'}
                        />
                        <Input
                            name="phone"
                            label="Телефон"
                            placeholder="+996555123456"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            helperText="Формат: +996XXXXXXXXX (E.164)"
                        />
                    </div>

                    {/* Пароль показываем только когда email указан И телефона нет */}
                    {!phoneProvided && (
                        <Input
                            name="password"
                            type="password"
                            label="Пароль"
                            placeholder="Минимум 8 символов"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            helperText={emailProvided ? 'Обязателен для входа через email (минимум 8 символов)' : 'Пароль потребуется, если указан email'}
                            disabled={!emailProvided}
                        />
                    )}

                    {/* скрытое поле на случай, если password был скрыт */}
                    {phoneProvided && <input type="hidden" name="password" value="" />}
                </div>
            </div>

            {/* Информационный блок */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-2">Как работает авторизация?</p>
                        <ul className="space-y-1 text-blue-700 dark:text-blue-400">
                            <li>• Если указан <b>email</b> — нужно задать <b>пароль</b> (минимум 8 символов). Вход: email + пароль.</li>
                            <li>• Если указан <b>только телефон</b> — пароль <b>не нужен</b>. Вход по <b>OTP</b>-коду (SMS).</li>
                            <li>• Можно указать и email, и телефон — тогда будут доступны оба способа входа.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Ошибки */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-red-800 dark:text-red-300 text-sm font-medium mb-1">Ошибка</p>
                            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Кнопка отправки */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <a
                    href="/admin/users"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                    Отмена
                </a>
                <Button
                    type="submit"
                    disabled={isPending || (!email.trim() && !phone.trim())}
                    isLoading={isPending}
                    className="min-w-[160px]"
                >
                    {isPending ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Создаём…
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Создать пользователя
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
