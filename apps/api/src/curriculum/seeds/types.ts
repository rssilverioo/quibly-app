/**
 * A forma de um seed de currículo.
 *
 * O teste de que a arquitetura funcionou (ARCHITECTURE.md §2) é este: **abrir
 * um país novo é adicionar um arquivo aqui e registrá-lo em `index.ts`. Zero
 * código.** Se algum dia um país precisar de uma exceção no runner, a
 * modelagem está errada, não o país.
 */

export interface TopicSeed {
  slug: string;
  name: string;
  /**
   * Quanto o tópico vale na prova, 0–100.
   *
   * Peso e frequência são coisas diferentes e é fácil confundir: peso é
   * *quanto conta* quando cai; frequência é *quão provável* é cair. Um tópico
   * pode valer muito e aparecer pouco (e aí o custo de ignorá-lo é alto mas
   * raro), ou o contrário.
   */
  weight: number;
  /** Em quantas das últimas 10 provas apareceu, 0–10. */
  frequency: number;
}

export interface DisciplineSeed {
  slug: string;
  name: string;
  color: string;
  icon?: string;
  topics: TopicSeed[];
}

export interface TrackSeed {
  slug: string;
  name: string;
  description?: string;
  disciplines: DisciplineSeed[];
}

export interface CountrySeed {
  /** ISO 3166-1 alpha-2. */
  code: string;
  nameEn: string;
  namePt: string;
  locale: string;
  /**
   * De onde vieram os pesos deste arquivo. Vai para `Topic.weightSource` em
   * toda linha, e é obrigatório de propósito: sem isso os números viram
   * folclore em seis meses e ninguém sabe se dá para confiar neles.
   *
   * "Vamos ser cobrados por eles" — o prompt da tarefa, e ele está certo.
   */
  weightSource: string;
  tracks: TrackSeed[];
}
