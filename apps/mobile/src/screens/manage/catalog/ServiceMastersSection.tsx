import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import Card from '../../../components/ui/Card';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../i18n';
import { getErrorMessage } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { catalogKeys } from './catalogApi';
import { CheckRow, SectionTitle, ui } from './catalogUi';

type Staff = { id: string; full_name: string; branch_id: string; is_active: boolean | null };
type Masters = { staff: Staff[]; allowed: string[] };

/**
 * "Who performs this service" (the website's ServiceMastersEditor): the active staff of the
 * service's branch, each switched on or off in service_staff. Like the website it writes the
 * table directly as the signed-in user, so row-level security decides who may change it.
 */
export function ServiceMastersSection({ bizId, serviceId, branchId }: { bizId: string; serviceId: string; branchId: string }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<string | null>(null);
    const key = catalogKeys.serviceMasters(bizId, serviceId);

    const query = useQuery<Masters>({
        queryKey: key,
        queryFn: async () => {
            const [{ data: staff, error: staffError }, { data: links, error: linksError }] = await Promise.all([
                supabase.from('staff').select('id,full_name,branch_id,is_active').eq('branch_id', branchId).order('full_name'),
                supabase.from('service_staff').select('staff_id').eq('service_id', serviceId),
            ]);
            if (staffError) throw staffError;
            if (linksError) throw linksError;
            return {
                staff: ((staff ?? []) as Staff[]).filter((s) => s.is_active && s.branch_id === branchId),
                allowed: (links ?? []).map((row: { staff_id: string }) => row.staff_id),
            };
        },
    });

    const toggle = async (staffId: string, has: boolean) => {
        setPending(staffId);
        try {
            const { error } = has
                ? await supabase.from('service_staff').delete().eq('service_id', serviceId).eq('staff_id', staffId)
                : await supabase.from('service_staff').insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) throw error;
            queryClient.setQueryData<Masters>(key, (current) => current && ({
                ...current,
                allowed: has ? current.allowed.filter((id) => id !== staffId) : [...current.allowed, staffId],
            }));
        } catch (error) {
            showToast(getErrorMessage(error, t('catalog.app.saveError'), t), 'error');
        } finally {
            setPending(null);
        }
    };

    return (
        <Card padding="md">
            <SectionTitle title={t('catalog.services.masters.title')} />
            {query.isLoading ? (
                <LoadingSpinner size="small" message={t('catalog.services.masters.loading')} />
            ) : query.error ? (
                <Text style={ui.error}>
                    {t('catalog.services.masters.error')} {getErrorMessage(query.error, t('catalog.app.loadError'), t)}
                </Text>
            ) : (query.data?.staff.length ?? 0) === 0 ? (
                <Text style={ui.muted}>{t('catalog.services.masters.empty')}</Text>
            ) : (
                <View>
                    {query.data!.staff.map((member) => {
                        const checked = query.data!.allowed.includes(member.id);
                        return (
                            <CheckRow
                                key={member.id}
                                label={member.full_name}
                                checked={checked}
                                disabled={pending !== null}
                                onChange={() => void toggle(member.id, checked)}
                                testID={`service-master-${member.id}`}
                            />
                        );
                    })}
                </View>
            )}
        </Card>
    );
}
