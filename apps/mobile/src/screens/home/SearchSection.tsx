import React from 'react';
import { Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Input from '../../components/ui/Input';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';

import { styles } from './homeScreenStyles';

type SearchSectionProps = {
    search: string;
    onSearchChange: (value: string) => void;
    onClear: () => void;
};

export function SearchSection({
    search,
    onSearchChange,
    onClear,
}: SearchSectionProps) {
    const { t } = useLanguage();

    return (
        <Input
            testID="home-search-input"
            containerStyle={{ marginBottom: 0 }}
            placeholder={t('booking.home.searchPlaceholder')}
            value={search}
            onChangeText={onSearchChange}
            returnKeyType="search"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            accessibilityLabel={t('booking.home.searchPlaceholder')}
            leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
            trailingIcon={
                search ? (
                    <MotionPressable
                        onPress={onClear}
                        style={styles.clearButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('booking.home.clearSearch')}
                    >
                        <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                    </MotionPressable>
                ) : null
            }
        />
    );
}
