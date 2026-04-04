import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Input from '../../components/ui/Input';
import MotionPressable from '../../components/ui/MotionPressable';

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
    return (
        <View style={styles.searchContainer}>
            <Input
                testID="home-search-input"
                containerStyle={{ marginBottom: 0 }}
                inputContainerStyle={styles.searchInputContainer}
                style={styles.searchInput}
                placeholder="Р СџР С•Р С‘РЎРѓР С” Р С—Р С• Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘РЎР‹ Р С‘Р В»Р С‘ Р В°Р Т‘РЎР‚Р ВµРЎРѓРЎС“..."
                value={search}
                onChangeText={onSearchChange}
                leadingIcon={<Ionicons name="search" size={20} color="#9ca3af" />}
                trailingIcon={
                    search ? (
                        <MotionPressable onPress={onClear} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={20} color="#9ca3af" />
                        </MotionPressable>
                    ) : null
                }
            />
        </View>
    );
}
