import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getErrorMessage } from '../lib/errors';
import { RootStackParamList } from '../navigation/types';
import { StaffBusinessPicker } from './staff/StaffBusinessPicker';
import { StaffScreenSections } from './staff/StaffScreenSections';
import { useStaffScreenData } from './staff/useStaffScreenData';
import { styles } from './staff/staffScreenStyles';

type StaffScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Shifts'>;

export default function StaffScreen() {
    const navigation = useNavigation<StaffScreenNavigationProp>();
    const {
        staffInfo,
        staffRecords,
        needsSelection,
        selectStaff,
        upcomingBookings,
        loadError,
        isLoading,
        refreshing,
        onRefresh,
    } = useStaffScreenData();
    const [choosingBusiness, setChoosingBusiness] = useState(false);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);

    const handleSelectBusiness = async (staffId: string) => {
        if (selectingId) return;
        setSelectingId(staffId);
        setSelectionError(null);
        try {
            await selectStaff(staffId);
            setChoosingBusiness(false);
        } catch (error) {
            setSelectionError(getErrorMessage(error, 'Не удалось выбрать бизнес. Попробуйте снова.'));
        } finally {
            setSelectingId(null);
        }
    };

    if (isLoading) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (loadError) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="alert-circle"
                    title="Не удалось загрузить рабочую зону"
                    message="Проверьте соединение и попробуйте снова."
                    action={<Button title="Повторить" onPress={() => void onRefresh()} variant="outline" fullWidth />}
                />
            </ScrollView>
        );
    }

    if (needsSelection || (choosingBusiness && staffRecords.length > 1)) {
        return (
            <StaffBusinessPicker
                records={staffRecords}
                currentId={staffInfo?.id ?? null}
                selectingId={selectingId}
                error={selectionError}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onSelect={(staffId) => void handleSelectBusiness(staffId)}
                onCancel={
                    staffInfo
                        ? () => {
                              setChoosingBusiness(false);
                              setSelectionError(null);
                          }
                        : undefined
                }
            />
        );
    }

    if (!staffInfo) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будут отображаться ваши записи после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    return (
        <StaffScreenSections
            staffInfo={staffInfo}
            upcomingBookings={upcomingBookings}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onOpenShiftQuick={() => navigation.navigate('ShiftQuick')}
            onOpenShifts={() => navigation.navigate('Shifts')}
            onChangeBusiness={
                staffRecords.length > 1
                    ? () => {
                          setSelectionError(null);
                          setChoosingBusiness(true);
                      }
                    : undefined
            }
        />
    );
}
