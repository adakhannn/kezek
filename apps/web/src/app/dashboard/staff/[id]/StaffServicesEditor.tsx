'use client';

import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabaseClient';

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string;
    name_en?: string;
    duration_min: number;
    branch_id: string;
    active: boolean;
};

export default function StaffServicesEditor({
    staffId,
    staffBranchId,
}: {
    staffId: string;
    staffBranchId: string;
}) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [allowed, setAllowed] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            setErr(null);
            const { data: svc, error: e1 } = await supabase
                .from('services')
                .select('id,name_ru,name_ky,name_en,duration_min,branch_id,active')
                .eq('branch_id', staffBranchId)
                .eq('active', true)
                .order('name_ru');

            const { data: links, error: e2 } = await supabase
                .from('service_staff')
                .select('service_id')
                .eq('staff_id', staffId);

            if (ignore) return;
            if (e1) {
                setErr(e1.message);
                setServices([]);
                setAllowed(new Set());
                setLoading(false);
                return;
            }
            if (e2) {
                setErr(e2.message);
                setServices(svc ?? []);
                setAllowed(new Set());
                setLoading(false);
                return;
            }

            setServices(svc ?? []);
            setAllowed(new Set((links ?? []).map((r) => r.service_id as string)));
            setLoading(false);
        })();

        return () => {
            ignore = true;
        };
    }, [staffId, staffBranchId]);

    async function toggle(serviceId: string) {
        const has = allowed.has(serviceId);
        if (has) {
            const { error } = await supabase
                .from('service_staff')
                .delete()
                .eq('service_id', serviceId)
                .eq('staff_id', staffId);
            if (error) {
                toast.showError(error.message);
                return;
            }
            setAllowed((prev) => {
                const cp = new Set(prev);
                cp.delete(serviceId);
                return cp;
            });
        } else {
            const { error } = await supabase
                .from('service_staff')
                .insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) {
                toast.showError(error.message);
                return;
            }
            setAllowed((prev) => new Set(prev).add(serviceId));
        }
    }

    const getServiceName = (service: Service): string => {
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        return service.name_ru;
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('staff.services.loading', 'Р—Р°РіСЂСѓР·РєР° СѓСЃР»СѓРі...')}
            </div>
        );
    }
    if (err) {
        return (
            <AlertBanner
                variant="danger"
                title={t('staff.services.error', 'РћС€РёР±РєР°')}
                message={err}
            />
        );
    }
    if (services.length === 0) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-2">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            {t('staff.services.empty.title', 'Р’ СЌС‚РѕРј С„РёР»РёР°Р»Рµ РЅРµС‚ Р°РєС‚РёРІРЅС‹С… СѓСЃР»СѓРі')}
                        </p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {t('staff.services.empty.desc', 'РЎРѕР·РґР°Р№С‚Рµ СѓСЃР»СѓРіРё РІ СЂР°Р·РґРµР»Рµ В«РЈСЃР»СѓРіРёВ», С‡С‚РѕР±С‹ РЅР°Р·РЅР°С‡РёС‚СЊ РёС… СЃРѕС‚СЂСѓРґРЅРёРєСѓ')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('staff.services.hint', 'Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіРё, РєРѕС‚РѕСЂС‹Рµ РІС‹РїРѕР»РЅСЏРµС‚ СЌС‚РѕС‚ СЃРѕС‚СЂСѓРґРЅРёРє. РћС‚ РІС‹Р±СЂР°РЅРЅС‹С… СѓСЃР»СѓРі Р·Р°РІРёСЃРёС‚, РєР°РєРёРµ СѓСЃР»СѓРіРё РєР»РёРµРЅС‚С‹ СЃРјРѕРіСѓС‚ РІС‹Р±СЂР°С‚СЊ РїСЂРё Р·Р°РїРёСЃРё Рє СЌС‚РѕРјСѓ СЃРѕС‚СЂСѓРґРЅРёРєСѓ.')}
                </p>
                <div className="grid gap-2">
                    {services.map((s) => {
                        const isChecked = allowed.has(s.id);
                        return (
                            <label
                                key={s.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                                    isChecked
                                        ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggle(s.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                                />
                                <div className="flex-1">
                                    <span className={`text-sm font-medium ${isChecked ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                        {getServiceName(s)}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                        {s.duration_min} РјРёРЅ
                                    </span>
                                </div>
                                {isChecked && (
                                    <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </label>
                        );
                    })}
                </div>
                {allowed.size > 0 && (
                    <p className="border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        {t('staff.services.selected', 'Р’С‹Р±СЂР°РЅРѕ СѓСЃР»СѓРі:')}{' '}
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{allowed.size}</span>{' '}
                        {t('staff.services.selectedOf', 'РёР·')} {services.length}
                    </p>
                )}
            </div>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
