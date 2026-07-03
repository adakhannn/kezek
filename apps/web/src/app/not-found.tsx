import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[60vh] w-full max-w-[var(--container-md)] items-center justify-center px-4 py-12">
            <section className="w-full rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-[var(--shadow-md)]">
                <p className="type-caption mb-3 uppercase tracking-[0.2em] text-[var(--text-muted)]">404</p>
                <h1 className="type-page-title text-[var(--text-primary)]">Страница не найдена</h1>
                <p className="type-body mt-3 text-[var(--text-secondary)]">
                    Возможно, ссылка устарела или в адресе есть ошибка. Вернитесь на главную страницу
                    или войдите в аккаунт, чтобы продолжить работу.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-full bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-hover)]"
                    >
                        На главную
                    </Link>
                    <Link
                        href="/auth/sign-in"
                        className="inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                    >
                        Войти
                    </Link>
                </div>
            </section>
        </main>
    );
}
