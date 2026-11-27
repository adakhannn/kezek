'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { isReachable, summarizeNetworkCheck, type NetworkVerdict, type ProbeResult } from '@/lib/networkCheck/decision';
import {
    CLOUDFLARE_CONTROL_URL,
    probeControl,
    probeServerDns,
    probeSite,
    probeSupabase,
    supabaseProbeUrls,
    type ServerDnsData,
} from '@/lib/networkCheck/probes';

const SUPABASE = supabaseProbeUrls(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

type ProbeId = 'site' | 'rest' | 'auth' | 'control';
type Results = Record<ProbeId, ProbeResult | null>;
type DnsState = { result: ProbeResult; data: ServerDnsData | null } | null;
type DeviceInfo = { siteHost: string; time: string; timeZone: string; userAgent: string; online: boolean; connection: string | null };

const EMPTY: Results = { site: null, rest: null, auth: null, control: null };

function readDevice(): DeviceInfo {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string; type?: string } };
    const connection = [nav.connection?.effectiveType, nav.connection?.type].filter(Boolean).join(' / ') || null;
    let timeZone = '';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* keep empty */ }
    return { siteHost: window.location.host, time: new Date().toISOString(), timeZone, userAgent: nav.userAgent, online: nav.onLine, connection };
}

const VERDICT_STYLES: Record<NetworkVerdict | 'running', string> = {
    reachable: 'bg-[var(--status-success-soft)] text-[var(--status-success)]',
    blockedDns: 'bg-[var(--status-danger-soft)] text-[var(--status-danger)]',
    blockedIp: 'bg-[var(--status-danger-soft)] text-[var(--status-danger)]',
    undetermined: 'bg-[var(--status-warning-soft)] text-[var(--status-warning)]',
    running: 'bg-[var(--status-info-soft)] text-[var(--status-info)]',
};

