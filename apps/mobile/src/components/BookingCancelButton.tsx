import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';
import { useConfirm } from '../contexts/ConfirmContext';
import { useBooking } from '../contexts/BookingContext';
import { RootStackParamList } from '../navigation/types';
import MotionPressable from './ui/MotionPressable';

export default function BookingCancelButton() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { reset } = useBooking();
    const { confirm } = useConfirm();

    const handleCancel = async () => {
        const shouldCancel = await confirm({
            title: 'РћС‚РјРµРЅРёС‚СЊ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёРµ?',
            message: 'Р’СЃРµ РІС‹Р±СЂР°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ Р±СѓРґСѓС‚ РїРѕС‚РµСЂСЏРЅС‹.',
            confirmLabel: 'РћС‚РјРµРЅРёС‚СЊ',
            cancelLabel: 'РџСЂРѕРґРѕР»Р¶РёС‚СЊ',
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
        <MotionPressable style={styles.button} onPress={handleCancel}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
        </MotionPressable>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: 8,
        marginRight: 8,
        borderRadius: colors.layout.radiusSm,
    },
});
