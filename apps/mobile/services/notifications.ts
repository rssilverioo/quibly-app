import { api } from '../lib/api';

export async function registerPushToken(token: string, platform?: string) {
  return api.post('/notifications/register-token', { token, platform });
}

export async function unregisterPushToken(token: string) {
  return api.delete('/notifications/unregister-token');
}
