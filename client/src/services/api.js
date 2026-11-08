const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, token, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(base.includes('ngrok') ? { 'ngrok-skip-browser-warning': '1' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = Array.isArray(data?.details) ? data.details.map(x => `${x.field}: ${x.message}`).join('; ') : '';
      const message = detail || data?.error || (res.status === 429 ? 'Too many requests. Please wait before trying again.' : 'The server could not complete your request.');
      if (token && (res.status === 401 || data?.code === 'ACCOUNT_INACCESSIBLE')) {
        window.dispatchEvent(new CustomEvent('auth:invalid', { detail: { token } }));
      }
      throw new ApiError(message, res.status, data?.code);
    }
    if (!data) throw new ApiError('The API returned an unexpected response. Check the server connection.', res.status);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(error.name === 'AbortError'
      ? 'The request timed out. Please try again.'
      : 'Unable to reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error('Unable to load secure checkout'));

    document.body.appendChild(script);
  });
}