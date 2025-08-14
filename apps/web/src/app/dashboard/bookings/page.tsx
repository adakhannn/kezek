// apps/web/src/app/dashboard/bookings/page.tsx
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import BookingsClient from './view';

export default async function Page() {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
        cookies: {
            get: (n) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });

    // 1) Требуем авторизацию
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/b/kezek');

    // 2) Проверяем супер-админа БЕЗ обращения к таблицам напрямую
    const { data: isSuper, error: eSuper } = await supabase.rpc('is_super_admin');
    if (eSuper) throw eSuper;

    // 3) Определяем bizId
    let bizId: string | undefined;

    if (isSuper) {
        // Супер-админу берём Kezek (или первый бизнес, если Kezek ещё не создан)
        const { data: bizKezek } = await supabase
            .from('businesses')
            .select('id')
            .eq('slug', 'kezek')
            .maybeSingle();

        if (bizKezek?.id) {
            bizId = bizKezek.id;
        } else {
            const { data: anyBiz } = await supabase
                .from('businesses')
                .select('id')
                .limit(1)
                .maybeSingle();
            bizId = anyBiz?.id;
        }
    } else {
        // Обычный доступ: роли текущего юзера
        const { data: roles } = await supabase
            .from('user_roles')
            .select('biz_id,role')
            .eq('user_id', user.id);

        bizId = roles?.find(r => ['owner','manager','staff'].includes(r.role))?.biz_id as string | undefined;
    }

    if (!bizId) {
        return <main className="p-6">Нет доступа к кабинету.</main>;
    }

    // 4) Данные для страницы
    const [{ data: services }, { data: staff }, { data: branches }] = await Promise.all([
        supabase.from('services').select('id,name_ru,duration_min,active').eq('biz_id', bizId).eq('active', true).order('name_ru'),
        supabase.from('staff').select('id,full_name,is_active').eq('biz_id', bizId).eq('is_active', true).order('full_name'),
        supabase.from('branches').select('id,name').eq('biz_id', bizId).eq('is_active', true).order('name'),
    ]);

    const { data: bookings } = await supabase
        .from('bookings')
        .select('id,status,start_at,end_at,services(name_ru),staff(full_name)')
        .eq('biz_id', bizId)
        .order('start_at', { ascending: false })
        .limit(30);

    return (
        <BookingsClient
            bizId={bizId}
            services={services || []}
            staff={staff || []}
            branches={branches || []}
            initial={bookings || []}
        />
    );
}
