export const colors = {
    brand: {
        primaryFrom: '#4f46e5',
        primaryTo: '#db2777',
        primaryFromStrong: '#4338ca',
        primaryToStrong: '#be185d',
        telegram: '#229ED9',
        whatsapp: '#25D366',
    },
    auth: {
        shellBackground: '#030712',
        shellCardBackground: '#111827',
        shellCardBorder: '#243047',
        methodsDivider: '#243047',
        googleButtonBackground: '#1a2235',
        googleButtonBorder: '#374151',
        telegramButtonBackground: 'rgba(96, 165, 250, 0.16)',
        telegramButtonBorder: '#229ED9',
        telegramButtonText: '#38bdf8',
        telegramStateCardBackground: '#1a2235',
        telegramStateCardBorder: '#243047',
        whatsAppButtonBackground: '#25D366',
        whatsAppButtonBorder: '#25D366',
        whatsAppButtonText: '#0f1522',
    },
    accent: {
        primary: '#4f46e5',
        primaryStrong: '#4338ca',
        secondary: '#db2777',
        secondaryStrong: '#be185d',
        indigo: '#6366f1',
        pink: '#ec4899',
    },

    surface: {
        canvas: '#030712',
        page: '#0b1220',
        card: '#111827',
        elevated: '#1a2235',
        emphasis: '#18213a',
        overlay: 'rgba(3, 7, 18, 0.74)',
    },

    text: {
        primary: '#f3f4f6',
        secondary: '#9ca3af',
        tertiary: '#8692a6',
        muted: '#8692a6',
        light: '#ffffff',
        dark: '#111827',
        inverse: '#0f1522',
        dangerButton: '#111827',
    },

    border: {
        subtle: '#243047',
        light: '#374151',
        dark: '#1f2937',
        strong: '#4b5563',
    },

    separator: {
        subtle: '#243047',
        default: '#374151',
        strong: '#4b5563',
    },

    status: {
        confirmed: '#10b981',
        pending: '#f59e0b',
        cancelled: '#ef4444',
        hold: '#f59e0b',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#60a5fa',
    },

    feedback: {
        successSurface: 'rgba(16, 185, 129, 0.16)',
        warningSurface: 'rgba(245, 158, 11, 0.16)',
        dangerSurface: 'rgba(239, 68, 68, 0.16)',
        infoSurface: 'rgba(96, 165, 250, 0.16)',
    },

    /*
     * Design system (docs/mobile/UI_GUIDE.md). One tone = foreground + translucent fill + border,
     * for badges, banners, stat accents and selected states. Prefer these over raw status colors.
     */
    tone: {
        accent: { fg: '#a5b4fc', bg: 'rgba(99, 102, 241, 0.16)', border: 'rgba(129, 140, 248, 0.45)' },
        success: { fg: '#34d399', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(52, 211, 153, 0.4)' },
        warning: { fg: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(251, 191, 36, 0.4)' },
        danger: { fg: '#f87171', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(248, 113, 113, 0.45)' },
        info: { fg: '#7dd3fc', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(125, 211, 252, 0.4)' },
        neutral: { fg: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
    },

    /** The brand gradient (primary CTA, active avatar ring, hero accents): [from, to]. */
    gradient: {
        accent: ['#4f46e5', '#db2777'] as const,
        accentSoft: ['rgba(79, 70, 229, 0.22)', 'rgba(219, 39, 119, 0.14)'] as const,
    },

    /** Fills of controls inside a surface (inputs, tracks, skeleton blocks, pressed rows). */
    fill: {
        input: '#0f1729',
        track: '#1f2937',
        skeleton: '#1a2235',
        skeletonHighlight: '#243047',
        pressed: 'rgba(148, 163, 184, 0.08)',
        selected: 'rgba(99, 102, 241, 0.14)',
        /** A count pill on a selected (accent-filled) chip or tab. */
        onAccent: 'rgba(255, 255, 255, 0.22)',
    },

    interactive: {
        focusRing: '#7c78ff',
        disabledOpacity: 0.7,
        pressedOpacity: 0.85,
    },

    layout: {
        radiusXs: 6,
        radiusSm: 8,
        radiusMd: 10,
        radiusLg: 16,
        radiusXl: 24,
        space1: 4,
        space2: 8,
        space3: 12,
        space4: 16,
        space5: 20,
        space6: 24,
        space8: 32,
    },

    motion: {
        fast: 120,
        base: 180,
        slow: 280,
    },

    shadow: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
        },
    },

    /*
     * Legacy aliases kept for compatibility during the redesign wave.
     * New work should prefer semantic groups above.
     */
    primary: {
        from: '#4f46e5',
        to: '#db2777',
        hoverFrom: '#4338ca',
        hoverTo: '#be185d',
    },
    background: {
        primary: '#030712',
        secondary: '#111827',
        tertiary: '#1f2937',
        dark: '#111827',
        darkSecondary: '#1f2937',
        gradient: {
            from: '#030712',
            via: '#111827',
            to: 'rgba(30, 27, 75, 0.3)',
        },
    },
};

