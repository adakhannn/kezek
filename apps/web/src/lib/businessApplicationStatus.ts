export type BusinessRegistrationApplicationStatus =
    | 'new'
    | 'contacted'
    | 'approved'
    | 'rejected';

export function canModerateBusinessRegistrationApplication(
    status: string | null | undefined,
): boolean {
    return status === 'new' || status === 'contacted';
}
