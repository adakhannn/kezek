import React from 'react';
import { Text, View } from 'react-native';

import Logo from '../../components/Logo';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { typography } from '../../constants/typography';

import { styles } from './homeScreenStyles';

type HeaderProps = {
    showOfflineBanner: boolean;
};

export function HomeScreenHeader({ showOfflineBanner }: HeaderProps) {
    return (
        <>
            <View style={styles.header}>
                <Logo style={styles.logo} />
            </View>

            <View style={styles.heroSection}>
                <Text testID="home-hero-title" style={styles.heroTitle}>
                    Р СњР В°Р в„–Р Т‘Р С‘РЎвЂљР Вµ РЎРѓР Р†Р С•Р в„– РЎРѓР ВµРЎР‚Р Р†Р С‘РЎРѓ
                </Text>
                <Text style={[styles.heroSubtitle, typography.body]}>
                    Р вЂ”Р В°Р С—Р С‘РЎРѓРЎРЉ Р Р† РЎРѓР В°Р В»Р С•Р Р…РЎвЂ№ Р С‘ РЎРѓРЎвЂљРЎС“Р Т‘Р С‘Р С‘ Р С–Р С•РЎР‚Р С•Р Т‘Р В° Р С›РЎв‚¬ Р В·Р В° Р С—Р В°РЎР‚РЎС“ Р С”Р В»Р С‘Р С”Р С•Р Р† - Р В±Р ВµР В· Р В·Р Р†Р С•Р Р…Р С”Р С•Р Р† Р С‘
                    Р С—Р ВµРЎР‚Р ВµР С—Р С‘РЎРѓР С•Р С”
                </Text>
            </View>

            {showOfflineBanner && (
                <View style={styles.offlineBannerWrapper}>
                    <OfflineBanner />
                </View>
            )}
        </>
    );
}
