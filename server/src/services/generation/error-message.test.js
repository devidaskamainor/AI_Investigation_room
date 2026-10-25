import { describe, it, expect } from 'vitest';
import { publicGenerationError } from './error-message.js';
describe('Player-facing generation failures', () => {
  it('explains image quota failures with a concrete next step', () => {
    expect(publicGenerationError('ASSET_QUOTA_EXCEEDED')).toMatchObject({
      errorCode: 'ASSET_QUOTA_EXCEEDED',
      safeErrorMessage: expect.stringContaining('quota'),
    });
  });
  it('distinguishes timeouts, invalid requests and unavailable models', () => {
    expect(publicGenerationError('PROVIDER_TIMEOUT').safeErrorMessage).toContain('too long');
    expect(publicGenerationError('PROVIDER_REQUEST_REJECTED').safeErrorMessage).toContain(
      'rejected',
    );
    expect(publicGenerationError('PROVIDER_MODEL_UNAVAILABLE').safeErrorMessage).toContain(
      'unavailable',
    );
    expect(publicGenerationError('IMMUTABLE_PLAN_INVALID').safeErrorMessage).toContain('timeline');
  });
  it('never reflects an unknown error code or provider detail', () => {
    expect(publicGenerationError('private-provider-secret')).toEqual({
      errorCode: 'GENERATION_FAILED',
      safeErrorMessage: 'We could not complete this case. Please try again.',
    });
  });
});
