/** @jest-environment jsdom */
import React, { Component } from 'react';
import { render, screen } from '@testing-library/react';
import PerformanceClient from '@/app/admin/performance/PerformanceClient';

class RenderBoundary extends Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>Unexpected render crash</p> : this.props.children; }
}

describe('PerformanceClient standardized response envelope', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; });
  function respond(body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: !(body && typeof body === 'object' && 'ok' in body && body.ok === false), json: async () => body });
    render(<RenderBoundary><PerformanceClient /></RenderBoundary>);
  }
  test('renders a confirmed empty report from data.stats', async () => {
    respond({ ok: true, data: { stats: [], timestamp: 123, status: 'no_data' } });
    expect(await screen.findByText('Нет данных')).toBeTruthy();
    expect(screen.queryByText('Unexpected render crash')).toBeNull();
  });
  test('renders operations from nested data without changing their values', async () => {
    respond({ ok: true, data: { stats: [{ operation: 'test_operation', source: 'server', unit: 'ms', unknownCount: 0, count: 2, avgDuration: 12, minDuration: 10, maxDuration: 14, p95Duration: 14, p99Duration: 14, errorRate: 0 }], timestamp: 123, status: 'observed' } });
    expect(await screen.findByText('test_operation')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
  test('retains forbidden as an error, not empty success', async () => {
    respond({ ok: false, error: 'forbidden' });
    expect(await screen.findByText('forbidden')).toBeTruthy();
    expect(screen.queryByText('Нет данных')).toBeNull();
  });
  test('shows CLS in score units and labels browser data as untrusted and percentiles as approximate', async () => {
    respond({ ok: true, data: { stats: [{ operation: 'CLS', source: 'client', unit: 'score', unknownCount: 0, count: 1, avgDuration: 0.1, minDuration: 0.1, maxDuration: 0.1, p95Duration: 0.1, p99Duration: 0.1, errorRate: 0 }], timestamp: 123, status: 'observed' } });
    expect(await screen.findByText('CLS')).toBeTruthy();
    expect(screen.getByText(/недоверенный источник/)).toBeTruthy();
    expect(screen.getByText('P95 ≈ 0.100')).toBeTruthy();
    expect(screen.queryByText('0.1ms')).toBeNull();
  });
  test('storage unavailable cannot be rendered as an empty healthy response', async () => {
    respond({ ok: false, error: 'service_unavailable' });
    expect(await screen.findByText('service_unavailable')).toBeTruthy();
    expect(screen.queryByText('Нет данных')).toBeNull();
  });
  test.each([{ ok: true }, { ok: true, data: { stats: null, timestamp: 123 } }])('keeps malformed success inline instead of crashing: %j', async body => {
    respond(body);
    expect(await screen.findByText('Invalid performance stats response')).toBeTruthy();
    expect(screen.queryByText('Unexpected render crash')).toBeNull();
  });
});
