import React from 'react';
import { Text, View } from 'react-native';

import Logo from '../../components/Logo';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { typography } from '../../constants/typography';
import { useLanguage } from '../../i18n';

import { styles } from './homeScreenStyles';

type HeaderProps = {
    showOfflineBanner: boolean;
};

export function HomeScreenHeader({ showOfflineBanner }: HeaderProps) {
    const { t } = useLanguage();

    return (
        <>
            <View style={styles.header}>
                <Logo style={styles.logo} />
            </View>

            <View style={styles.heroSection}>
                <Text testID="home-hero-title" style={styles.heroTitle}>
                    {t('booking.home.heroTitle')}
                </Text>
                <Text style={[styles.heroSubtitle, typography.body]}>
                    {t('booking.home.heroSubtitle')}
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
