/**
 * Mascot building blocks, drawn on the source SVG's 1024x1024 grid.
 *
 * Everything here is a pure function of the palette so the same rabbit works
 * on the dark app ground and on the cream marketing surface. The drop shadow
 * from the source file is deliberately dropped: `feDropShadow` is unsupported
 * on Android in react-native-svg and renders inconsistently on iOS.
 *
 * ## A grade sobreviveu à troca de mascote
 *
 * Estas peças foram desenhadas para um castelo. Quando ele virou o coelho, o
 * que **não** mudou foi onde cada coisa fica: olhos em y=470, boca em y≈540,
 * braços saindo de (288, 470) e (736, 470), objeto na mão em (812, 272).
 *
 * Isso não é acaso, é o que tornou a troca possível num arquivo só. Os 30
 * estados de `Mascot.tsx` e as ~15 telas que os chamam continuam valendo sem
 * uma linha de mudança, porque a anatomia é um contrato de coordenadas — e o
 * corpo é a única coisa que estava do outro lado dele.
 */
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export const PELO = '#FFFFFF';
/**
 * O azul do contorno do coelho — o mesmo traço das ilustrações da marca.
 *
 * `INK` era o marrom-escuro do castelo, e valia para olhos, boca e traços. No
 * coelho o traço é azul, então a constante trocou de valor e não de papel: um
 * lugar só continua decidindo a cor de tudo que é linha.
 */
export const CONTORNO = '#123E8C';
const INK = CONTORNO;
export const ORELHA_INTERNA = '#BBD5FF';
const TONGUE = '#E8899B';

export interface PartProps {
  /** Brand accent for this palette. */
  accent: string;
}

/**
 * Um membro: contorno azul por baixo, pelo branco por cima.
 *
 * O braço do castelo era um traço marrom só. O coelho é branco, e branco sobre
 * o fundo claro do app desapareceria sem contorno — daí o mesmo caminho ser
 * percorrido duas vezes, o primeiro mais grosso. A mão fecha a ponta pela
 * mesma razão e na mesma ordem.
 */
function Membro({ d, mao }: { d: string; mao: readonly [number, number] }) {
  return (
    <G>
      <Path d={d} fill="none" stroke={CONTORNO} strokeWidth={82} strokeLinecap="round" />
      <Circle cx={mao[0]} cy={mao[1]} r={58} fill={CONTORNO} />
      <Path d={d} fill="none" stroke={PELO} strokeWidth={62} strokeLinecap="round" />
      <Circle cx={mao[0]} cy={mao[1]} r={48} fill={PELO} />
    </G>
  );
}

// ── eyes ────────────────────────────────────────────────────────────────────

export function EyesOpen({ dy = 0, look = 0, rx = 34, ry = 46 }) {
  return (
    <G>
      <Ellipse cx={431 + look} cy={470 + dy} rx={rx} ry={ry} fill={INK} />
      <Ellipse cx={593 + look} cy={470 + dy} rx={rx} ry={ry} fill={INK} />
      <Ellipse cx={442 + look} cy={454 + dy} rx={10} ry={14} fill="#FFFFFF" opacity={0.9} />
      <Ellipse cx={604 + look} cy={454 + dy} rx={10} ry={14} fill="#FFFFFF" opacity={0.9} />
    </G>
  );
}

export const EyesHappy = () => (
  <G fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round">
    <Path d="M397 478 Q431 440 465 478" />
    <Path d="M559 478 Q593 440 627 478" />
  </G>
);

export const EyesShut = () => (
  <G fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round">
    <Path d="M399 472 H463" />
    <Path d="M561 472 H625" />
  </G>
);

export const EyesWink = () => (
  <G>
    <Ellipse cx={431} cy={470} rx={34} ry={46} fill={INK} />
    <Ellipse cx={442} cy={454} rx={10} ry={14} fill="#FFFFFF" opacity={0.9} />
    <Path d="M559 478 Q593 440 627 478" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
  </G>
);

export const EyesDizzy = () => (
  <G fill="none" stroke={INK} strokeWidth={15} strokeLinecap="round">
    <Path d="M408 447 L454 493" /><Path d="M454 447 L408 493" />
    <Path d="M570 447 L616 493" /><Path d="M616 447 L570 493" />
  </G>
);

export const EyesHeart = () => (
  <G fill="#FF5A7A">
    <Path d="M431 500 C398 474, 398 440, 415 436 C427 433, 431 445, 431 445 C431 445, 435 433, 447 436 C464 440, 464 474, 431 500 Z" />
    <Path d="M593 500 C560 474, 560 440, 577 436 C589 433, 593 445, 593 445 C593 445, 597 433, 609 436 C626 440, 626 474, 593 500 Z" />
  </G>
);

