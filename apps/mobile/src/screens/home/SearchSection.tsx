import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';

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
            <View style={styles.searchInputContainer}>
                <Ionicons
                    name="search"
                    size={20}
                    color={colors.text.secondary}
                    style={styles.searchIcon}
                />
                <TextInput
                    testID="home-search-input"
                    style={styles.searchInput}
                    placeholder="РџРѕРёСЃРє РїРѕ РЅР°Р·РІР°РЅРёСЋ РёР»Рё Р°РґСЂРµСЃСѓ..."
                    placeholderTextColor={colors.text.tertiary}
                    value={search}
                    onChangeText={onSearchChange}
                />
                {search ? (
                    <TouchableOpacity onPress={onClear} style={styles.clearButton}>
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={colors.text.secondary}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}
