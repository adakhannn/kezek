// apps/web/src/types/roles.ts
export type Role = 'owner' | 'manager' | 'staff' | 'admin' | 'client';

export type UserRoleRow = {
    user_id: string;
    biz_id: string;
    role: Role;
};

export type RoleUpsert = { user_id: string; biz_id: string; role: Role };
export type RoleUpdate = { user_id: string; biz_id: string; from_role: Role; to_role: Role };
