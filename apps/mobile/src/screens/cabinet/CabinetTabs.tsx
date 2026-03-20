import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from './styles';
import type { CabinetTab } from './types';

export function CabinetTabs({
    activeTab,
    setActiveTab,
}: {
    activeTab: CabinetTab;
    setActiveTab: (tab: CabinetTab) => void;
}) {
    return (
        <View style={styles.tabsContainer}>
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
                onPress={() => setActiveTab('upcoming')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'upcoming' && styles.tabButtonTextActive]}>
                    Предстоящие
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
                onPress={() => setActiveTab('history')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
                    История
                </Text>
            </TouchableOpacity>
        </View>
    );
}
