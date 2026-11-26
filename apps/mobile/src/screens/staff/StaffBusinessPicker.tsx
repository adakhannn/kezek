import { ActivityIndicator } from 'react-native';

import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import type { StaffInfo } from './types';

type Props = {
    records: StaffInfo[];
    currentId: string | null;
    selectingId: string | null;
    error: string | null;
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    onSelect: (staffId: string) => void;
    onCancel?: () => void;
};

/** Choice of the business to work in, for a master with cards in several businesses (ARCH-02). */
export function StaffBusinessPicker({
    records,
    currentId,
    selectingId,
    error,
    refreshing,
    onRefresh,
    onSelect,
    onCancel,
}: Props) {
    const { t } = useLanguage();
    return (
        <Screen tabBar refreshing={refreshing} onRefresh={onRefresh} testID="staff-business-picker">
            <Section title={t('staff.picker.title')} caption={t('staff.picker.subtitle')}>
                {error ? <FeedbackBanner variant="danger" message={error} compact /> : null}
                <ListGroup inset>
                    {records.map((record) => {
                        const businessName = record.business?.name || t('staff.workspace.business');
                        const branchName = record.branch?.name;
                        const isCurrent = record.id === currentId;
                        const isSelecting = record.id === selectingId;
                        return (
                            <ListRow
                                key={record.id}
                                icon="business-outline"
                                iconTone={isCurrent ? 'accent' : 'neutral'}
                                title={businessName}
                                subtitle={branchName ?? undefined}
                                trailing={isSelecting ? (
                                    <ActivityIndicator color={colors.accent.primary} />
                                ) : isCurrent ? (
                                    <Badge label={t('staff.picker.current')} tone="accent" />
                                ) : undefined}
                                chevron={!isCurrent && !isSelecting}
                                onPress={() => onSelect(record.id)}
                                disabled={!!selectingId}
                                accessibilityHint={t('staff.picker.optionHint')}
                            />
                        );
                    })}
                </ListGroup>
            </Section>

            {onCancel ? (
                <Button title={t('staff.cancel')} onPress={onCancel} variant="outline" disabled={!!selectingId} fullWidth />
            ) : null}
        </Screen>
    );
}
