import { withLocaleHeader } from '../i18n/locale';
import { apiRequest } from './api';
import { getMobileApiUrl } from './apiUrl';
import { STAFF_ID_HEADER } from './staffSelectionStorage';
import { supabase } from './supabase';

/*
 * The master's own photo: the website's /staff avatar block (StaffAvatarUpload) and its API.
 * POST /api/staff/avatar/upload takes multipart `file` (image/*, at most 5 MB) and answers
 * `{ ok: true, data: { url } }`; POST /api/staff/avatar/remove clears it. Both act as the staff
 * card named by X-Kezek-Staff-Id (a master of several businesses has one card per business).
 */

/** The server's limit (staffAvatarUploadService): 5 × 1024 × 1024 bytes. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarFile = {
    uri: string;
    mimeType?: string | null;
    fileSize?: number | null;
};

export type AvatarCheck = 'ok' | 'notImage' | 'tooLarge';

/** The website's checks before the upload: an image and not over 5 MB (size unknown: the server checks). */
export function checkAvatarFile(file: AvatarFile): AvatarCheck {
    if (file.mimeType && !file.mimeType.startsWith('image/')) return 'notImage';
    if (typeof file.fileSize === 'number' && file.fileSize > MAX_AVATAR_BYTES) return 'tooLarge';
    return 'ok';
}

function extensionOf(mimeType: string): string {
    const subtype = mimeType.split('/')[1]?.toLowerCase() ?? 'jpeg';
    if (subtype === 'jpeg' || subtype === 'jpg') return 'jpg';
    if (subtype === 'heic' || subtype === 'heif') return subtype;
    return subtype.replace(/[^a-z0-9]/g, '') || 'jpg';
}

export class AvatarUploadError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'AvatarUploadError';
    }
}

/**
 * Uploads the (already square-cropped) photo with progress 0..1. XMLHttpRequest, not fetch: only
 * it reports upload progress in React Native. Resolves with the public URL of the new photo.
 */
export async function uploadStaffAvatar(
    staffId: string,
    file: AvatarFile,
    onProgress?: (fraction: number) => void,
): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const mimeType = file.mimeType && file.mimeType.startsWith('image/') ? file.mimeType : 'image/jpeg';
    const form = new FormData();
    // React Native's FormData takes a file as { uri, name, type }.
    form.append('file', { uri: file.uri, name: `avatar-${staffId}.${extensionOf(mimeType)}`, type: mimeType } as unknown as Blob);

    return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getMobileApiUrl()}/api/staff/avatar/upload`);
        const headers = withLocaleHeader({ [STAFF_ID_HEADER]: staffId, Accept: 'application/json' });
        if (token) headers.Authorization = `Bearer ${token}`;
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
        xhr.timeout = 60_000;
        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
            };
        }
        xhr.onload = () => {
            let body: { ok?: boolean; data?: { url?: string }; url?: string; message?: string; error?: string } | null = null;
            try {
                body = JSON.parse(xhr.responseText);
            } catch {
                body = null;
            }
            const url = body?.data?.url ?? body?.url;
            if (xhr.status >= 200 && xhr.status < 300 && body?.ok !== false && url) {
                onProgress?.(1);
                resolve(url);
                return;
            }
            reject(new AvatarUploadError(body?.message || body?.error || `HTTP ${xhr.status}`, xhr.status));
        };
        xhr.onerror = () => reject(new AvatarUploadError('network', 0));
        xhr.ontimeout = () => reject(new AvatarUploadError('timeout', 0));
        xhr.send(form);
    });
}

/** Removes the master's photo (staff.avatar_url becomes empty). */
export async function removeStaffAvatar(staffId: string): Promise<void> {
    await apiRequest<unknown>('/api/staff/avatar/remove', {
        method: 'POST',
        headers: { [STAFF_ID_HEADER]: staffId },
    });
}
