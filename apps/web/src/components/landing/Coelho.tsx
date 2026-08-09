/**
 * O coelho, na web.
 *
 * Portado de `apps/mobile/components/mascot`, mantendo a grade 1024 e as
 * mesmas coordenadas — olhos em y=470, orelhas saindo em x=455/569. É o mesmo
 * bicho, não um primo: se alguém ajustar a cabeça no app e não aqui, a
 * diferença aparece lado a lado no material de marketing.
 *
 * ## Por que estados, e não um desenho só
 *
 * O mascote do app tem 30 estados, e eles são a linguagem do produto: o coelho
 * lendo, com troféu, coroado. Trazer só o `idle` para o site seria trazer a
 * casca. Cada seção usa o estado que corresponde ao que ela diz — o coelho
 * lendo onde se fala de estudar, o coroado onde se fala do plano.
 */

export type EstadoDoCoelho = 'idle' | 'lendo' | 'trofeu' | 'coroado' | 'foco';

const PELO = '#FFFFFF';
const CONTORNO = '#123E8C';
const ORELHA = '#BBD5FF';

/** As mesmas curvas do app. Ver `Mascot.tsx`. */
const ORELHA_ESQ = 'M455 300 C432 214, 420 152, 414 108';
const ORELHA_DIR = 'M569 300 C592 214, 604 152, 610 108';

function Membro({ d, mao }: { d: string; mao: [number, number] }) {
  return (
    <g>
      <path d={d} fill="none" stroke={CONTORNO} strokeWidth={82} strokeLinecap="round" />
      <circle cx={mao[0]} cy={mao[1]} r={58} fill={CONTORNO} />
      <path d={d} fill="none" stroke={PELO} strokeWidth={62} strokeLinecap="round" />
      <circle cx={mao[0]} cy={mao[1]} r={48} fill={PELO} />
    </g>
  );
}

const BRACOS = {
  descanso: (
    <>
      <Membro d="M288 470 C220 500, 215 610, 285 650" mao={[272, 655]} />
      <Membro d="M736 470 C804 500, 809 610, 739 650" mao={[752, 655]} />
    </>
  ),
  direitoAlto: (
    <>
      <Membro d="M288 470 C220 500, 215 610, 285 650" mao={[272, 655]} />
      <Membro d="M736 470 C812 452, 840 372, 806 300" mao={[800, 288]} />
    </>
  ),
};

export default function Coelho({
  estado = 'idle',
  size = 120,
  className,
}: {
  estado?: EstadoDoCoelho;
  size?: number;
  className?: string;
}) {
  const olhosFechados = estado === 'foco';
  const bracoAlto = estado === 'lendo' || estado === 'trofeu';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`pelo-${estado}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9F0FF" />
        </linearGradient>
      </defs>

      {/* Orelhas, corpo e braços antes da cabeça: é a ordem que dá a leitura de
          bicho de cabeça grande, com os braços saindo de trás. */}
      <g strokeLinecap="round" fill="none">
        <path d={ORELHA_ESQ} stroke={CONTORNO} strokeWidth={116} />
        <path d={ORELHA_DIR} stroke={CONTORNO} strokeWidth={116} />
        <path d={ORELHA_ESQ} stroke={PELO} strokeWidth={94} />
        <path d={ORELHA_DIR} stroke={PELO} strokeWidth={94} />
        <path d="M458 292 C438 218, 428 166, 422 132" stroke={ORELHA} strokeWidth={40} />
        <path d="M566 292 C586 218, 596 166, 602 132" stroke={ORELHA} strokeWidth={40} />
      </g>

      <circle cx={318} cy={752} r={62} fill={PELO} stroke={CONTORNO} strokeWidth={20} />
      <ellipse cx={512} cy={726} rx={198} ry={152} fill={`url(#pelo-${estado})`} stroke={CONTORNO} strokeWidth={20} />
      <ellipse cx={418} cy={856} rx={88} ry={47} fill={PELO} stroke={CONTORNO} strokeWidth={18} />
      <ellipse cx={606} cy={856} rx={88} ry={47} fill={PELO} stroke={CONTORNO} strokeWidth={18} />

      {bracoAlto ? BRACOS.direitoAlto : BRACOS.descanso}

      <ellipse cx={512} cy={470} rx={240} ry={226} fill={`url(#pelo-${estado})`} stroke={CONTORNO} strokeWidth={22} />
      <ellipse cx={430} cy={352} rx={92} ry={54} fill="#FFFFFF" opacity={0.75} transform="rotate(-18, 430, 352)" />

      {olhosFechados ? (
        <g fill="none" stroke={CONTORNO} strokeWidth={18} strokeLinecap="round">
          <path d="M399 472 H463" />
          <path d="M561 472 H625" />
        </g>
      ) : (
        <g>
          <ellipse cx={431} cy={470} rx={34} ry={46} fill={CONTORNO} />
          <ellipse cx={593} cy={470} rx={34} ry={46} fill={CONTORNO} />
          <ellipse cx={442} cy={454} rx={10} ry={14} fill="#FFF" opacity={0.9} />
          <ellipse cx={604} cy={454} rx={10} ry={14} fill="#FFF" opacity={0.9} />
        </g>
      )}

      <path d="M494 498 H530 Q512 526 512 526 Q512 526 494 498 Z" fill={CONTORNO} />
      <path d="M456 535 Q512 585 568 535" fill="none" stroke={CONTORNO} strokeWidth={18} strokeLinecap="round" />

      {/* O que a mão segura, quando segura. Posicionado em (812, 272), o mesmo
          ponto do app — ver `HELD` em `mascot/parts.tsx`. */}
      {estado === 'lendo' ? (
        <g transform="translate(812, 272) scale(1.32)">
          <rect x={-70} y={-52} width={140} height={104} rx={14} fill="#123E8C" />
          <rect x={-58} y={-40} width={52} height={80} rx={8} fill="#4C9AFF" />
          <rect x={6} y={-40} width={52} height={80} rx={8} fill="#FFFFFF" opacity={0.9} />
          <path d="M0 -46 V46" stroke="#0B1B3A" strokeWidth={10} />
        </g>
      ) : null}

      {estado === 'trofeu' ? (
        <g transform="translate(812, 272) scale(1.32)" fill="#015FFD">
          <path d="M-46 -56 H46 V-6 C46 30, -46 30, -46 -6 Z" />
          <path d="M-46 -44 H-76 C-76 4, -58 18, -44 20" fill="none" stroke="#015FFD" strokeWidth={14} />
          <path d="M46 -44 H76 C76 4, 58 18, 44 20" fill="none" stroke="#015FFD" strokeWidth={14} />
          <rect x={-14} y={26} width={28} height={34} />
          <rect x={-44} y={56} width={88} height={22} rx={8} />
        </g>
      ) : null}

      {estado === 'coroado' ? (
        <g>
          <path d="M330 370 L330 270 L412 330 L512 248 L612 330 L694 270 L694 370 Z" fill="#015FFD" />
          <circle cx={412} cy={316} r={16} fill="#BBD5FF" />
          <circle cx={512} cy={296} r={18} fill="#FFFFFF" />
          <circle cx={612} cy={316} r={16} fill="#BBD5FF" />
        </g>
      ) : null}
    </svg>
  );
}
