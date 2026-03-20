import { View, Text } from 'react-native';

import Logo from '../../components/Logo';

type Props = {
    styles: any;
};

export function HomeHeroSection({ styles }: Props) {
    return (
        <>
            <View style={styles.header}>
                <Logo style={styles.logo} />
            </View>

            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>Найдите свой сервис</Text>
                <Text style={styles.heroSubtitle}>
                    Запись в салоны и студии города Ош за пару кликов, без звонков и переписок
                </Text>
            </View>
        </>
    );
}
