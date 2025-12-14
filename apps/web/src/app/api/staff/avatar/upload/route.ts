// apps/web/src/app/api/staff/avatar/upload/route.ts
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { staffId } = await getStaffContext();

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ ok: false, error: 'Файл не предоставлен' }, { status: 400 });
        }

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ ok: false, error: 'Файл должен быть изображением' }, { status: 400 });
        }

        // Проверяем размер (макс 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ ok: false, error: 'Размер файла не должен превышать 5MB' }, { status: 400 });
        }

        const admin = getServiceClient();

        // Получаем текущую аватарку для удаления
        const { data: currentStaff } = await admin
            .from('staff')
            .select('avatar_url')
            .eq('id', staffId)
            .single();

        // Удаляем старую аватарку, если есть
        if (currentStaff?.avatar_url) {
            try {
                const oldPath = currentStaff.avatar_url.split('/').slice(-2).join('/');
                await admin.storage.from('avatars').remove([oldPath]);
            } catch (error) {
                console.warn('Failed to delete old avatar:', error);
            }
        }

        // Генерируем уникальное имя файла
        const fileExt = file.name.split('.').pop();
        const fileName = `${staffId}-${Date.now()}.${fileExt}`;
        const filePath = `staff-avatars/${fileName}`;

        // Конвертируем File в ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Загружаем файл через service client (обходит RLS)
        const { data: uploadData, error: uploadError } = await admin.storage
            .from('avatars')
            .upload(filePath, buffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({ ok: false, error: uploadError.message }, { status: 400 });
        }

        // Получаем публичный URL
        const {
            data: { publicUrl },
        } = admin.storage.from('avatars').getPublicUrl(filePath);

        // Обновляем запись в БД
        const { error: updateError } = await admin
            .from('staff')
            .update({ avatar_url: publicUrl })
            .eq('id', staffId);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, url: publicUrl });
    } catch (error) {
        console.error('Error in avatar upload:', error);
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

