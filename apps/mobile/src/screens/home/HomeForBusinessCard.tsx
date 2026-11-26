import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

/** The website home's "Для бизнеса и команды" block: connect a business or join a team. */
export function HomeForBusinessCard() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    return (
        <Card variant="accent" padding="md" style={styles.card} testID="home-for-business">
            <View style={styles.text}>
                <Text style={styles.overline}>{t('parity.workspaces.forBusiness')}</Text>
                <Text style={styles.title}>{t('parity.home.businessTitle')}</Text>
                <Text style={styles.body}>{t('parity.workspaces.forBusinessHint')}</Text>
            </View>
            <Button title={t('parity.workspaces.connectBusiness')} onPress={() => navigation.navigate('BusinessApply')} fullWidth />
            <Button title={t('parity.workspaces.joinBusiness')} onPress={() => navigation.navigate('RoleApply')} variant="ghost" fullWidth />
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { gap: space.md },
    text: { gap: space.xs, marginBottom: space.xs },
    overline: { ...typeScale.overline, color: colors.tone.accent.fg },
    title: { ...typeScale.headline, color: colors.text.primary },
    body: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
});
