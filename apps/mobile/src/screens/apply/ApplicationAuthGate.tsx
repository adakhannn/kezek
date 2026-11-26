import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { applyStyles as styles } from './applyStyles';

/**
 * The website's sign-in gate of /business/apply: why an account is needed, then the sign-in. The
 * screen stays under the sign-in, so the user is back on the form afterwards.
 */
export function ApplicationAuthGate() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const benefits = [
        ['parity.apply.gate.benefit.application.title', 'parity.apply.gate.benefit.application.description'],
        ['parity.apply.gate.benefit.status.title', 'parity.apply.gate.benefit.status.description'],
        ['parity.apply.gate.benefit.access.title', 'parity.apply.gate.benefit.access.description'],
    ] as const;

    return (
        <Card style={styles.cardGap} testID="application-auth-gate">
            <Text style={styles.sectionTitle}>{t('parity.apply.gate.title')}</Text>
            <Text style={styles.hint}>{t('parity.apply.gate.description')}</Text>
            {benefits.map(([title, description]) => (
                <View key={title} style={styles.benefit}>
                    <View style={styles.benefitIcon}>
                        <Ionicons name="checkmark" size={16} color={colors.status.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.benefitTitle}>{t(title)}</Text>
                        <Text style={styles.muted}>{t(description)}</Text>
                    </View>
                </View>
            ))}
            <Button
                title={t('parity.apply.gate.signIn')}
                onPress={() => navigation.navigate('Auth', { screen: 'SignIn' })}
                fullWidth
            />
            <Text style={styles.muted}>{t('parity.apply.gate.returnHint')}</Text>
        </Card>
    );
}
