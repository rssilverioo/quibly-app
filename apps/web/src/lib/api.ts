import { auth } from './firebase';

/**
 * A API.
 *
 * O padrão é a **produção**, e não `localhost`. Quando `NEXT_PUBLIC_API_URL`
 * falta no build do site, cair em `localhost:3000` produz "Failed to fetch" no
 * navegador de quem abre o painel — um erro de rede que se lê como "a API está
 * fora", quando na verdade a variável é que não chegou. Errar para o lado da
 * produção deixa o painel funcionando; quem desenvolve local define a variável,
 * e sabe que definiu.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rabbit.tryquibly.com';

async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
