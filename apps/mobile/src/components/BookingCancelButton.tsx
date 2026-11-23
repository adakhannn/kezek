import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';
import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { useConfirm } from '../contexts/ConfirmContext';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import MotionPressable from './ui/MotionPressable';

export default function BookingCancelButton() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { reset } = useBooking();
    const { confirm } = useConfirm();
    const { t } = useLanguage();

    const handleCancel = async () => {
        const shouldCancel = await confirm({
            title: t('cabinet.flowCancel.title'),
            message: t('cabinet.flowCancel.message'),
            confirmLabel: t('cabinet.flowCancel.confirm'),
            cancelLabel: t('cabinet.flowCancel.keep'),
            variant: 'danger',
        });

        if (!shouldCancel) {
            return;
        }

        reset();
        navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
        });
    };

    return (
        <MotionPressable
            style={styles.button}
            onPress={handleCancel}
            accessibilityLabel={t('cabinet.flowCancel.label')}
            accessibilityHint={t('cabinet.flowCancel.hint')}
        >
            <Ionicons name="close" size={24} color={colors.text.primary} />
        </MotionPressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET,
        marginRight: 8,
        borderRadius: colors.layout.radiusSm,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

