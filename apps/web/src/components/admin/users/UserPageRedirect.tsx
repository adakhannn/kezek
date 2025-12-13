'use client';

import { useEffect } from 'react';

/**
 * Клиентский компонент для проверки существования пользователя
 * Если пользователь не найден (например, был удален), делает редирект
 */
export function UserPageRedirect({ userId, userExists }: { userId: string; userExists: boolean }) {
    useEffect(() => {
        // Если пользователь не найден, немедленно редиректим
        if (!userExists && userId) {
            // Используем replace вместо href, чтобы не добавлять в историю
            window.location.replace('/admin/users');
        }
    }, [userExists, userId]);

    // Если пользователь не найден, не рендерим ничего (редирект уже произошел)
    if (!userExists) {
        return null;
    }

    return null;
}

