import Svg, { Path } from 'react-native-svg';

/** Os dois selos. `null` é o estado da esmagadora maioria: sem selo. */
export type Selo = 'BLUE' | 'GOLD' | null | undefined;

/**
 * Azul do Instagram/Strava e dourado do X, de propósito.
 *
 * Um selo só funciona se for reconhecido antes de ser lido, e essas duas cores
 * já carregam significado na cabeça de quem usa qualquer rede. Inventar uma
 * paleta nossa aqui seria exigir que a pessoa aprendesse um vocabulário novo
 * para entender uma informação de meio segundo.
 */
const CORES: Record<'BLUE' | 'GOLD', string> = {
  BLUE: '#1D9BF0',
  GOLD: '#E8B923',
};

/**
 * O selo ao lado do nome — no feed, no chat, no ranking e no perfil.
 *
 * ## O que ele afirma
 *
 * `BLUE` — este perfil é mesmo de quem diz ser.
 * `GOLD` — além disso, esta pessoa ensina.
 *
 * Nenhum dos dois se compra. É o que os mantém significando alguma coisa: um
 * selo vendável passa a dizer "pagou" em vez de "é essa pessoa", e vira ruído
 * em poucos meses. O que o Pro ganha é uma marca própria e visualmente
 * distinta destas.
 *
 * ## Por que desenhado, e não emoji
 *
 * ✅ e ☑️ mudam de forma em cada sistema e em cada versão, e o dourado não
 * existe como emoji. Desenhado, o mesmo símbolo aparece igual no iOS, no
 * Android e no painel de admin — que é onde ele é concedido.
 */
export default function SeloVerificado({
  selo,
  size = 15,
}: {
  selo: Selo;
  /** Acompanha o tamanho do texto ao lado. 15 casa com `body`. */
  size?: number;
}) {
  if (!selo) return null;

  const cor = CORES[selo];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* A rosácea. É a silhueta que faz o selo ser reconhecido de longe, antes
          de o visto ser lido. */}
      <Path
        d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.9 1.6-1.3 3.1 1.3 3.1-2.9 1.6-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2-2.9-1.6L3.6 12.8 2.3 9.7l2.9-1.6.9-3.2 3.3.3L12 1.5z"
        fill={cor}
      />
      <Path
        d="M8.4 12.2l2.5 2.5 4.7-5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
