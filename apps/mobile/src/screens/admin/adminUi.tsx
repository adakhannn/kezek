import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import FormField from '../../components/ui/FormField';
import ErrorState from '../../components/ui/ErrorState';
import Screen from '../../components/ui/Screen';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
import { useUserRole } from '../../hooks/useUserRole';
import { useLanguage, type Translate } from '../../i18n';
import { getApiErrorStatus, getErrorMessage, getRawErrorMessage, isNetworkError } from '../../lib/errors';
import { isReadableServerMessage } from '../manageStaff/errors';
import { reviewHistory } from './adminLogic';

/**
 * The text of a failed admin command, as the website shows it: the server's own answer when it is
 * readable in the app language (a refused delete, a limit, a duplicate slug...), otherwise the
 * app's usual message by status.
 */
export function adminErrorText(error: unknown, fallback: string, t: Translate): string {
    if (isNetworkError(error)) return getErrorMessage(error, fallback, t);
    const status = getApiErrorStatus(error);
    const raw = getRawErrorMessage(error);
    if (status !== 401 && isReadableServerMessage(raw, t.locale)) return raw.trim();
    return getErrorMessage(error, fallback, t);
}

/** The value after it stopped changing for `delay` ms (the website's 250–300 ms search debounce). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return settled;
}

/**
 * Only a global super admin sees the panel (the website's /admin layout: is_super_admin()). The
 * server checks every request again; this keeps the screens from opening for anyone else.
 */
export function withAdminGuard<P extends object>(Component: ComponentType<P>) {
    function AdminGuard(props: P) {
        const { t } = useLanguage();
        const { isSuperAdmin, isLoading } = useUserRole();
        if (isLoading) {
            return (
                <Screen>
                    <SkeletonCard lines={2} />
                    <SkeletonList rows={3} />
                </Screen>
            );
        }
        if (!isSuperAdmin) {
            return (
                <Screen testID="admin-denied">
                    <EmptyState
                        icon="shield-outline"
                        title={t('admin.shell.denied.title')}
                        message={t('admin.app.deniedMessage')}
                    />
                </Screen>
            );
        }
        return <Component {...props} />;
    }
    AdminGuard.displayName = `AdminGuard(${Component.displayName || Component.name || 'Screen'})`;
    return AdminGuard;
}

/** Loading (skeleton), then a failed read with a retry (FE-08: never an empty page), then the content. */
export function AdminQuery({ isLoading, error, onRetry, skeleton = 'list', children, testID }: {
    isLoading: boolean;
    error: unknown;
    onRetry: () => void;
    skeleton?: 'list' | 'form' | 'hub';
    children: () => ReactNode;
    testID?: string;
}) {
    const { t } = useLanguage();
    if (isLoading) {
        return (
            <Screen testID={testID ? `${testID}-loading` : 'admin-loading'}>
                {skeleton === 'list' ? <SkeletonList rows={5} /> : null}
                {skeleton === 'form' ? (
                    <>
                        <SkeletonCard lines={2} />
                        <SkeletonCard lines={4} />
                    </>
                ) : null}
                {skeleton === 'hub' ? (
                    <>
                        <SkeletonCard lines={2} />
                        <SkeletonCard lines={3} />
                        <SkeletonList rows={3} avatar={false} />
                    </>
                ) : null}
            </Screen>
        );
    }
    if (error) {
        return (
            <Screen testID={testID ? `${testID}-error` : 'admin-error'}>
                <ErrorState
                    title={t('ui.error.title')}
                    message={getErrorMessage(error, t('staff.checkConnection'), t)}
                    onRetry={onRetry}
                    testID="admin-retry"
                />
            </Screen>
        );
    }
    return <>{children()}</>;
}

/** The website's ApplicationReviewHistory: earlier submissions of the same applicant, informational. */
export function ReviewHistoryNote({ count, flags }: { count: number; flags: string[] }) {
    const { t } = useLanguage();
    const history = reviewHistory(count, flags);
    if (!history) return null;
    const lines = [
        history.repeated ? t('admin.applicationHistory.repeatNotice') : null,
        history.rejected ? t('admin.applicationHistory.rejected') : null,
        history.other ? t('admin.applicationHistory.other') : null,
    ].filter((line): line is string => !!line);
    return (
        <View style={styles.history} accessibilityRole="summary">
            <Text style={styles.historyTitle}>
                {t(history.repeated ? 'admin.applicationHistory.repeat' : 'admin.applicationHistory.title')}
                {count > 0 ? ` · ${t('admin.applicationHistory.count', { count })}` : ''}
            </Text>
            {lines.map((line) => <Text key={line} style={styles.historyText}>{line}</Text>)}
        </View>
    );
}

/**
 * The website's rejection box: a required reason (up to 1000 characters) and the decisions that
 * use it; each decision stays disabled until the reason is written.
 */
export function ReasonPanel({ value, onChange, placeholder, actions, onCancel, cancelLabel, busy }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    actions: { key: string; title: string; onPress: () => void; danger?: boolean }[];
    onCancel: () => void;
    cancelLabel: string;
    busy: string | null;
}) {
    return (
        <View style={styles.reason}>
            <FormField
                label={placeholder}
                value={value}
                onChangeText={onChange}
                maxLength={1000}
                multiline
                autoFocus
                testID="admin-reason"
            />
            <View style={styles.reasonActions}>
                {actions.map((action) => (
                    <Button
                        key={action.key}
                        title={action.title}
                        onPress={action.onPress}
                        variant={action.danger ? 'danger' : 'outline'}
                        size="sm"
                        loading={busy === action.key}
                        disabled={!value.trim() || !!busy}
                        testID={`admin-reason-${action.key}`}
                    />
                ))}
                <Button title={cancelLabel} onPress={onCancel} variant="ghost" size="sm" disabled={!!busy} />
            </View>
        </View>
    );
}

/** A small "label: value" line inside a card (contacts of an application, meta of a record). */
export function MetaLine({ label, value }: { label: string; value: string }) {
    return (
        <Text style={styles.meta} numberOfLines={2}>
            <Text style={styles.metaLabel}>{label}: </Text>
            {value}
        </Text>
    );
}

export const adminStyles = StyleSheet.create({
    list: { gap: space.sm },
    item: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xs,
    },
    itemPadded: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        padding: space.lg,
        gap: space.md,
    },
    itemDimmed: { opacity: 0.75 },
    itemFoot: { paddingBottom: space.md },
    flex: { flex: 1, minWidth: 0 },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.xs,
    },
    actionsPadded: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.md,
    },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    headline: { ...typeScale.headline, color: colors.text.primary, flexShrink: 1 },
    body: { ...typeScale.body, color: colors.text.primary },
    muted: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    caption: { ...typeScale.caption, color: colors.text.secondary },
    mono: { ...typeScale.caption, color: colors.text.tertiary, fontVariant: ['tabular-nums'] },
    dangerText: { color: colors.tone.danger.fg },
    accentText: { color: colors.tone.accent.fg },
    search: { marginBottom: 0 },
    pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    pageText: { ...typeScale.caption, color: colors.text.secondary },
});

const styles = StyleSheet.create({
    history: {
        gap: space.xs,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.tone.warning.bg,
    },
    historyTitle: { ...typeScale.caption, fontWeight: '600', color: colors.tone.warning.fg },
    historyText: { ...typeScale.caption, color: colors.text.secondary },
    reason: { gap: space.sm },
    reasonActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.sm },
    meta: { ...typeScale.callout, fontWeight: '400', color: colors.text.primary },
    metaLabel: { color: colors.text.secondary },
});