// ── mouths ──────────────────────────────────────────────────────────────────

export const MouthSmile = () => (
  <G>
    <Path d="M456 535 Q512 585 568 535" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
    <Path d="M485 553 Q512 575 539 553" fill={TONGUE} />
  </G>
);

export const MouthGrin = () => (
  <G>
    <Path d="M440 528 Q512 615 584 528 Z" fill={INK} />
    <Path d="M470 566 Q512 600 554 566 Z" fill={TONGUE} />
  </G>
);

export const MouthO = () => (
  <G>
    <Ellipse cx={512} cy={538} rx={26} ry={31} fill={INK} />
    <Ellipse cx={512} cy={546} rx={13} ry={15} fill={TONGUE} />
  </G>
);

export const MouthFlat = () => (
  <Path d="M466 552 H558" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
);

export const MouthFrown = () => (
  <Path d="M456 570 Q512 522 568 570" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
);

export const MouthSmirk = () => (
  <Path d="M462 548 Q512 578 566 534" fill="none" stroke={INK} strokeWidth={18} strokeLinecap="round" />
);

export const MouthWobble = () => (
  <Path
    d="M458 552 Q483 528 508 552 Q533 576 558 552"
    fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round"
  />
);

// ── arms ────────────────────────────────────────────────────────────────────
// Each pose returns limbs and hands together; the hand caps the arm path.

export const ArmsRest = () => (
  <G>
    <Membro d="M288 470 C220 500, 215 610, 285 650" mao={[272, 655]} />
    <Membro d="M736 470 C804 500, 809 610, 739 650" mao={[752, 655]} />
  </G>
);

export const ArmsUp = () => (
  <G>
    <Membro d="M288 470 C214 430, 196 330, 236 262" mao={[230, 250]} />
    <Membro d="M736 470 C810 430, 828 330, 788 262" mao={[794, 250]} />
  </G>
);

export const ArmsRightUp = () => (
  <G>
    <Membro d="M288 470 C220 500, 215 610, 285 650" mao={[272, 655]} />
    <Membro d="M736 470 C812 452, 840 372, 806 300" mao={[800, 288]} />
  </G>
);

export const ArmsShrug = () => (
  <G>
    <Membro d="M288 470 C214 452, 190 400, 206 348" mao={[200, 336]} />
    <Membro d="M736 470 C810 452, 834 400, 818 348" mao={[824, 336]} />
  </G>
);

export const ArmsDroop = () => (
  <G>
    <Membro d="M288 486 C236 546, 232 664, 268 716" mao={[262, 722]} />
    <Membro d="M736 486 C788 546, 792 664, 756 716" mao={[762, 722]} />
  </G>
);

// ── worn items ──────────────────────────────────────────────────────────────
/*
 Tudo aqui desceu 120 unidades na troca do castelo pelo coelho.

 No castelo, o chapéu pousava nas ameias — o ponto mais alto da figura. O
 coelho tem orelhas ali, e um chapéu naquela altura ficava flutuando acima
 delas, preso em nada. Descendo até a cúpula da cabeça, ele se apoia onde
 caberia de verdade e as orelhas passam por cima, que é como um coelho usa
 chapéu.

 A bandeira do castelo não desceu: sumiu. Ela era o mastro de uma torre, e não
 há torre. Com ela foi embora o `HIDES_FLAG` de `Mascot.tsx`, que existia só
 para impedir que a coroa e o mastro disputassem a mesma ameia.
*/

export const Cap = ({ accent }: PartProps) => (
  <G>
    <Path d="M512 270 L716 336 L512 402 L308 336 Z" fill="#1E1E2A" />
    <Rect x={452} y={356} width={120} height={34} rx={10} fill="#2A2A38" />
    <Path d="M700 346 V420" stroke="#1E1E2A" strokeWidth={10} strokeLinecap="round" />
    <Circle cx={700} cy={432} r={20} fill={accent} />
  </G>
);

export const Crown = ({ accent }: PartProps) => (
  <G>
    <Path d="M330 370 L330 270 L412 330 L512 248 L612 330 L694 270 L694 370 Z" fill={accent} />
    <Circle cx={412} cy={316} r={16} fill="#FF5A7A" />
    <Circle cx={512} cy={296} r={18} fill="#38BDF8" />
    <Circle cx={612} cy={316} r={16} fill="#FF5A7A" />
  </G>
);

