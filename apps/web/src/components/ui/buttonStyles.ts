import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonStyleOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    className?: string;
}

const baseStyles =
    'motion-interactive motion-pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium ' +
    'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

const variants: Record<ButtonVariant, string> = {
    primary:
        'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-inverse)] ' +
        'shadow-[var(--shadow-md)] hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-lg)]',
    secondary:
        'border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-primary)] ' +
        'hover:border-[var(--border-default)] hover:bg-[color:color-mix(in_srgb,var(--surface-emphasis)_72%,white)]',
    outline:
        'border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] ' +
        'hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_88%,transparent)]',
    ghost:
        'bg-transparent text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_70%,transparent)] hover:text-[var(--text-primary)]',
    danger:
        'bg-[var(--status-danger)] text-[var(--text-inverse)] shadow-[var(--shadow-sm)] ' +
        'hover:bg-[color:color-mix(in_srgb,var(--status-danger)_88%,black)] hover:shadow-[var(--shadow-md)]',
};

const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-[36px] min-w-[36px] px-3 py-2 text-sm sm:min-h-[34px] sm:min-w-[34px]',
    md: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm sm:min-h-[40px] sm:min-w-[40px] sm:text-[15px]',
    lg: 'min-h-[48px] min-w-[48px] px-5 py-3 text-base sm:min-h-[44px] sm:min-w-[44px]',
};

export function buttonStyles({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className,
}: ButtonStyleOptions = {}) {
    return clsx(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className);
}
