import React from 'react';
import { Text, View } from 'react-native';

import Logo from '../../components/Logo';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { useLanguage } from '../../i18n';

import { styles } from './homeScreenStyles';

type HeaderProps = {
    showOfflineBanner: boolean;
};

/** The brand and one welcome line under the "Главная" header (no second banner or big title block). */
export function HomeScreenHeader({ showOfflineBanner }: HeaderProps) {
    const { t } = useLanguage();

    return (
        <>
            <View style={styles.hero}>
                <Logo style={styles.logo} />
                <Text testID="home-hero-title" style={styles.heroTitle} accessibilityRole="header">
                    {t('booking.home.heroTitle')}
                </Text>
                <Text style={styles.heroSubtitle}>
                    {t('booking.home.heroSubtitle')}
                </Text>
            </View>

            {showOfflineBanner ? <OfflineBanner compact style={{ marginBottom: 0 }} /> : null}
        </>
    );
}