export const Shades = () => (
  <G>
    <Rect x={378} y={432} width={126} height={82} rx={26} fill="#14141C" />
    <Rect x={520} y={432} width={126} height={82} rx={26} fill="#14141C" />
    <Path d="M504 462 H520" stroke="#14141C" strokeWidth={16} />
    <Path d="M378 462 H330" stroke="#14141C" strokeWidth={14} strokeLinecap="round" />
    <Path d="M646 462 H694" stroke="#14141C" strokeWidth={14} strokeLinecap="round" />
    <Path d="M396 452 L436 452" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" opacity={0.45} />
  </G>
);

// O arco desceu só 40: ele passa **na frente** das orelhas, que é como um fone
// de fato se apoia numa cabeça de coelho. Descer 120 o enterraria nos olhos.
export const Headphones = ({ accent }: PartProps) => (
  <G>
    <Path d="M286 396 C286 250, 738 250, 738 396" fill="none" stroke="#1E1E2A" strokeWidth={30} strokeLinecap="round" />
    <Rect x={244} y={370} width={84} height={140} rx={34} fill="#1E1E2A" />
    <Rect x={696} y={370} width={84} height={140} rx={34} fill="#1E1E2A" />
    <Rect x={262} y={392} width={48} height={96} rx={24} fill={accent} opacity={0.85} />
    <Rect x={714} y={392} width={48} height={96} rx={24} fill={accent} opacity={0.85} />
  </G>
);

export const PartyHat = ({ accent }: PartProps) => (
  <G>
    <Path d="M512 228 L586 388 H438 Z" fill={accent} />
    <Path d="M470 334 H570" stroke="#0A0A0C" strokeWidth={12} opacity={0.35} />
    <Circle cx={512} cy={222} r={20} fill="#FF5A7A" />
  </G>
);

// ── held props ──────────────────────────────────────────────────────────────
// Positioned at the raised hand and drawn *above* the arm, so the castle holds
// the object rather than standing behind it.

const HELD = 'translate(812, 272) scale(1.32)';

const Held = ({ children }: { children: React.ReactNode }) => (
  <G transform={HELD}>{children}</G>
);

export const PropBook = ({ accent }: PartProps) => (
  <Held>
    <Rect x={-70} y={-52} width={140} height={104} rx={14} fill="#2A2A38" />
    <Rect x={-58} y={-40} width={52} height={80} rx={8} fill={accent} />
    <Rect x={6} y={-40} width={52} height={80} rx={8} fill="#FFFFFF" opacity={0.85} />
    <Path d="M0 -46 V46" stroke="#14141C" strokeWidth={10} />
  </Held>
);

export const PropTrophy = ({ accent }: PartProps) => (
  <Held>
    <Path d="M-46 -56 H46 V-6 C46 30, -46 30, -46 -6 Z" fill={accent} />
    <Path d="M-46 -44 H-76 C-76 4, -58 18, -44 20" fill="none" stroke={accent} strokeWidth={14} />
    <Path d="M46 -44 H76 C76 4, 58 18, 44 20" fill="none" stroke={accent} strokeWidth={14} />
    <Rect x={-14} y={26} width={28} height={34} fill={accent} />
    <Rect x={-44} y={56} width={88} height={22} rx={8} fill={accent} />
  </Held>
);

export const PropFlame = () => (
  <Held>
    <Path d="M0 -70 C34 -26, 56 -6, 56 22 C56 56, 30 76, 0 76 C-30 76, -56 56, -56 22 C-56 -6, -22 -20, 0 -70 Z" fill="#FF7A3C" />
    <Path d="M0 -18 C18 8, 26 20, 26 34 C26 52, 14 62, 0 62 C-14 62, -26 52, -26 34 C-26 20, -12 12, 0 -18 Z" fill="#FFC94D" />
  </Held>
);

export const PropBolt = ({ accent }: PartProps) => (
  <Held><Path d="M18 -76 L-46 12 H-4 L-18 76 L46 -12 H4 Z" fill={accent} /></Held>
);

export const PropStar = ({ accent }: PartProps) => (
  <Held><Path d="M0 -72 L21 -22 L74 -22 L31 10 L47 62 L0 30 L-47 62 L-31 10 L-74 -22 L-21 -22 Z" fill={accent} /></Held>
);

export const PropHeart = () => (
  <Held><Path d="M0 66 C-70 12, -70 -44, -34 -56 C-10 -64, 0 -38, 0 -38 C0 -38, 10 -64, 34 -56 C70 -44, 70 12, 0 66 Z" fill="#FF5A7A" /></Held>
);

