// apps/web/src/app/api/staff/avatar/upload/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContext } from '@/lib/authBiz';
import { logDebug, logWarn, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withErrorHandler('StaffAvatarUpload', async () => {
        const { staffId } = await getStaffContext();

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return createErrorResponse('validation', 'Файл не предоставлен', undefined, 400);
        }

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            return createErrorResponse('validation', 'Файл должен быть изображением', undefined, 400);
        }

        // Проверяем размер (макс 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return createErrorResponse('validation', 'Размер файла не должен превышать 5MB', undefined, 400);
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
                logWarn('StaffAvatarUpload', 'Failed to delete old avatar', error);
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
        logDebug('StaffAvatarUpload', 'Uploading file', { filePath, fileSize: file.size, fileType: file.type });
        const { data: uploadData, error: uploadError } = await admin.storage
            .from('avatars')
            .upload(filePath, buffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            logError('StaffAvatarUpload', 'Upload error', uploadError);
            logError('StaffAvatarUpload', 'Error details', { details: JSON.stringify(uploadError, null, 2) });
            // Проверяем, что используется service role
            const isServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ');
            logDebug('StaffAvatarUpload', 'Using service role', { isServiceRole });
            return createErrorResponse('validation', uploadError.message, uploadError, 400);
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
            logError('StaffAvatarUpload', 'Update error', updateError);
            return createErrorResponse('validation', updateError.message, undefined, 400);
        }

        return createSuccessResponse({ url: publicUrl });
    });
}

