import React from 'react';
import { Text, View } from 'react-native';

import Logo from '../../components/Logo';
import OfflineBanner from '../../components/ui/OfflineBanner';

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
                    РќР°Р№РґРёС‚Рµ СЃРІРѕР№ СЃРµСЂРІРёСЃ
                </Text>
                <Text style={styles.heroSubtitle}>
                    Р—Р°РїРёСЃСЊ РІ СЃР°Р»РѕРЅС‹ Рё СЃС‚СѓРґРёРё РіРѕСЂРѕРґР° РћС€ Р·Р° РїР°СЂСѓ РєР»РёРєРѕРІ - Р±РµР· Р·РІРѕРЅРєРѕРІ Рё
                    РїРµСЂРµРїРёСЃРѕРє
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