export const PropPencil = ({ accent }: PartProps) => (
  <Held>
    <G transform="rotate(38)">
      <Rect x={-16} y={-72} width={32} height={112} rx={6} fill={accent} />
      <Path d="M-16 40 L0 76 L16 40 Z" fill="#F7F0E8" />
      <Path d="M-6 62 L0 76 L6 62 Z" fill={INK} />
      <Rect x={-16} y={-84} width={32} height={18} rx={6} fill="#FF5A7A" />
    </G>
  </Held>
);

export const PropClock = ({ accent }: PartProps) => (
  <Held>
    <Circle cx={0} cy={0} r={64} fill="#2A2A38" />
    <Circle cx={0} cy={0} r={52} fill="none" stroke={accent} strokeWidth={10} />
    <Path d="M0 -34 V4 L28 22" fill="none" stroke={accent} strokeWidth={12} strokeLinecap="round" />
  </Held>
);

export const PropMedal = ({ accent }: PartProps) => (
  <Held>
    <Path d="M-34 -76 L-8 -14 H8 L34 -76" fill="none" stroke="#38BDF8" strokeWidth={18} />
    <Circle cx={0} cy={24} r={50} fill={accent} />
    <Circle cx={0} cy={24} r={34} fill="none" stroke="#0A0A0C" strokeWidth={8} opacity={0.3} />
  </Held>
);

export const PropGlass = ({ accent }: PartProps) => (
  <Held>
    <Circle cx={-8} cy={-14} r={50} fill="none" stroke={accent} strokeWidth={16} />
    <Circle cx={-8} cy={-14} r={38} fill="#FFFFFF" opacity={0.14} />
    <Path d="M28 24 L70 66" stroke={accent} strokeWidth={20} strokeLinecap="round" />
  </Held>
);

export const PropCloudOff = ({ accent }: PartProps) => (
  <Held>
    <Path d="M-58 22 A34 34 0 0 1 -50 -44 A46 46 0 0 1 34 -34 A30 30 0 0 1 58 22 Z" fill="#6E6E80" />
    <Path d="M-40 -50 L54 40" stroke={accent} strokeWidth={16} strokeLinecap="round" />
  </Held>
);

export const PropLock = ({ accent }: PartProps) => (
  <Held>
    <Path d="M-30 -20 V-44 A30 30 0 0 1 30 -44 V-20" fill="none" stroke={accent} strokeWidth={16} />
    <Rect x={-46} y={-20} width={92} height={76} rx={16} fill={accent} />
    <Circle cx={0} cy={16} r={12} fill="#0A0A0C" opacity={0.55} />
  </Held>
);

// ── ambient decoration (behind the castle) ──────────────────────────────────

export const DecoWaves = ({ accent }: PartProps) => (
  <G fill="none" stroke={accent} strokeWidth={16} strokeLinecap="round" opacity={0.85}>
    <Path d="M872 400 Q906 470 872 540" />
    <Path d="M928 356 Q982 470 928 584" />
  </G>
);

export const DecoDots = ({ accent }: PartProps) => (
  <G fill={accent}>
    <Circle cx={752} cy={236} r={14} opacity={0.55} />
    <Circle cx={800} cy={196} r={20} opacity={0.75} />
    <Circle cx={862} cy={146} r={27} />
  </G>
);

export const DecoZzz = ({ accent }: PartProps) => (
  <G fill="none" stroke={accent} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={0.9}>
    <Path d="M742 250 H798 L742 306 H798" />
    <Path d="M826 168 H872 L826 214 H872" />
  </G>
);

export const DecoSparks = ({ accent }: PartProps) => (
  <G fill={accent}>
    <Path d="M196 232 L210 268 L246 282 L210 296 L196 332 L182 296 L146 282 L182 268 Z" />
    <Path d="M846 300 L856 326 L882 336 L856 346 L846 372 L836 346 L810 336 L836 326 Z" opacity={0.8} />
    <Circle cx={264} cy={160} r={12} opacity={0.7} />
  </G>
);

const CONFETTI = [
  [210, 190, '#C8FF4D', 18], [300, 140, '#38BDF8', 14], [730, 160, '#FF5A7A', 16],
  [830, 240, '#FFC94D', 12], [160, 320, '#A78BFA', 14], [880, 400, '#4ADE80', 16],
] as const;

export const DecoConfetti = () => (
  <G>
    {CONFETTI.map(([x, y, fill, s]) => (
      <Rect
        key={`${x}-${y}`}
        x={x} y={y} width={s} height={s * 2} rx={4} fill={fill}
        transform={`rotate(${((x + y) % 70) - 35}, ${x}, ${y})`}
      />
    ))}
  </G>
);
