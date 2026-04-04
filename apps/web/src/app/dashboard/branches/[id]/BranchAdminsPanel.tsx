'use client';

import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import * as ReactWindow from 'react-window';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

type AdminRow = {
    user_id: string;
    source: 'owner' | 'biz_admin' | 'branch_admin';
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type SearchUser = {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
};

type VirtualizedListProps = {
    height: number;
    itemCount: number;
    itemSize: number;
    width: number | string;
    children: (props: { index: number; style: CSSProperties }) => ReactElement;
};

const VirtualizedList = (
    ReactWindow as unknown as { FixedSizeList: React.ComponentType<VirtualizedListProps> }
).FixedSizeList;

export default function BranchAdminsPanel({ branchId }: { branchId: string }) {
    const toast = useToast();
    const [list, setList] = useState<AdminRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

    const [q, setQ] = useState('');
    const [found, setFound] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    const explicitIds = useMemo(
        () => new Set(list.filter((x) => x.source === 'branch_admin').map((x) => x.user_id)),
        [list],
    );

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(
                `/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/list`,
                { method: 'POST' },
            );
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setList(j.items as AdminRow[]);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function doSearch() {
        setSearching(true);
        setErr(null);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ q }),
            });
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setFound(j.items ?? []);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSearching(false);
        }
    }

    async function add(user_id: string) {
        setErr(null);
        try {
            const res = await fetch(
                `/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/add`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ user_id }),
                },
            );
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            await load();
            toast.showSuccess('РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ РґРѕР±Р°РІР»РµРЅ');
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    async function remove(user_id: string) {
        setErr(null);
        try {
            const res = await fetch(
                `/dashboard/api/branches/${encodeURIComponent(branchId)}/admins/remove`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ user_id }),
                },
            );
            const j = await res.json();
            if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
            await load();
            setConfirmUserId(null);
            toast.showSuccess('РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ СѓР±СЂР°РЅ');
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    useEffect(() => {
        void load();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [list.length]);

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * perPage;
    const endIdx = Math.min(startIdx + perPage, total);
    const pageItems = useMemo(() => list.slice(startIdx, endIdx), [list, startIdx, endIdx]);

    const renderFoundUserRow = ({
        index,
        style,
    }: {
        index: number;
        style: CSSProperties;
    }) => {
        const u = found[index];
        return (
            <div style={style}>
                <div className="border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <div className="grid grid-cols-4 gap-3 px-3 py-3 text-sm">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                            {u.full_name ?? 'вЂ”'}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">{u.email ?? 'вЂ”'}</div>
                        <div className="text-gray-700 dark:text-gray-300">{u.phone ?? 'вЂ”'}</div>
                        <div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => add(u.id)}
                                disabled={explicitIds.has(u.id)}
                                type="button"
                            >
                                {explicitIds.has(u.id) ? 'РЈР¶Рµ РґРѕР±Р°РІР»РµРЅ' : 'Р”РѕР±Р°РІРёС‚СЊ'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂС‹ С„РёР»РёР°Р»Р°
            </h3>

            {err ? <AlertBanner variant="danger" message={err} /> : null}

            <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ
                            </th>
                            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                РСЃС‚РѕС‡РЅРёРє
                            </th>
                            <th className="w-40 p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                Р”РµР№СЃС‚РІРёСЏ
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && (
                            <tr>
                                <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={3}>
                                    Р—Р°РіСЂСѓР·РєР°вЂ¦
                                </td>
                            </tr>
                        )}
                        {!loading && list.length === 0 && (
                            <tr>
                                <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={3}>
                                    РџРѕРєР° РїСѓСЃС‚Рѕ
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            pageItems.map((row) => (
                                <tr
                                    key={`${row.user_id}:${row.source}`}
                                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    <td className="p-4">
                                        <div className="mb-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                                            {row.user_id}
                                        </div>
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                            {row.full_name ?? 'вЂ”'}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {row.email ?? 'вЂ”'}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {row.phone ?? 'вЂ”'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                row.source === 'owner'
                                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : row.source === 'biz_admin'
                                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                            }`}
                                        >
                                            {row.source === 'owner'
                                                ? 'РІР»Р°РґРµР»РµС† Р±РёР·РЅРµСЃР°'
                                                : row.source === 'biz_admin'
                                                  ? 'Р°РґРјРёРЅ Р±РёР·РЅРµСЃР°'
                                                  : 'Р°РґРјРёРЅ С„РёР»РёР°Р»Р°'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {row.source === 'branch_admin' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setConfirmUserId(row.user_id)}
                                                type="button"
                                            >
                                                РЈР±СЂР°С‚СЊ
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                РЅР°СЃР»РµРґРѕРІР°РЅРѕ
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {!loading && total > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        РџРѕРєР°Р·Р°РЅРѕ <span className="font-medium">{startIdx + 1}</span>вЂ“
                        <span className="font-medium">{endIdx}</span> РёР·{' '}
                        <span className="font-medium">{total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            РќР° СЃС‚СЂР°РЅРёС†Рµ
                        </label>
                        <select
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value) || 20)}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>

                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                        >
                            РќР°Р·Р°Рґ
                        </Button>
                        <div className="min-w-[90px] text-center text-sm text-gray-700 dark:text-gray-300">
                            {safePage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                        >
                            Р’РїРµСЂС‘Рґ
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Р”РѕР±Р°РІРёС‚СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° РёР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
                </div>
                <div className="flex gap-3">
                    <Input
                        placeholder="email / С‚РµР»РµС„РѕРЅ / РёРјСЏ"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="flex-1"
                    />
                    <Button onClick={doSearch} disabled={searching} isLoading={searching}>
                        {searching ? 'РС‰РµРјвЂ¦' : 'РќР°Р№С‚Рё'}
                    </Button>
                </div>

                {found.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                            <div className="grid grid-cols-4 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                <div>РРјСЏ</div>
                                <div>Email</div>
                                <div>РўРµР»РµС„РѕРЅ</div>
                                <div className="w-32">Р”РµР№СЃС‚РІРёСЏ</div>
                            </div>
                        </div>
                        {found.length > 50 ? (
                            <VirtualizedList
                                height={224}
                                itemCount={found.length}
                                itemSize={56}
                                width="100%"
                            >
                                {renderFoundUserRow}
                            </VirtualizedList>
                        ) : (
                            <div className="max-h-56 overflow-auto">
                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {found.map((u) => (
                                        <div
                                            key={u.id}
                                            className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <div className="grid grid-cols-4 gap-3 px-3 py-3 text-sm">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {u.full_name ?? 'вЂ”'}
                                                </div>
                                                <div className="text-gray-700 dark:text-gray-300">
                                                    {u.email ?? 'вЂ”'}
                                                </div>
                                                <div className="text-gray-700 dark:text-gray-300">
                                                    {u.phone ?? 'вЂ”'}
                                                </div>
                                                <div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => add(u.id)}
                                                        disabled={explicitIds.has(u.id)}
                                                        type="button"
                                                    >
                                                        {explicitIds.has(u.id)
                                                            ? 'РЈР¶Рµ РґРѕР±Р°РІР»РµРЅ'
                                                            : 'Р”РѕР±Р°РІРёС‚СЊ'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={!!confirmUserId}
                onClose={() => setConfirmUserId(null)}
                onConfirm={() => {
                    if (confirmUserId) {
                        void remove(confirmUserId);
                    }
                }}
                title="РЈР±СЂР°С‚СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°?"
                message="РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРµСЂРµСЃС‚Р°РЅРµС‚ Р±С‹С‚СЊ СЏРІРЅС‹Рј Р°РґРјРёРЅРѕРј СЌС‚РѕРіРѕ С„РёР»РёР°Р»Р°."
                confirmLabel="РЈР±СЂР°С‚СЊ"
                cancelLabel="РћС‚РјРµРЅР°"
                confirmVariant="danger"
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </section>
    );
}


