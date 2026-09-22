/**
 * Os coelhos ilustrados — a arte de 22/09/2026, em PNG com alfa, 1254x1254.
 *
 * Duas famílias no mesmo personagem: as poses de contorno forte (love,
 * celebrate, wave, focused, sleepy, checklist, correndo_*) e as de traço
 * suave (reading, working, thinking, listening, searching, graduate, idle,
 * happy, star, break). As chaves são **estados do mascote** sempre que a pose
 * é fiel ao estado — é assim que `components/mascot/ilustracoes.ts` as
 * encontra. As que não são estado (celular_quibly, checklist, correndo_*)
 * servem a telas específicas: login, splash.
 *
 * Resolução: 1254px cobre 150pt em aparelho 3x (450px) com folga. Foi a
 * falta disso, em 10/08, que deixou a tabela de ilustrações vazia.
 *
 * O `require` precisa ser literal: o empacotador do Metro resolve os caminhos
 * em tempo de build, e um `require(variável)` não existe no bundle. Por isso
 * este arquivo é gerado a partir da pasta, e não montado com um laço.
 */
export const COELHOS = {
  break: require('./coelho-break.png'),
  celebrate: require('./coelho-celebrate.png'),
  celular_quibly: require('./coelho-celular-quibly.png'),
  checklist: require('./coelho-checklist.png'),
  correndo_cafe: require('./coelho-correndo-cafe.png'),
  correndo_faixa: require('./coelho-correndo-faixa.png'),
  focused: require('./coelho-focused.png'),
  graduate: require('./coelho-graduate.png'),
  happy: require('./coelho-happy.png'),
  idle: require('./coelho-idle.png'),
  listening: require('./coelho-listening.png'),
  love: require('./coelho-love.png'),
  reading: require('./coelho-reading.png'),
  searching: require('./coelho-searching.png'),
  sleepy: require('./coelho-sleepy.png'),
  star: require('./coelho-star.png'),
  thinking: require('./coelho-thinking.png'),
  wave: require('./coelho-wave.png'),
  working: require('./coelho-working.png'),
} as const;

export type Coelho =
  | 'break'
  | 'celebrate'
  | 'celular_quibly'
  | 'checklist'
  | 'correndo_cafe'
  | 'correndo_faixa'
  | 'focused'
  | 'graduate'
  | 'happy'
  | 'idle'
  | 'listening'
  | 'love'
  | 'reading'
  | 'searching'
  | 'sleepy'
  | 'star'
  | 'thinking'
  | 'wave'
  | 'working';
