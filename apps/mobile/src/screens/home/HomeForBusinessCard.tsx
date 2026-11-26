import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

/** The website home's "Для бизнеса и команды" block: connect a business or join a team. */
export function HomeForBusinessCard() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    return (
        <Card style={styles.card} testID="home-for-business">
            <Text style={styles.badge}>{t('parity.workspaces.forBusiness')}</Text>
            <Text style={styles.title}>{t('parity.home.businessTitle')}</Text>
            <Text style={styles.text}>{t('parity.workspaces.forBusinessHint')}</Text>
            <Button title={t('parity.workspaces.connectBusiness')} onPress={() => navigation.navigate('BusinessApply')} fullWidth />
            <Button title={t('parity.workspaces.joinBusiness')} onPress={() => navigation.navigate('RoleApply')} variant="outline" fullWidth />
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { marginHorizontal: colors.layout.space5, marginVertical: colors.layout.space4, gap: colors.layout.space3 },
    badge: { ...typography.label, color: colors.accent.indigo },
    title: { ...typography.sectionTitle, color: colors.text.primary },
    text: { ...typography.caption, color: colors.text.secondary },
});
