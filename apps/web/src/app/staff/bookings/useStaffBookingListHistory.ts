'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type ListTab = 'upcoming' | 'past';

// Only this read-only UI filter comes from the URL. Data and permissions still
// come from the server's authenticated staff context.
export function useStaffBookingListHistory(bizId: string, staffId: string) {
    const router = useRouter();
    const query = useSearchParams();
    const sameScope = query.get('staffListBiz') === bizId && query.get('staffListStaff') === staffId;
    const tab: ListTab = sameScope && query.get('staffList') === 'past' ? 'past' : 'upcoming';

    function setTab(nextTab: ListTab) {
        const url = new URL(window.location.href);
        if (nextTab === 'past') {
            url.searchParams.set('staffList', 'past');
            url.searchParams.set('staffListBiz', bizId);
            url.searchParams.set('staffListStaff', staffId);
        } else {
            for (const key of ['staffList', 'staffListBiz', 'staffListStaff']) url.searchParams.delete(key);
        }
        router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }

    return { tab, setTab };
}
