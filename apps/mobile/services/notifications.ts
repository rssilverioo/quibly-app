import { getLocales } from 'expo-localization';

import { api } from '../lib/api';

/**
 * Registra o aparelho para receber notificações, **com o idioma dele**.
 *
 * `getLocales()[0]` é o idioma do sistema, e não o escolhido dentro do app. É
 * de propósito: a notificação chega na tela de bloqueio, no meio das de todos
 * os outros apps, e ali quem manda é o idioma do celular. Antes disso o
 * servidor mandava tudo em inglês fixo.
 *
 * Vai em todo registro, não só no primeiro — quem troca o idioma do sistema
 * passa a receber no novo na próxima abertura do app, sem fazer mais nada.
 */
export async function registerPushToken(token: string, platform?: string) {
  const locale = getLocales()[0]?.languageTag;
  return api.post('/notifications/register-token', { token, platform, locale });
}

export async function unregisterPushToken(token: string) {
  return api.delete('/notifications/unregister-token');
}
