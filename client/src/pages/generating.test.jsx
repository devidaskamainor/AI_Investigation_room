// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Generating from './Generating.jsx';
vi.mock('../api/client.js', () => ({ api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup(attempts = 0) {
  let retried = false;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === '/mysteries/case-one') return { jobId: 'job-one' };
    if (path === '/generation-jobs/job-one/retry' && options?.method === 'POST') {
      retried = true;
      return { status: 'queued' };
    }
    return {
      id: 'job-one',
      status: retried ? 'planning' : 'failed',
      currentStage: retried ? 'Planning the truth' : 'Generation failed',
      progressPercentage: 5,
      attempts,
      safeErrorMessage: 'Image generation is blocked by your AI provider’s quota.',
    };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mysteries/case-one/generating']}>
        <Routes>
          <Route path="/mysteries/:id/generating" element={<Generating />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('Generation failure recovery', () => {
  it('shows the actual safe failure reason and a retry action', async () => {
    setup();
    expect(
      await screen.findByText('Image generation is blocked by your AI provider’s quota.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
  it('restarts polling after an explicit retry', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/generation-jobs/job-one/retry', { method: 'POST' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Planning the truth')).toBeInTheDocument();
  });
  it('keeps the manual retry limit enforced in the interface', async () => {
    setup(3);
    expect(await screen.findByRole('button', { name: 'Retry limit reached' })).toBeDisabled();
  });
});
