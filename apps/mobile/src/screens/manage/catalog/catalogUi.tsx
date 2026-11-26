import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusPill as KitStatusPill } from '../../../components/ui/Badge';
import ErrorState from '../../../components/ui/ErrorState';
import Screen from '../../../components/ui/Screen';
import { CheckboxRow } from '../../../components/ui/SelectionRow';
import { SkeletonCard, SkeletonList } from '../../../components/ui/Skeleton';
import { colors } from '../../../constants/colors';
import { radii, space, typeScale } from '../../../constants/theme';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';

/** A checkbox line (the website's <input type="checkbox"> with its label): the kit's CheckboxRow. */
export function CheckRow({ label, hint, checked, onChange, disabled, testID }: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    return <CheckboxRow label={label} hint={hint} checked={checked} onChange={onChange} disabled={disabled} testID={testID} />;
}

/** The state of a catalog record (active / hidden) as the kit's status pill. */
export function StatusPill({ active, label }: { active: boolean; label: string }) {
    return <KitStatusPill label={label} tone={active ? 'success' : 'neutral'} />;
}

/**
 * One record of a catalog list: a ListRow (the record, tap to open) on a card, with its own
 * actions under a hairline (the website offers them in the list). Same pattern as the staff list.
 */
export function ItemCard({ children, actions, dimmed, testID }: {
    children: ReactNode;
    actions?: ReactNode;
    dimmed?: boolean;
    testID?: string;
}) {
    return (
        <View style={[ui.item, dimmed ? ui.itemDimmed : null]} testID={testID}>
            {children}
            {actions ? <View style={ui.itemActions}>{actions}</View> : null}
        </View>
    );
}

/** Loading (skeleton), then a failed read with a retry (FE-08: an error, never an empty form). */
export function QueryState({ isLoading, error, onRetry, skeleton = 'list', children }: {
    isLoading: boolean;
    error: unknown;
    onRetry: () => void;
    /** The shape of the page while it loads: a list of rows or a form. */
    skeleton?: 'list' | 'form';
    children: () => ReactNode;
}) {
    const { t } = useLanguage();
    if (isLoading) {
        return (
            <Screen testID="catalog-loading">
                {skeleton === 'list' ? <SkeletonList rows={4} avatar /> : (
                    <>
                        <SkeletonCard lines={2} />
                        <SkeletonCard lines={4} />
                    </>
                )}
            </Screen>
        );
    }
    if (error) {
        return (
            <Screen>
                <ErrorState
                    title={t('catalog.app.loadError')}
                    message={getErrorMessage(error, t('staff.checkConnection'), t)}
                    retryLabel={t('catalog.app.retry')}
                    onRetry={onRetry}
                />
            </Screen>
        );
    }
    return <>{children()}</>;
}

export const ui = StyleSheet.create({
    body: { ...typeScale.body, color: colors.text.primary },
    muted: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    caption: { ...typeScale.caption, color: colors.text.tertiary },
    error: { ...typeScale.caption, color: colors.tone.danger.fg },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle, marginVertical: space.xs },
    pressed: { opacity: colors.interactive.pressedOpacity },
    disabled: { opacity: colors.interactive.disabledOpacity },
    group: { paddingVertical: space.xs },
    list: { gap: space.sm },
    item: {
        backgroundColor: colors.surface.card,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xs,
    },
    itemDimmed: { opacity: 0.75 },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: space.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
        paddingTop: space.xs,
    },
    itemMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingBottom: space.md, marginTop: -space.xs },
    itemMetaText: { ...typeScale.caption, color: colors.text.secondary, flex: 1 },
    dangerText: { color: colors.tone.danger.fg },
});
