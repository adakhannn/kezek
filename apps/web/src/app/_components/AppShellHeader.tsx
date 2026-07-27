import { AppShellHeaderFrame } from './AppShellHeaderFrame';
import { AuthStatusServer } from './AuthStatusServer';
import { Logo } from './Logo';
import { MobileHeaderMenu } from './MobileHeaderMenu';
import { RoleAndBusinessSwitcher } from './RoleAndBusinessSwitcher';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

export async function AppShellHeader() {
    return (
        <AppShellHeaderFrame>
            <div className="mx-auto max-w-7xl">
                <div className="relative overflow-visible rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)] shadow-[var(--shadow-lg)] backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.14),transparent_28%)]" />
                    <div className="relative flex min-h-[68px] items-center gap-3 px-4 py-3 sm:min-h-[74px] sm:px-5 lg:px-6">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Logo />
                            <div className="hidden min-w-0 lg:block">
                                <p className="type-label text-[var(--text-primary)]">Kezek</p>
                                <p className="type-caption truncate text-[var(--text-muted)]">
                                    Booking and business workspace
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_76%,transparent)] px-2 py-1 shadow-[var(--shadow-xs)]">
                            <LanguageSwitcher />
                            <RoleAndBusinessSwitcher />
                        </div>

                        <div className="hidden lg:block h-9 w-px bg-[var(--border-subtle)]" />

                        <AuthStatusServer />

                        <div className="lg:hidden shrink-0">
                            <MobileHeaderMenu />
                        </div>
                    </div>
                </div>
            </div>
        </AppShellHeaderFrame>
    );
}
