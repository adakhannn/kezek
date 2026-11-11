global.fetch = jest.fn(() => Promise.reject(new Error('Unmocked shared-client test network request')));
