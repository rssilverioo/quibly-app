import { api } from '../lib/api';

/** O que se pode denunciar. Espelha `TIPOS_DENUNCIAVEIS` da API. */
export type AlvoDenuncia = 'post' | 'comment' | 'chat_message' | 'profile';

/** Espelha `MOTIVOS` da API. A ordem é a que a folha mostra. */
export const MOTIVOS_DENUNCIA = ['spam', 'harassment', 'nudity', 'violence', 'other'] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];

export interface PessoaBloqueada {
  id: string;
  username: string;
  handle: string;
  avatar_url: string | null;
  blocked_at: string;
}

/**
 * Bloquear e denunciar.
 *
 * Existe porque a Apple exige os dois em qualquer app com conteúdo de usuário
 * (Guideline 1.2). O comportamento vem inteiro do servidor — ver
 * `moderation.service.ts` para o porquê de denunciar não apagar nada.
 */
export const listarBloqueados = () => api.get<PessoaBloqueada[]>('/blocks');

export const bloquear = (userId: string) => api.post<{ blocked: boolean }>(`/blocks/${userId}`);

export const desbloquear = (userId: string) => api.delete<{ blocked: boolean }>(`/blocks/${userId}`);

export const denunciar = (
  alvo: AlvoDenuncia,
  alvoId: string,
  motivo: MotivoDenuncia,
  detalhes?: string,
) =>
  api.post<{ reported: boolean }>('/reports', {
    target_type: alvo,
    target_id: alvoId,
    reason: motivo,
    details: detalhes,
  });
