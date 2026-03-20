import { TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';

type Props = {
    styles: any;
    search: string;
    onChangeSearch: (value: string) => void;
    onClear: () => void;
};

export function HomeSearchSection({ styles, search, onChangeSearch, onClear }: Props) {
    return (
        <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск по названию или адресу..."
                    placeholderTextColor={colors.text.tertiary}
                    value={search}
                    onChangeText={onChangeSearch}
                />
                {search ? (
                    <TouchableOpacity onPress={onClear} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}
