import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ListRow, { ListGroup } from '../../components/ui/ListRow';
import Section from '../../components/ui/Section';
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
        <>
            {hasOther || isSuperAdmin ? (
                <Section
                    title={t('parity.workspaces.alsoHasAccess')}
                    testID="cabinet-workspaces"
                >
                    {hasOther || isSuperAdmin ? (
                        <ListGroup inset>
                            {isSuperAdmin ? (
                                <ListRow
                                    icon="shield-checkmark-outline"
                                    title={t('admin.app.entry')}
                                    subtitle={t('admin.app.entryHint')}
                                    onPress={() => navigation.navigate('AdminHome')}
                                    testID="cabinet-admin-panel"
                                />
                            ) : null}
                            {isBusinessManager ? (
                                <ListRow
                                    icon="briefcase-outline"
                                    title={t('parity.workspaces.dashboard')}
                                    onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })}
                                />
                            ) : null}
                            {isStaff ? (
                                <ListRow
                                    icon="person-outline"
                                    title={t('parity.workspaces.staff')}
                                    onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                                />
                            ) : null}
                        </ListGroup>
                    ) : null}
                </Section>
            ) : null}

            <Section
                title={t('parity.workspaces.forBusiness')}
                caption={t('parity.workspaces.forBusinessHint')}
                testID={hasOther || isSuperAdmin ? undefined : 'cabinet-workspaces'}
            >
                <ListGroup inset>
                    <ListRow
                        icon="add-circle-outline"
                        title={t('parity.workspaces.connectBusiness')}
                        onPress={() => navigation.navigate('BusinessApply')}
                    />
                    <ListRow
                        icon="people-outline"
                        iconTone="neutral"
                        title={t('parity.workspaces.joinBusiness')}
                        onPress={() => navigation.navigate('RoleApply')}
                    />
                </ListGroup>
            </Section>
        </>
    );
}
