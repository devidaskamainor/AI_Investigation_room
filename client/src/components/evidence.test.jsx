// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import EvidenceViewer from './EvidenceViewer.jsx';
import { caseFixture } from '../../../server/test/fixtures/case.js';
beforeAll(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(cleanup);
const fixture = caseFixture();
function evidence(key) {
  return {
    ...fixture.evidencePlan.items.find((e) => e.id === key),
    source: { label: 'Gallery archive' },
    content: fixture.evidence[key].content,
  };
}
describe('M6 evidence viewers', () => {
  for (const key of ['E1', 'E3', 'E5', 'E6', 'E7', 'E8'])
    it(`renders ${evidence(key).category} with a fiction notice`, () => {
      render(<EvidenceViewer evidence={evidence(key)} />);
      expect(screen.getByText(/AI-generated fiction/)).toBeInTheDocument();
    });
  it('AC-20 CCTV frame controls advance the caption and scrubber', async () => {
    render(<EvidenceViewer evidence={evidence('E5')} />);
    expect(screen.getByText('AI reconstruction, not real footage')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    expect(screen.getByRole('slider', { name: 'CCTV frame' })).toHaveValue('1');
  });
  it('AC-09 renders model markup as inert plain text', () => {
    const e = evidence('E6');
    e.content = { ...e.content, body: '<img src=x onerror=alert(1)><script>attack()</script>' };
    const { container } = render(<EvidenceViewer evidence={e} />);
    expect(screen.getByText(e.content.body)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
