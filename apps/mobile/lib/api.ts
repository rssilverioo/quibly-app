import { auth } from './firebase';
import { ApiError, NetworkError } from './http-errors';

// Re-exported so callers keep importing error types from `lib/api` as before.
export { ApiError, NetworkError } from './http-errors';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.tryquibly.com';

// Cache token for 50 seconds to avoid repeated getIdToken() on concurrent requests
let cachedToken: string | null = null;
let tokenExpiry = 0;
const TOKEN_CACHE_MS = 50_000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};

  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return { Authorization: `Bearer ${cachedToken}` };
  }

  const token = await user.getIdToken();
  cachedToken = token;
  tokenExpiry = now + TOKEN_CACHE_MS;
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
    ...((options.headers as Record<string, string>) || {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    // `fetch` rejects only when the request never completed. Distinguishing
    // this from an HTTP error is what lets the heartbeat queue hold a beat for
    // later instead of discarding it.
    throw new NetworkError(err);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message || `Request failed: ${res.status}`, body);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Upload failed: ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  },
};
