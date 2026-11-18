import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { styles } from './staffScreenStyles';
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
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            testID="staff-business-picker"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Выберите бизнес</Text>
                <Text style={styles.subtitle}>
                    Вы работаете в нескольких бизнесах. Записи, смена и статистика показываются для выбранного.
                </Text>
            </View>

            <View style={styles.section}>
                {error ? <FeedbackBanner variant="danger" message={error} style={styles.pickerError} /> : null}

                <View style={styles.pickerList}>
                    {records.map((record) => {
                        const businessName = record.business?.name || 'Бизнес';
                        const branchName = record.branch?.name;
                        const isCurrent = record.id === currentId;
                        const isSelecting = record.id === selectingId;

                        return (
                            <MotionPressable
                                key={record.id}
                                onPress={() => onSelect(record.id)}
                                disabled={!!selectingId}
                                accessibilityLabel={branchName ? `${businessName}, ${branchName}` : businessName}
                                accessibilityHint="Открывает рабочую зону этого бизнеса"
                                accessibilityState={{ selected: isCurrent, busy: isSelecting }}
                                style={[styles.pickerOption, isCurrent && styles.pickerOptionCurrent]}
                            >
                                <View style={styles.pickerOptionText}>
                                    <Text style={styles.pickerBusiness}>{businessName}</Text>
                                    {branchName ? <Text style={styles.pickerBranch}>{branchName}</Text> : null}
                                </View>
                                {isSelecting ? (
                                    <ActivityIndicator color={colors.accent.primary} />
                                ) : isCurrent ? (
                                    <Text style={styles.pickerCurrentMark}>Текущий</Text>
                                ) : null}
                            </MotionPressable>
                        );
                    })}
                </View>

                {onCancel ? (
                    <Button
                        title="Отмена"
                        onPress={onCancel}
                        variant="outline"
                        disabled={!!selectingId}
                        fullWidth
                        style={styles.changeBusinessAction}
                    />
                ) : null}
            </View>
        </ScrollView>
    );
}
