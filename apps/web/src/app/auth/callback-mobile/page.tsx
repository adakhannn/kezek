/** The old browser-to-app token bridge is intentionally retired. Native OAuth
 * returns a PKCE authorization code directly to the initiating installation. */
export default function CallbackMobilePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
            <h1 className="text-xl font-semibold">Начните вход в приложении заново</h1>
            <p>Этот способ входа больше не поддерживается. Обновите приложение и повторите вход.</p>
        </main>
    );
}
