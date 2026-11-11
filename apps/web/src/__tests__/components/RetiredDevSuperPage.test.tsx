jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('NOT_FOUND'); }) }));
import { notFound } from 'next/navigation';
import RetiredDevSuperPage from '@/app/dev/super/page';

test('retired developer privilege page returns not-found without issuing a grant', () => {
    expect(() => RetiredDevSuperPage()).toThrow('NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
});
