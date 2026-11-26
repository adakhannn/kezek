import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { useUserRole } from '../../hooks/useUserRole';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';

/**
 * The website's cabinet banner "У вас также есть доступ к" (CabinetOtherRolesBanner) and its
 * /select-cabinet: the other cabinets of the account open here (the Business and Staff tabs), and
 * the footer's "Подключить бизнес" / "Присоединиться к команде" applications.
 */
export function CabinetWorkspacesBlock() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isBusinessManager, isStaff, isSuperAdmin } = useUserRole();
    const hasOther = isBusinessManager || isStaff;

    return (
        <Card style={styles.card} testID="cabinet-workspaces">
            {hasOther ? (
                <View style={styles.group}>
                    <Text style={styles.title}>{t('parity.workspaces.alsoHasAccess')}</Text>
                    {isBusinessManager ? (
                        <Button
                            title={t('parity.workspaces.dashboard')}
                            onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })}
                            variant="outline"
                            size="sm"
                            fullWidth
                        />
                    ) : null}
                    {isStaff ? (
                        <Button
                            title={t('parity.workspaces.staff')}
                            onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                            variant="outline"
                            size="sm"
                            fullWidth
                        />
                    ) : null}
                </View>
            ) : null}
            {isSuperAdmin ? <Text style={styles.hint}>{t('parity.workspaces.adminOnWeb')}</Text> : null}
            <View style={styles.group}>
                <Text style={styles.title}>{t('parity.workspaces.forBusiness')}</Text>
                <Text style={styles.hint}>{t('parity.workspaces.forBusinessHint')}</Text>
                <Button title={t('parity.workspaces.connectBusiness')} onPress={() => navigation.navigate('BusinessApply')} size="sm" fullWidth />
                <Button title={t('parity.workspaces.joinBusiness')} onPress={() => navigation.navigate('RoleApply')} variant="ghost" size="sm" fullWidth />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { marginHorizontal: colors.layout.space6, marginBottom: colors.layout.space4, gap: colors.layout.space4 },
    group: { gap: colors.layout.space2 },
    title: { ...typography.label, color: colors.text.primary },
    hint: { ...typography.caption, color: colors.text.secondary },
});
