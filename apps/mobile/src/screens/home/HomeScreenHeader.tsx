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
                    Найдите свой сервис
                </Text>
                <Text style={[styles.heroSubtitle, typography.body]}>
                    Запись в салоны и студии города Ош за пару кликов - без звонков и
                    переписок
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
