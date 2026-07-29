import type { CountrySeed } from './types';
import { brazil } from './br';
import { unitedStates } from './us';

/**
 * O registro de países.
 *
 * **Abrir um mercado novo é: criar `xx.ts`, importar aqui, adicionar à lista.**
 * Nenhuma outra linha do sistema muda — nem o runner, nem a API, nem o
 * onboarding, nem o mobile. Esse é o teste concreto de que a decisão
 * arquitetural da ARCHITECTURE.md §2 realmente funcionou; se algum dia um país
 * exigir uma exceção em qualquer outro arquivo, a modelagem está errada.
 */
export const CURRICULUM_SEEDS: CountrySeed[] = [brazil, unitedStates];

export type { CountrySeed, TrackSeed, DisciplineSeed, TopicSeed } from './types';
