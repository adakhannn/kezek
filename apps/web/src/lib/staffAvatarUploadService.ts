import { logDebug, logError, logWarn } from '@/lib/log';

type StaffAvatarUploadInput = {
    admin: any;
    staffId: string;
    bizId: string;
    file: File | null;
};

type StaffAvatarUploadFailure = {
    ok: false;
    status: 400;
    error: 'validation';
    message: string;
    details?: unknown;
};

type StaffAvatarUploadSuccess = {
    ok: true;
    data: {
        url: string;
    };
};

type StaffAvatarUploadResult = StaffAvatarUploadFailure | StaffAvatarUploadSuccess;

export async function runStaffAvatarUpload({
    admin,
    staffId,
    bizId,
    file,
}: StaffAvatarUploadInput): Promise<StaffAvatarUploadResult> {
    if (!file) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Файл не предоставлен',
        };
    }

    if (!file.type.startsWith('image/')) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Файл должен быть изображением',
        };
    }

    if (file.size > 5 * 1024 * 1024) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Размер файла не должен превышать 5MB',
        };
    }

    const { data: currentStaff } = await admin
        .from('staff')
        .select('avatar_url')
        .eq('id', staffId)
        .eq('biz_id', bizId)
        .single();

    await removeOldAvatar(admin, currentStaff?.avatar_url);

    const fileExt = file.name.split('.').pop();
    const fileName = `${staffId}-${Date.now()}.${fileExt}`;
    const filePath = `staff-avatars/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    logDebug('StaffAvatarUploadService', 'Uploading file', {
        filePath,
        fileSize: file.size,
        fileType: file.type,
    });

    const { error: uploadError } = await admin.storage.from('avatars').upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
    });

    if (uploadError) {
        logError('StaffAvatarUploadService', 'Upload error', uploadError);
        logError('StaffAvatarUploadService', 'Error details', {
            details: JSON.stringify(uploadError, null, 2),
        });
        logDebug('StaffAvatarUploadService', 'Using service role', {
            isServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ'),
        });
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: uploadError.message,
            details: uploadError,
        };
    }

    const {
        data: { publicUrl },
    } = admin.storage.from('avatars').getPublicUrl(filePath);

    const { error: updateError } = await admin
        .from('staff')
        .update({ avatar_url: publicUrl })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (updateError) {
        logError('StaffAvatarUploadService', 'Update error', updateError);
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: updateError.message,
        };
    }

    return {
        ok: true,
        data: {
            url: publicUrl,
        },
    };
}

async function removeOldAvatar(admin: any, avatarUrl: string | null | undefined) {
    if (!avatarUrl) {
        return;
    }

    try {
        const oldPath = avatarUrl.split('/').slice(-2).join('/');
        await admin.storage.from('avatars').remove([oldPath]);
    } catch (error) {
        logWarn('StaffAvatarUploadService', 'Failed to delete old avatar', error);
    }
}
