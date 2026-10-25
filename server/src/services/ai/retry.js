export class ProviderError extends Error {
  constructor(code = 'PROVIDER_ERROR', transient = false) {
    super(code);
    this.code = code;
    this.transient = transient;
  }
}
export function classify(error) {
  if (error instanceof ProviderError) return error;
  const status = Number(error.status || error.code);
  const code =
    {
      400: 'PROVIDER_REQUEST_REJECTED',
      401: 'PROVIDER_AUTH_ERROR',
      403: 'PROVIDER_AUTH_ERROR',
      404: 'PROVIDER_MODEL_UNAVAILABLE',
      429: 'PROVIDER_RATE_LIMIT',
    }[status] || 'PROVIDER_ERROR';
  return new ProviderError(
    code,
    status === 429 ||
      status >= 500 ||
      error.name === 'AbortError' ||
      /fetch|network|timeout/i.test(error.message || ''),
  );
}
export async function withRetry(
  operation,
  {
    attempts = 3,
    delays = [1000, 3000, 9000],
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    onRetry = () => {},
  } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!error.transient || attempt === attempts - 1) throw error;
      await onRetry();
      await sleep(delays[attempt] || 9000);
    }
  }
}
export async function deadline(operation, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await operation(controller.signal);
  } catch (e) {
    if (controller.signal.aborted) throw new ProviderError('PROVIDER_TIMEOUT', true);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
