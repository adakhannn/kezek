'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import type React from 'react';

import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    fullWidth?: boolean;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    children: React.ReactNode;
}

const ButtonComponent = (
    {
        className,
        variant = 'primary',
        size = 'md',
        isLoading,
        disabled,
        fullWidth = false,
        leadingIcon,
        trailingIcon,
        children,
        ...props
    }: ButtonProps,
    ref: React.ForwardedRef<HTMLButtonElement>
) => {
    return (
        <button
            ref={ref}
            className={buttonStyles({ variant, size, fullWidth, className })}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span aria-hidden="true">Loading...</span>
                </>
            ) : (
                <>
                    {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
                    <span>{children}</span>
                    {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
                </>
            )}
        </button>
    );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(ButtonComponent);
export { buttonStyles };
export type { ButtonSize, ButtonVariant };

Button.displayName = 'Button';
