import { api } from '../lib/api';

/** O que `GET /users/me/insights` devolve. 403 `PRO_REQUIRED` no grátis. */
export interface Insights {
  /** Últimas 8 semanas, da mais antiga para a atual. `inicio` é a segunda (ISO). */
  semanas: { inicio: string; minutos: number }[];
  /** Últimos 30 dias, maior primeiro. */
  materias: { id: string; nome: string; minutos: number }[];
  /** Hora UTC (0–23) com mais minutos nos últimos 30 dias. `null` sem sessão. */
  melhorHora: { hora: number; minutos: number } | null;
  total30Dias: number;
}

export async function getInsights(): Promise<Insights> {
  return api.get<Insights>('/users/me/insights');
}

/** Converte a hora UTC do servidor para a hora local do aparelho. */
export function horaLocal(horaUtc: number): number {
  const agora = new Date();
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), horaUtc));
  return d.getHours();
}
