const BASE = import.meta.env.VITE_API_URL || '/api/v1';
let token;
export class ApiError extends Error {
  constructor(error, status) {
    super(error.message);
    this.code = error.code;
    this.details = error.details || [];
    this.status = status;
  }
}
export async function api(
  path,
  { method = 'GET', body, headers = {}, signal } = {},
  retried = false,
) {
  if (!['GET', 'HEAD'].includes(method) && !token) token = (await api('/auth/csrf')).csrfToken;
  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(!['GET', 'HEAD'].includes(method) ? { 'X-CSRF-Token': token } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: {
      code: 'NETWORK_ERROR',
      message: 'The server could not be reached. Check that the API is running.',
    },
  }));
  if (!response.ok || !payload.success) {
    if (payload.error?.code === 'CSRF_ERROR' && !retried) {
      token = undefined;
      return api(path, { method, body, headers, signal }, true);
    }
    throw new ApiError(
      payload.error || { code: 'NETWORK_ERROR', message: 'Request failed.' },
      response.status,
    );
  }
  if (payload.data?.csrfToken) token = payload.data.csrfToken;
  if (path === '/auth/logout') token = undefined;
  return payload.data;
}
export const assetUrl = (id) => `${BASE}/assets/${id}`;
