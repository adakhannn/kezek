import { readPlatformAdminStates } from '@/lib/platformAdminState';

const actor = '11111111-1111-4111-8111-111111111111';
const first = '22222222-2222-4222-8222-222222222222';
const second = '33333333-3333-4333-8333-333333333333';

describe('authoritative administrative target flags', () => {
    it('passes the verified actor and deduplicated bounded targets to the service command', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: { [first]: true, [second]: false }, error: null });
        const result = await readPlatformAdminStates({ rpc } as never, actor, [first, second, first]);
        expect(rpc).toHaveBeenCalledWith('read_platform_admin_states', { p_actor_id: actor, p_target_ids: [first, second] });
        expect([...result]).toEqual([[first, true], [second, false]]);
    });
    it.each([null, [], {}, { [first]: 'true' }, { [first]: false, unexpected: true }])('does not turn malformed state %j into an ordinary-user flag', async data => {
        const rpc = jest.fn().mockResolvedValue({ data, error: null });
        await expect(readPlatformAdminStates({ rpc } as never, actor, [first])).rejects.toThrow('Не удалось проверить');
    });
    it('rejects an error even when a complete result is present', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: { [first]: true }, error: { message: 'database unavailable' } });
        await expect(readPlatformAdminStates({ rpc } as never, actor, [first])).rejects.toThrow('Не удалось проверить');
    });
    it('does not query an empty page; rejects missing actor and excessive input locally', async () => {
        const rpc = jest.fn();
        expect((await readPlatformAdminStates({ rpc } as never, actor, [])).size).toBe(0);
        await expect(readPlatformAdminStates({ rpc } as never, '', [first])).rejects.toThrow();
        await expect(readPlatformAdminStates({ rpc } as never, actor, Array.from({ length: 201 }, (_, i) => String(i)))).rejects.toThrow();
        expect(rpc).not.toHaveBeenCalled();
    });
});
