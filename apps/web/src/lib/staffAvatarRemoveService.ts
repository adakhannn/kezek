import { logError, logWarn } from '@/lib/log';

type StaffAvatarRemoveInput = {
    admin: any;
    staffId: string;
    bizId: string;
};

type StaffAvatarRemoveFailure = {
    ok: false;
    status: 400;
    error: 'validation';
    message: string;
};

type StaffAvatarRemoveSuccess = {
    ok: true;
    data?: {
        message?: string;
    };
};

type StaffAvatarRemoveResult = StaffAvatarRemoveFailure | StaffAvatarRemoveSuccess;

export async function runStaffAvatarRemove({
    admin,
    staffId,
    bizId,
}: StaffAvatarRemoveInput): Promise<StaffAvatarRemoveResult> {
    const { data: currentStaff } = await admin
        .from('staff')
        .select('avatar_url')
        .eq('id', staffId)
        .eq('biz_id', bizId)
        .single();

    if (!currentStaff?.avatar_url) {
        return {
            ok: true,
            data: {
                message: 'Аватарка не найдена',
            },
        };
    }

    const oldPath = currentStaff.avatar_url.split('/').slice(-2).join('/');
    const { error: removeError } = await admin.storage.from('avatars').remove([oldPath]);
    if (removeError) {
        logWarn('StaffAvatarRemoveService', 'Failed to delete avatar file', removeError);
    }

    const { error: updateError } = await admin
        .from('staff')
        .update({ avatar_url: null })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (updateError) {
        logError('StaffAvatarRemoveService', 'Update error', updateError);
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: updateError.message,
        };
    }

    return { ok: true };
}
