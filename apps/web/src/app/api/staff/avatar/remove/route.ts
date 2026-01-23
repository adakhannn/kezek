// apps/web/src/app/api/staff/avatar/remove/route.ts
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { logError, logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { staffId } = await getStaffContext();

        const admin = getServiceClient();

        // Получаем текущую аватарку
        const { data: currentStaff } = await admin
            .from('staff')
            .select('avatar_url')
            .eq('id', staffId)
            .single();

        if (!currentStaff?.avatar_url) {
            return NextResponse.json({ ok: true, message: 'Аватарка не найдена' });
        }

        // Удаляем файл из storage
        const oldPath = currentStaff.avatar_url.split('/').slice(-2).join('/');
        const { error: removeError } = await admin.storage.from('avatars').remove([oldPath]);

        if (removeError) {
            logWarn('StaffAvatarRemove', 'Failed to delete avatar file', removeError);
            // Продолжаем, даже если удаление файла не удалось
        }

        // Обновляем запись в БД
        const { error: updateError } = await admin
            .from('staff')
            .update({ avatar_url: null })
            .eq('id', staffId);

        if (updateError) {
            logError('StaffAvatarRemove', 'Update error', updateError);
            return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        logError('StaffAvatarRemove', 'Error in avatar remove', error);
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

