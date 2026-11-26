import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ActionBar from '../../components/ui/ActionBar';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField, { FieldGroup } from '../../components/ui/FormField';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { CheckboxRow, SwitchRow } from '../../components/ui/SelectionRow';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { adminApi, adminKeys, type AdminBusinessDetail } from './adminApi';
import { parsePhonesText, slugifyBusinessName } from './adminLogic';
import { AdminQuery, adminErrorText } from './adminUi';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBusinessEdit'>;

/** The profile form of the website's /admin/businesses/[id] (BusinessCardEdit). */
export default function AdminBusinessEditScreen({ navigation, route }: Props) {
    const { bizId } = route.params;
    const detail = useQuery({ queryKey: adminKeys.business(bizId), queryFn: () => adminApi.business(bizId) });
    return (
        <AdminQuery isLoading={detail.isLoading} error={detail.error} onRetry={() => void detail.refetch()} skeleton="form" testID="admin-business-edit">
            {() => <ProfileForm data={detail.data!} onDone={() => navigation.goBack()} />}
        </AdminQuery>
    );
}

function ProfileForm({ data, onDone }: { data: AdminBusinessDetail; onDone: () => void }) {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { business, categoryOptions } = data;
    const [name, setName] = useState(business.name);
    const [slug, setSlug] = useState(business.slug);
    const [slugEdited, setSlugEdited] = useState(false);
    const [address, setAddress] = useState(business.address ?? '');
    const [phonesText, setPhonesText] = useState((business.phones ?? []).join('\n'));
    const [contacts, setContacts] = useState({
        contact_phone: business.contact_phone ?? '',
        contact_whatsapp: business.contact_whatsapp ?? '',
        contact_email: business.contact_email ?? '',
        website_url: business.website_url ?? '',
    });
    const [categories, setCategories] = useState<string[]>(business.categories ?? []);
    const [approved, setApproved] = useState(business.is_approved === true);
    const [nameError, setNameError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const toggleCategory = (value: string) =>
        setCategories((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

    const save = async () => {
        setFormError(null);
        if (!name.trim()) {
            setNameError(t('admin.businessDetail.error.nameRequired'));
            return;
        }
        setSaving(true);
        try {
            await adminApi.updateBusiness(business.id, {
                name: name.trim(),
                slug: slugifyBusinessName(slug || name),
                categories,
                address: address.trim() || null,
                phones: parsePhonesText(phonesText),
                ...contacts,
                is_approved: approved,
            });
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            showToast(t('admin.app.saved'), 'success');
            onDone();
        } catch (error) {
            setFormError(adminErrorText(error, t('admin.businessDetail.error.save'), t));
        } finally {
            setSaving(false);
        }
    };

    const contactField = (field: keyof typeof contacts) => ({
        value: contacts[field],
        onChangeText: (value: string) => setContacts((current) => ({ ...current, [field]: value })),
        autoCapitalize: 'none' as const,
        autoCorrect: false,
    });

    return (
        <Screen
            keyboard
            testID="admin-business-edit"
            footer={<ActionBar primary={{ title: t('admin.businessDetail.save'), onPress: () => void save(), loading: saving, testID: 'admin-business-save' }} />}
        >
            {formError ? <FeedbackBanner variant="danger" message={formError} compact /> : null}

            <FieldGroup title={t('admin.app.group.main')}>
                <FormField
                    label={t('admin.businessDetail.name')}
                    required
                    value={name}
                    maxLength={160}
                    onChangeText={(next) => {
                        setName(next);
                        setNameError(null);
                        if (!slugEdited) setSlug(slugifyBusinessName(next));
                    }}
                    error={nameError ?? undefined}
                    testID="admin-business-name"
                />
                <FormField
                    label={t('admin.businessDetail.slug')}
                    required
                    value={slug}
                    maxLength={80}
                    prefix="/b/"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(next) => { setSlug(next); setSlugEdited(true); }}
                    onBlur={() => setSlug(slugifyBusinessName(slug || name))}
                    testID="admin-business-slug"
                />
                <FormField
                    label={t('admin.businessDetail.address')}
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('admin.businessDetail.address.placeholder')}
                    multiline
                />
                <FormField
                    label={t('admin.businessDetail.phones')}
                    value={phonesText}
                    onChangeText={setPhonesText}
                    placeholder={t('admin.businessDetail.phones.placeholder')}
                    keyboardType="phone-pad"
                    multiline
                />
            </FieldGroup>

            <FieldGroup title={t('admin.app.group.contacts')} caption={t('admin.businessContacts.note')}>
                <FormField label={t('admin.businessContacts.phone')} placeholder="+996..." keyboardType="phone-pad" {...contactField('contact_phone')} />
                <FormField label={t('admin.businessContacts.whatsapp')} placeholder="+996..." keyboardType="phone-pad" {...contactField('contact_whatsapp')} />
                <FormField label={t('admin.businessContacts.email')} placeholder="hello@business.kg" keyboardType="email-address" {...contactField('contact_email')} />
                <FormField label={t('admin.businessContacts.website')} placeholder="https://..." keyboardType="url" {...contactField('website_url')} />
            </FieldGroup>

            <Section title={t('admin.businessDetail.categories')} gap={0}>
                <Card variant="plain" padding="md">
                    {categoryOptions.map((option) => (
                        <CheckboxRow
                            key={option.slug}
                            label={option.name}
                            checked={categories.includes(option.slug)}
                            onChange={() => toggleCategory(option.slug)}
                            testID={`admin-business-category-${option.slug}`}
                        />
                    ))}
                </Card>
            </Section>

            <Card variant="plain" padding="md">
                <SwitchRow
                    label={t('admin.businessDetail.approved')}
                    value={approved}
                    onChange={setApproved}
                    testID="admin-business-approved"
                />
            </Card>
        </Screen>
    );
}
