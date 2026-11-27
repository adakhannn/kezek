import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import Avatar from '../../components/ui/Avatar';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import { logWarn } from '../../lib/log';
import { checkAvatarFile, removeStaffAvatar, uploadStaffAvatar } from '../../lib/staffAvatar';

type Props = {
    staffId: string;
    name: string;
    avatarUrl: string | null | undefined;
    /** A line under the name (the business and branch). */
    subtitle?: string;
};

type Busy = { kind: 'upload'; progress: number } | { kind: 'remove' } | null;

/**
 * The master's photo in their own cabinet, as on the website's /staff page: pick from the gallery
 * (cropped to a square by the system editor), upload with progress, or remove. Clients see this
 * photo when they choose a master.
 */
export function StaffAvatarEditor({ staffId, name, avatarUrl, subtitle }: Props) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<Busy>(null);
    const [current, setCurrent] = useState<string | null>(avatarUrl ?? null);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => setCurrent(avatarUrl ?? null), [avatarUrl]);

    const refreshCards = () => queryClient.invalidateQueries({ queryKey: ['staff-records'] });

    const pick = async () => {
        if (busy) return;
        setError(null);
        let result: ImagePicker.ImagePickerResult;
        try {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });
        } catch (pickError) {
            logWarn('StaffAvatarEditor', 'Image library failed', pickError);
            setError(t('ui.avatar.uploadFailed'));
            return;
        }
        const asset = result.canceled ? null : result.assets?.[0];
        if (!asset) return;
        const check = checkAvatarFile({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
        if (check !== 'ok') {
            setError(t(check === 'tooLarge' ? 'ui.avatar.tooLarge' : 'ui.avatar.notImage'));
            return;
        }
        setPreview(asset.uri);
        setBusy({ kind: 'upload', progress: 0 });
        try {
            const url = await uploadStaffAvatar(
                staffId,
                { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize },
                (progress) => setBusy({ kind: 'upload', progress }),
            );
            setCurrent(url);
            showToast(t('ui.avatar.uploaded'), 'success');
            await refreshCards();
        } catch (uploadError) {
            logWarn('StaffAvatarEditor', 'Upload failed', uploadError);
            setError(t('ui.avatar.uploadFailed'));
        } finally {
            setPreview(null);
            setBusy(null);
        }
    };

    const remove = async () => {
        if (busy || !current) return;
        const accepted = await confirm({
            title: t('ui.avatar.removeConfirmTitle'),
            message: t('ui.avatar.removeConfirmMessage'),
            confirmLabel: t('ui.avatar.remove'),
            cancelLabel: t('ui.picker.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        setError(null);
        setBusy({ kind: 'remove' });
        try {
            await removeStaffAvatar(staffId);
            setCurrent(null);
            showToast(t('ui.avatar.removed'), 'success');
            await refreshCards();
        } catch (removeError) {
            logWarn('StaffAvatarEditor', 'Remove failed', removeError);
            setError(t('ui.avatar.removeFailed'));
        } finally {
            setBusy(null);
        }
    };

    const percent = busy?.kind === 'upload' ? Math.round(busy.progress * 100) : 0;
    const status = busy?.kind === 'upload'
        ? t('ui.avatar.uploading', { percent: String(percent) })
        : busy?.kind === 'remove' ? t('ui.avatar.removing') : null;

    return (
        <View style={styles.wrap} testID="staff-avatar-editor">
            <Pressable
                onPress={() => void pick()}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={t(current ? 'ui.avatar.change' : 'ui.avatar.upload')}
                accessibilityHint={t('ui.avatar.editHint')}
                accessibilityState={{ disabled: !!busy, busy: !!busy }}
                style={styles.photo}
                testID="staff-avatar-pick"
            >
                <Avatar name={name} uri={preview ?? current} size={88} ring={!!current} />
                {busy ? (
                    <View style={styles.photoOverlay}>
                        <ActivityIndicator color={colors.text.light} />
                    </View>
                ) : (
                    <View style={styles.cameraBadge}>
                        <Ionicons name="camera" size={14} color={colors.text.light} />
                    </View>
                )}
            </Pressable>
            <View style={styles.body}>
                <Text style={styles.name} numberOfLines={2}>{name}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
                {status ? (
                    <View style={styles.progressWrap} accessibilityLiveRegion="polite" testID="staff-avatar-status">
                        <Text style={styles.status}>{status}</Text>
                        {busy?.kind === 'upload' ? (
                            <View style={styles.track}>
                                <View style={[styles.fill, { width: `${Math.max(4, percent)}%` }]} />
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={styles.actions}>
                        <Pressable onPress={() => void pick()} accessibilityRole="button" style={styles.link} testID="staff-avatar-upload">
                            <Text style={styles.linkText}>{t(current ? 'ui.avatar.change' : 'ui.avatar.upload')}</Text>
                        </Pressable>
                        {current ? (
                            <Pressable onPress={() => void remove()} accessibilityRole="button" style={styles.link} testID="staff-avatar-remove">
                                <Text style={[styles.linkText, styles.linkDanger]}>{t('ui.avatar.remove')}</Text>
                            </Pressable>
                        ) : null}
                    </View>
                )}
                {error ? (
                    <Text style={styles.error} accessibilityRole="alert" testID="staff-avatar-error">{error}</Text>
                ) : !current && !busy ? (
                    <Text style={styles.hint}>{t('ui.avatar.hint')}</Text>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    photo: { width: 88, height: 88 },
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.overlay,
    },
    cameraBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent.primary,
        borderWidth: 2,
        borderColor: colors.surface.page,
    },
    body: { flex: 1, minWidth: 0, gap: space.xxs },
    name: { ...typeScale.title, color: colors.text.primary },
    subtitle: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
    link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
    linkText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    linkDanger: { color: colors.tone.danger.fg },
    progressWrap: { gap: space.xs, paddingVertical: space.sm },
    status: { ...typeScale.caption, color: colors.text.secondary },
    track: { height: 4, borderRadius: radii.pill, backgroundColor: colors.fill.track, overflow: 'hidden' },
    fill: { height: 4, borderRadius: radii.pill, backgroundColor: colors.accent.indigo },
    error: { ...typeScale.caption, color: colors.tone.danger.fg },
    hint: { ...typeScale.caption, color: colors.text.tertiary },
});
