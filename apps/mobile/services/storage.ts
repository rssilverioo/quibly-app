import type { Profile } from '@quibly/shared';
import { Platform } from 'react-native';

import { api } from '../lib/api';

/**
 * Envia a foto de perfil e devolve o **perfil já atualizado**.
 *
 * ## Por que não devolve só a URL
 *
 * Devolvia, e quem chamava emendava um `updateProfile({ avatar_url })` para
 * gravar. Só que `POST /users/me/avatar` **já grava**: ele sobe o arquivo,
 * escreve `avatarUrl` no perfil e responde o perfil inteiro. A segunda chamada
 * era uma escrita repetida do que o servidor acabara de escrever.
 *
 * E ela falhava. O `ValidationPipe` da API roda com `forbidNonWhitelisted`, e
 * `UpdateProfileDto` aceita `username`, `bio` e `handle` — nada mais. Mandar
 * `avatar_url` ali dava **400**, que a tela transformava em "não deu para
 * enviar a foto". A foto tinha subido; o que quebrou foi o passo a mais.
 *
 * O DTO continua recusando `avatar_url` de propósito: aceitar uma URL crua
 * deixaria qualquer um apontar o próprio avatar para um endereço fora do nosso
 * armazenamento. Quem decide a URL é o upload.
 */
export async function uploadAvatar(
  _userId: string,
  photoUri: string
): Promise<Profile> {
  const formData = new FormData();
  const filename = `avatar_${Date.now()}.jpg`;
  formData.append('file', {
    uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
    type: 'image/jpeg',
    name: filename,
  } as any);

  return api.upload<Profile>('/users/me/avatar', formData);
}
