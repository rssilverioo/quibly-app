import { PrismaClient } from '@prisma/client';
import { CURRICULUM_SEEDS, type CountrySeed } from './seeds';

/**
 * Aplica o currículo ao banco.
 *
 * ## Idempotência, e por que ela não é opcional
 *
 * Este script roda a cada deploy. Se ele não fosse idempotente, cada deploy
 * duplicaria o currículo inteiro — e como `Profile.examTrackId` aponta para uma
 * linha específica, os usuários existentes ficariam apontando para tracks
 * órfãos enquanto os novos veriam duplicatas na lista.
 *
 * A idempotência vem dos `@@unique` naturais, não de "apagar tudo e recriar":
 * `(country, slug)`, `(track, slug)`, `(discipline, slug)`. Um upsert por linha,
 * ancorado numa chave estável. Por isso **renomear um slug é uma operação
 * destrutiva** — cria uma linha nova e abandona a antiga, com os usuários
 * presos nela. Slug é contrato; o `name` é que é livre.
 *
 * ## O que este script não faz
 *
 * Não remove nada. Um tópico tirado do arquivo de seed continua no banco, e
 * isso é deliberado: pode haver `SessionTopic` e `TopicMastery` apontando para
 * ele, e apagar silenciosamente destruiria histórico de estudo real. Aposentar
 * um tópico é uma migration pensada, não um efeito colateral de editar um
 * arquivo.
 */

const prisma = new PrismaClient();

export async function seedCountry(
  db: PrismaClient,
  seed: CountrySeed,
): Promise<{ tracks: number; disciplines: number; topics: number }> {
  await db.country.upsert({
    where: { code: seed.code },
    create: {
      code: seed.code,
      nameEn: seed.nameEn,
      namePt: seed.namePt,
      locale: seed.locale,
    },
    update: { nameEn: seed.nameEn, namePt: seed.namePt, locale: seed.locale },
  });

  let disciplines = 0;
  let topics = 0;

  for (const [trackIndex, track] of seed.tracks.entries()) {
    const trackRow = await db.examTrack.upsert({
      where: { countryCode_slug: { countryCode: seed.code, slug: track.slug } },
      create: {
        countryCode: seed.code,
        slug: track.slug,
        name: track.name,
        description: track.description ?? null,
        sortOrder: trackIndex,
      },
      update: {
        name: track.name,
        description: track.description ?? null,
        sortOrder: trackIndex,
      },
    });

    for (const [dIndex, discipline] of track.disciplines.entries()) {
      const disciplineRow = await db.discipline.upsert({
        where: { trackId_slug: { trackId: trackRow.id, slug: discipline.slug } },
        create: {
          trackId: trackRow.id,
          slug: discipline.slug,
          name: discipline.name,
          color: discipline.color,
          icon: discipline.icon ?? null,
          sortOrder: dIndex,
        },
        update: {
          name: discipline.name,
          color: discipline.color,
          icon: discipline.icon ?? null,
          sortOrder: dIndex,
        },
      });
      disciplines += 1;

      for (const [tIndex, topic] of discipline.topics.entries()) {
        await db.topic.upsert({
          where: { disciplineId_slug: { disciplineId: disciplineRow.id, slug: topic.slug } },
          create: {
            disciplineId: disciplineRow.id,
            slug: topic.slug,
            name: topic.name,
            weight: topic.weight,
            frequency: topic.frequency,
            weightSource: seed.weightSource,
            sortOrder: tIndex,
          },
          update: {
            name: topic.name,
            weight: topic.weight,
            frequency: topic.frequency,
            weightSource: seed.weightSource,
            sortOrder: tIndex,
          },
        });
        topics += 1;
      }
    }
  }

  return { tracks: seed.tracks.length, disciplines, topics };
}

export async function seedCurriculum(db: PrismaClient = prisma): Promise<void> {
  for (const seed of CURRICULUM_SEEDS) {
    const counts = await seedCountry(db, seed);
    console.log(
      `[seed] ${seed.code}: ${counts.tracks} tracks, ` +
        `${counts.disciplines} disciplines, ${counts.topics} topics`,
    );
  }
}

// Só executa quando chamado direto (`npm run seed:curriculum`), nunca quando
// importado por um teste.
if (require.main === module) {
  seedCurriculum()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error('[seed] failed:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
