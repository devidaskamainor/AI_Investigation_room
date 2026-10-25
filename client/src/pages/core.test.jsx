// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateMystery from './CreateMystery.jsx';
import Auth from './Auth.jsx';
import { AuthProvider } from '../lib/auth.jsx';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(element) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>{element}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const response = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => (status < 400 ? { success: true, data } : { success: false, error: data }),
});
describe('M3 forms', () => {
  it('FR-10 rejects a short scenario and exposes an accessible field error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ user: null }));
    setup(<CreateMystery />);
    await userEvent.click(screen.getByRole('button', { name: /Build my mystery/ }));
    expect(screen.getByLabelText('What happened?')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/at least 30/)).toBeInTheDocument();
  });
  it('FR-10 examples populate the scenario and difficulty changes the suspect default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ user: null }));
    setup(<CreateMystery />);
    await userEvent.click(screen.getByRole('button', { name: /The missing artist/ }));
    expect(screen.getByLabelText('What happened?').value.length).toBeGreaterThan(30);
    await userEvent.click(screen.getByRole('radio', { name: /hard/i }));
    expect(screen.getByLabelText('Number of suspects')).toHaveValue('5');
  });
  it('FR-12 sends an idempotency key and disables creation while pending', async () => {
    const calls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (path, opts) => {
      calls.push({ path, opts });
      if (path.endsWith('/auth/csrf')) return response({ csrfToken: 'test-csrf' });
      if (path.endsWith('/mysteries')) return new Promise(() => {});
      return response({ user: null });
    });
    setup(<CreateMystery />);
    await userEvent.click(screen.getByRole('button', { name: /The missing artist/ }));
    await userEvent.click(screen.getByRole('button', { name: /Build my mystery/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Build my mystery/ })).toBeDisabled(),
    );
    await waitFor(() => expect(calls.some((c) => c.opts.headers['Idempotency-Key'])).toBe(true));
  });
  it('FR-01 registration validates email and password before a request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ user: null }));
    setup(<Auth mode="register" />);
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }));
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});
