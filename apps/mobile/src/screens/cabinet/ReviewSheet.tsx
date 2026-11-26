import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClientBookingReviewDto } from '@shared-client/types';

import Button from '../../components/ui/Button';
import MotionPressable from '../../components/ui/MotionPressable';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { elevation, layout, radii, space, typeScale } from '../../constants/theme';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { getApiErrorStatus } from '../../lib/errors';
import { submitReview } from '../../lib/reviews';

type Props = {
    visible: boolean;
    bookingId: string;
    existingReview?: ClientBookingReviewDto | null;
    onClose: () => void;
};

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Error text of a failed review: the server's rule (403), a review already there (409), or generic. */
export function reviewErrorKey(error: unknown, editing: boolean): MobileI18nKey {
    const status = getApiErrorStatus(error);
    if (status === 403) return 'cabinet.review.error.notAllowed';
    if (status === 409) return 'cabinet.review.error.alreadyExists';
    return editing ? 'cabinet.review.error.update' : 'cabinet.review.error.submit';
}

/** Leave or edit the review of a past paid visit (C9), like the web ReviewDialog. */
export function ReviewSheet({ visible, bookingId, existingReview, onClose }: Props) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const editing = !!existingReview?.id;
    const [rating, setRating] = useState(existingReview?.rating ?? 5);
    const [comment, setComment] = useState(existingReview?.comment ?? '');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        setRating(existingReview?.rating ?? 5);
        setComment(existingReview?.comment ?? '');
        setError(null);
    }, [visible, existingReview?.id, existingReview?.rating, existingReview?.comment]);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    };

    const mutation = useMutation({
        mutationFn: () => submitReview({ bookingId, rating, comment, existingReviewId: existingReview?.id ?? null }),
        onSuccess: () => {
            refresh();
            showToast(t(editing ? 'cabinet.review.updated' : 'cabinet.review.saved'), 'success');
            onClose();
        },
        onError: (mutationError: unknown) => {
            // A review written meanwhile (another device, the website): reload to edit that one.
            if (getApiErrorStatus(mutationError) === 409) refresh();
            setError(t(reviewErrorKey(mutationError, editing)));
        },
    });

    const busy = mutation.isPending;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { if (!busy) onClose(); }}>
            <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.sheet} testID="review-sheet">
                    <View style={styles.grabber} />
                    <Text style={styles.title}>{t(editing ? 'cabinet.review.edit' : 'cabinet.review.create')}</Text>
                    <Text style={styles.hint}>{t('cabinet.review.description')}</Text>

                    <Text style={styles.label}>{t('cabinet.review.rating')}</Text>
                    <View style={styles.starsRow} accessibilityRole="radiogroup">
                        {RATINGS.map((value) => {
                            const active = value <= rating;
                            return (
                                <MotionPressable
                                    key={value}
                                    onPress={() => setRating(value)}
                                    style={styles.star}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: value === rating }}
                                    accessibilityLabel={t('cabinet.review.ratingStar', { rating: value })}
                                    testID={`review-star-${value}`}
                                >
                                    <Ionicons
                                        name={active ? 'star' : 'star-outline'}
                                        size={30}
                                        color={active ? colors.tone.warning.fg : colors.text.tertiary}
                                    />
                                </MotionPressable>
                            );
                        })}
                    </View>

                    <Text style={styles.label}>{t('cabinet.review.comment')}</Text>
                    <TextInput
                        style={styles.comment}
                        value={comment}
                        onChangeText={setComment}
                        placeholder={t('cabinet.review.commentPlaceholder')}
                        placeholderTextColor={colors.text.tertiary}
                        multiline
                        maxLength={2000}
                        editable={!busy}
                        testID="review-comment"
                    />
                    <Text style={styles.caption}>{t('cabinet.review.commentHint')}</Text>

                    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

                    <View style={styles.actions}>
                        <Button title={t('cabinet.ui.cancel')} variant="outline" onPress={onClose} disabled={busy} style={styles.action} />
                        <Button
                            title={t(editing ? 'cabinet.review.update' : 'cabinet.review.submit')}
                            onPress={() => mutation.mutate()}
                            loading={busy}
                            disabled={busy}
                            style={styles.action}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay },
    sheet: {
        backgroundColor: colors.surface.card,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        paddingHorizontal: layout.gutter,
        paddingTop: space.sm,
        paddingBottom: space.xxl,
        gap: space.sm,
        ...elevation.floating,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.border.strong,
        marginBottom: space.sm,
    },
    title: { ...typeScale.title, color: colors.text.primary },
    hint: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, marginBottom: space.xs },
    label: { ...typeScale.overline, color: colors.text.tertiary, marginTop: space.md },
    starsRow: { flexDirection: 'row', gap: space.xs },
    star: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
    comment: {
        minHeight: 96,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
        padding: space.md,
        ...typeScale.body,
        color: colors.text.primary,
        textAlignVertical: 'top',
    },
    caption: { ...typeScale.caption, color: colors.text.tertiary },
    error: { ...typeScale.callout, fontWeight: '400', color: colors.tone.danger.fg },
    actions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
    action: { flex: 1 },
});