export default function NetworkCheckClient() {
    const { t } = useLanguage();
    const [results, setResults] = useState<Results>(EMPTY);
    const [dns, setDns] = useState<DnsState>(null);
    const [device, setDevice] = useState<DeviceInfo | null>(null);
    const [running, setRunning] = useState(true);
    const runId = useRef(0);

    const execute = useCallback(async (id: number) => {
        // State is set only after this tick, so the first run started by the effect does not render
        // synchronously inside it.
        await Promise.resolve();
        if (runId.current !== id) return;
        setDevice(readDevice());
        const keep = (probe: ProbeId) => (result: ProbeResult) => {
            if (runId.current === id) setResults((prev) => ({ ...prev, [probe]: result }));
        };
        await Promise.all([
            probeSite().then(keep('site')),
            probeSupabase(SUPABASE?.rest ?? null, ANON_KEY).then(keep('rest')),
            probeSupabase(SUPABASE?.auth ?? null, ANON_KEY).then(keep('auth')),
            probeControl().then(keep('control')),
            probeServerDns().then((value) => { if (runId.current === id) setDns(value); }),
        ]);
        if (runId.current === id) setRunning(false);
    }, []);

    useEffect(() => {
        // The probes run in the browser after the page has loaded; the effect only starts them.
        void execute(++runId.current);
    }, [execute]);

    const retry = () => {
        setResults(EMPTY);
        setDns(null);
        setRunning(true);
        void execute(++runId.current);
    };

    const verdict: NetworkVerdict | 'running' = results.site && results.rest && results.auth
        ? summarizeNetworkCheck({ site: results.site, rest: results.rest, auth: results.auth })
        : 'running';

    const verdictText = (value: NetworkVerdict | 'running'): string => {
        switch (value) {
            case 'reachable': return t('networkCheck.verdict.reachable', 'Supabase доступен');
            case 'blockedDns': return t('networkCheck.verdict.blockedDns', 'Supabase заблокирован: похоже по имени (DNS) или сбросом соединения');
            case 'blockedIp': return t('networkCheck.verdict.blockedIp', 'Supabase заблокирован: похоже по адресу (IP)');
            case 'undetermined': return t('networkCheck.verdict.undetermined', 'Не удалось определить');
            default: return t('networkCheck.verdict.running', 'Идёт проверка…');
        }
    };

    const kindText = (result: ProbeResult): string => {
        switch (result.kind) {
            case 'ok': return t('networkCheck.kind.ok', 'HTTP {status}');
            case 'http': return t('networkCheck.kind.http', 'ответ HTTP {status}');
            case 'opaque': return t('networkCheck.kind.opaque', 'ответ получен (без подробностей)');
            case 'timeout': return t('networkCheck.kind.timeout', 'нет ответа (тайм-аут)');
            case 'network': return t('networkCheck.kind.network', 'ошибка сети');
            default: return t('networkCheck.kind.skipped', 'не настроено');
        }
    };

    const describe = (result: ProbeResult): string => {
        const kind = kindText(result).replace('{status}', String(result.status ?? ''));
        if (result.kind === 'skipped') return kind;
        const ms = isReachable(result)
            ? t('networkCheck.ms', '{ms} мс').replace('{ms}', String(result.ms))
            : t('networkCheck.failedAfter', 'отказ через {ms} мс').replace('{ms}', String(result.ms));
        return `${kind} · ${ms}`;
    };

    const rows: Array<{ id: ProbeId; label: string; host: string }> = [
        { id: 'site', label: t('networkCheck.probe.site', 'Сайт Kezek'), host: device?.siteHost ?? '' },
        { id: 'rest', label: t('networkCheck.probe.rest', 'Supabase REST'), host: SUPABASE ? `${SUPABASE.host}/rest/v1/` : '—' },
        { id: 'auth', label: t('networkCheck.probe.auth', 'Supabase Auth'), host: SUPABASE ? `${SUPABASE.host}/auth/v1/health` : '—' },
        { id: 'control', label: t('networkCheck.probe.control', 'Cloudflare (контроль)'), host: new URL(CLOUDFLARE_CONTROL_URL).host },
    ];

    const state = (result: ProbeResult | null) => {
        if (!result) return <Badge size="sm" variant="info">{t('networkCheck.state.running', 'проверка')}</Badge>;
        return isReachable(result)
            ? <Badge size="sm" variant="success">{t('networkCheck.state.up', 'есть связь')}</Badge>
            : <Badge size="sm" variant="danger">{t('networkCheck.state.down', 'нет связи')}</Badge>;
    };

    const dnsAddresses = dns?.data ? [...dns.data.ipv4, ...dns.data.ipv6] : [];
    const dnsLookupTime = dns?.data
        ? t('networkCheck.dns.serverTime', 'поиск {ms} мс').replace('{ms}', String(dns.data.ms))
        : '';

    return (
        <main className="mx-auto w-full max-w-md space-y-3 px-4 py-4 text-[var(--text-primary)]">
            <div>
                <h1 className="text-lg font-semibold">{t('networkCheck.title', 'Проверка связи Kezek')}</h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    {t('networkCheck.intro', 'Откройте страницу в сети, где Kezek не работает, и пришлите снимок экрана.')}
                </p>
            </div>

            <div role="status" data-verdict={verdict} className={`rounded-[var(--radius-lg)] px-3 py-2 text-base font-semibold ${VERDICT_STYLES[verdict]}`}>
                {verdictText(verdict)}
            </div>

            <Card padding="none">
                <ul className="divide-y divide-[var(--border-subtle)]">
                    {rows.map((row) => {
                        const result = results[row.id];
                        return (
                            <li key={row.id} data-probe={row.id} className="flex items-start justify-between gap-2 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium">{row.label}</div>
                                    <div className="break-all font-mono text-[11px] text-[var(--text-muted)]">{row.host}</div>
                                </div>
                                <div className="shrink-0 text-right">
                                    {state(result)}
                                    {result ? <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{describe(result)}</div> : null}
                                </div>
                            </li>
                        );
                    })}
                    <li data-probe="dns" className="flex items-start justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                            <div className="text-sm font-medium">{t('networkCheck.probe.dns', 'DNS с сервера сайта')}</div>
                            <div className="break-all font-mono text-[11px] text-[var(--text-muted)]">
                                {dns?.data?.host ?? SUPABASE?.host ?? '—'}
                            </div>
                            {dns ? (
                                <div className="break-all font-mono text-[11px] text-[var(--text-secondary)]">
                                    {dnsAddresses.length ? dnsAddresses.join(', ') : t('networkCheck.dns.none', 'адреса не получены')}
                                </div>
                            ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                            {!dns ? state(null) : dns.data ? state(dns.result) : (
                                <Badge size="sm" variant="danger">{t('networkCheck.state.down', 'нет связи')}</Badge>
                            )}
                            {dns ? (
                                <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                    {describe(dns.result)}
                                    {dnsLookupTime ? ` · ${dnsLookupTime}` : ''}
                                </div>
                            ) : null}
                        </div>
                    </li>
                </ul>
            </Card>

            <Card padding="sm">
                <h2 className="mb-1 text-sm font-semibold">{t('networkCheck.device.title', 'Устройство')}</h2>
                {device ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <dt className="text-[var(--text-secondary)]">{t('networkCheck.device.time', 'Время')}</dt>
                        <dd className="break-all font-mono">{device.time}{device.timeZone ? ` (${device.timeZone})` : ''}</dd>
                        <dt className="text-[var(--text-secondary)]">{t('networkCheck.device.online', 'В сети')}</dt>
                        <dd>{device.online ? t('networkCheck.device.yes', 'да') : t('networkCheck.device.no', 'нет')}</dd>
                        <dt className="text-[var(--text-secondary)]">{t('networkCheck.device.connection', 'Соединение')}</dt>
                        <dd>{device.connection ?? t('networkCheck.device.unknown', 'нет данных')}</dd>
                        <dt className="text-[var(--text-secondary)]">{t('networkCheck.device.browser', 'Браузер')}</dt>
                        <dd className="break-all font-mono text-[11px]">{device.userAgent}</dd>
                    </dl>
                ) : null}
            </Card>

            <Button fullWidth onClick={retry} disabled={running}>
                {t('networkCheck.retry', 'Проверить ещё раз')}
            </Button>

            <p className="text-xs text-[var(--text-secondary)]">
                {t('networkCheck.hint', 'Если Supabase заблокирован: на Android включите «Частный DNS» dns.google и проверьте ещё раз. Стало «доступен» — значит, блокировка по DNS.')}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
                {t('networkCheck.privacy', 'Страница ничего не сохраняет и никуда не отправляет, кроме самих проверок.')}
            </p>
        </main>
    );
}
