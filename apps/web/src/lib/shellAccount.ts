/** Cabinets the header offers the signed-in account; computed on the server (lib/shellViewer). */
export type ShellRoles = {
    hasDashboard: boolean;
    hasStaff: boolean;
    hasCabinet: boolean;
    hasAdmin: boolean;
};

/** What the client parts of the header need about the signed-in account. */
export type ShellAccount = {
    userId: string;
    /** Profile name, else the sign-in e-mail or phone; null when there is none. */
    label: string | null;
    roles: ShellRoles;
};
