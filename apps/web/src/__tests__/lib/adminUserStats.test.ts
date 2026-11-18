import { parseAdminUserPage, parseAdminUserStats } from '@/lib/adminUserStats';

describe('admin user directory payloads (ARCH-03)', () => {
    test('counts come from one server-side read; a malformed answer is a failure, not zeros', () => {
        expect(parseAdminUserStats({ total: 201, active: 197, blocked: 4, super: 2 })).toEqual({ total: 201, active: 197, blocked: 4, super: 2 });
        expect(() => parseAdminUserStats(null)).toThrow('Unexpected admin_user_stats payload');
        expect(() => parseAdminUserStats({ total: '1', active: 1, blocked: 0, super: 0 })).toThrow();
        expect(() => parseAdminUserStats({ total: -1, active: 0, blocked: 0, super: 0 })).toThrow();
    });

    test('a page keeps the total of all matches and normalizes missing fields', () => {
        const page = parseAdminUserPage({
            total: 75,
            items: [{ id: 'u-1', email: 'a@example.com', phone: null, full_name: 'A', last_sign_in_at: null, is_blocked: true, block_reason: 'spam' }, { id: 'u-2', is_blocked: false }],
        });
        expect(page.total).toBe(75);
        expect(page.items[1]).toEqual({ id: 'u-2', full_name: null, email: null, phone: null, last_sign_in_at: null, is_blocked: false, block_reason: null });
        expect(() => parseAdminUserPage({ total: 1, items: [{ id: 1, is_blocked: false }] })).toThrow('Unexpected admin_list_users row');
        expect(() => parseAdminUserPage({ items: [] })).toThrow('Unexpected admin_list_users payload');
    });
});
