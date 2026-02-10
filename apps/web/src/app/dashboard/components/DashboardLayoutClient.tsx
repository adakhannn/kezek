'use client';

import { ErrorDisplay, type ErrorType } from '@/app/_components/ErrorDisplay';

type DashboardLayoutClientProps = {
    errorType: 'NO_BIZ_ACCESS' | 'GENERAL';
    errorMessage?: string;
    diagnostics?: {
        checkedSuperAdmin?: boolean;
        checkedUserRoles?: boolean;
        checkedOwnerId?: boolean;
        userRolesFound?: number;
        eligibleRolesFound?: number;
        ownedBusinessesFound?: number;
        errorsCount?: number;
    };
};

export function DashboardLayoutClient({ errorType, errorMessage, diagnostics }: DashboardLayoutClientProps) {
    // Используем единый компонент ErrorDisplay для консистентности
    return (
        <ErrorDisplay 
            errorType={errorType as ErrorType}
            errorMessage={errorMessage}
            context="dashboard"
            diagnostics={diagnostics}
        />
    );
}
