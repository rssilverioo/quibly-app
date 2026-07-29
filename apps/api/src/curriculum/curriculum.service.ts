import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCountry, type CountryResolutionInput } from './country-resolution';

/**
 * Leitura do currículo, e o que o onboarding faz com ele.
 *
 * ## Cache
 *
 * O currículo muda uma vez por ano, no máximo, e é lido em toda abertura de
 * onboarding e em toda tela de escolha de matéria. Ler do Postgres a cada
 * request é desperdício puro.
 *
 * O cache é em processo e sem invalidação por evento — o TTL de uma hora é a
 * invalidação. Um seed novo leva até uma hora para aparecer, e isso é
 * aceitável para dados que mudam anualmente. Redis aqui seria peso morto: o
 * dataset inteiro cabe em memória e é idêntico em toda instância.
 */
@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly ttlMs: number;

  constructor(private readonly prisma: PrismaService) {
    const configured = Number(process.env.CURRICULUM_CACHE_TTL_MS);
    this.ttlMs = Number.isFinite(configured) && configured >= 0 ? configured : 3_600_000;
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;

    const value = await load();
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  /** Esvazia o cache. Usado pelo endpoint de admin depois de rodar um seed. */
  clearCache(): void {
    this.cache.clear();
  }

  async getCountries() {
    return this.cached('countries', () =>
      this.prisma.country.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { code: true, nameEn: true, namePt: true, locale: true },
      }),
    );
  }

  async getTracks(countryCode: string) {
    const code = countryCode.toUpperCase();
    return this.cached(`tracks:${code}`, () =>
      this.prisma.examTrack.findMany({
        where: { countryCode: code, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, slug: true, name: true, description: true },
      }),
    );
  }

  async getDisciplines(trackId: string) {
    return this.cached(`disciplines:${trackId}`, async () => {
      const track = await this.prisma.examTrack.findUnique({
        where: { id: trackId },
        select: { id: true },
      });
      if (!track) throw new NotFoundException('Exam track not found');

      return this.prisma.discipline.findMany({
        where: { trackId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, slug: true, name: true, color: true, icon: true },
      });
    });
  }

  async getTopics(disciplineId: string) {
    return this.cached(`topics:${disciplineId}`, () =>
      this.prisma.topic.findMany({
        where: { disciplineId },
        orderBy: [{ weight: 'desc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          weight: true,
          frequency: true,
        },
      }),
    );
  }

  /**
   * A sugestão do onboarding. Sugestão, nunca imposição — o cliente mostra
   * todas as opções do país e apenas destaca esta.
   */
  async suggestForUser(input: CountryResolutionInput) {
    const resolution = resolveCountry(input);
    const tracks = await this.getTracks(resolution.country);

    return {
      country_code: resolution.country,
      // Devolvido para o cliente poder registrar em analytics: um pico de
      // `fallback` é o sinal de qual mercado abrir em seguida.
      resolution_source: resolution.source,
      tracks,
      suggested_track_id: tracks[0]?.id ?? null,
    };
  }

  /**
   * Grava a escolha do usuário e popula os `Subject` dele a partir das
   * disciplinas do track.
   *
   * O usuário sai do onboarding com as matérias já criadas — sem essa etapa
   * ele cairia numa tela de sessão pedindo para cadastrar "Matemática" à mão,
   * que é exatamente o atrito que o currículo existe para eliminar.
   */
  async setUserTrack(
    userId: string,
    trackId: string,
    opts: { timezone?: string; examDate?: string } = {},
  ) {
    const track = await this.prisma.examTrack.findUnique({
      where: { id: trackId },
      select: {
        id: true,
        countryCode: true,
        disciplines: {
          orderBy: { sortOrder: 'asc' },
          select: { name: true, color: true, icon: true },
        },
      },
    });

    if (!track) throw new NotFoundException('Exam track not found');

    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        examTrackId: track.id,
        countryCode: track.countryCode,
        ...(opts.timezone ? { timezone: opts.timezone } : {}),
        ...(opts.examDate ? { examDate: new Date(opts.examDate) } : {}),
      },
    });

    // `skipDuplicates` em vez de deletar e recriar: trocar de track não pode
    // apagar matérias que já têm sessões de estudo penduradas nelas. O usuário
    // fica com a união das duas, e limpar é escolha dele.
    const created = await this.prisma.subject.createMany({
      data: track.disciplines.map((d) => ({
        userId,
        name: d.name,
        color: d.color,
        icon: d.icon,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `User ${userId} set track ${track.id}; created ${created.count} subjects`,
    );

    return { track_id: track.id, subjects_created: created.count };
  }
}
