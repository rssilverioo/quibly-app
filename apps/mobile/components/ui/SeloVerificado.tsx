import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Os dois selos. `null` é o estado da esmagadora maioria: sem selo. */
export type Selo = 'BLUE' | 'GOLD' | null | undefined;

/**
 * A rosácea de 24 pontas. Vem de `assets/brand/selo-azul.svg`, que é a arte de
 * origem — os dois selos compartilham a silhueta e diferem só no preenchimento.
 */
const ROSACEA =
  'M256 38C270 38 282 57 296 59C311 61 329 44 343 49C357 54 358 79 370 86' +
  'C382 93 405 82 416 92C427 102 417 125 424 137C431 149 456 151 462 165' +
  'C468 179 450 197 452 212C454 227 476 239 476 254C476 269 454 281 452 296' +
  'C450 311 468 329 462 343C456 357 431 359 424 371C417 383 427 406 416 416' +
  'C405 426 382 415 370 422C358 429 357 454 343 459C329 464 311 447 296 449' +
  'C282 451 270 470 256 470C242 470 230 451 216 449C201 447 183 464 169 459' +
  'C155 454 154 429 142 422C130 415 107 426 96 416C85 406 95 383 88 371' +
  'C81 359 56 357 50 343C44 329 62 311 60 296C58 281 36 269 36 254' +
  'C36 239 58 227 60 212C62 197 44 179 50 165C56 151 81 149 88 137' +
  'C95 125 85 102 96 92C107 82 130 93 142 86C154 79 155 54 169 49' +
  'C183 44 201 61 216 59C230 57 242 38 256 38Z';

/** O visto. Mesmo traçado nos dois. */
const VISTO =
  'M174 264C165 255 165 241 174 232C183 223 197 223 206 232L236 262L306 192' +
  'C315 183 329 183 338 192C347 201 347 215 338 224L252 310C243 319 229 319 220 310' +
  'L174 264Z';

const AZUL = '#2F95E8';

/**
 * As paradas do ouro, na ordem da arte original.
 *
 * São oito porque é a alternância entre elas que faz o metal parecer metal —
 * um degradê de duas cores vira amarelo chapado. Mesmo em 15pt, onde nenhuma
 * parada é distinguível sozinha, a mistura ainda lê como brilho.
 */
const OURO: [string, string][] = [
  ['0', '#8A5600'],
  ['0.12', '#FFD84A'],
  ['0.25', '#FFF2A1'],
  ['0.40', '#D99A00'],
  ['0.58', '#FFDA45'],
  ['0.73', '#9B6000'],
  ['0.88', '#FFE76A'],
  ['1', '#B87500'],
];

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
 * em poucos meses. O que o Pro ganha é uma marca própria e distinta destas.
 *
 * ## O que mudou da arte para cá, e por quê
 *
 * O desenho é o de `assets/brand/`, mantido traço por traço na silhueta e no
 * visto. Duas coisas ficaram de fora:
 *
 * **A sombra (`feDropShadow`).** Não é suportada no Android pelo
 * `react-native-svg` e renderiza de forma inconsistente no iOS — o mesmo
 * motivo pelo qual o mascote também abriu mão dela (ver `mascot/parts.tsx`).
 *
 * **Os dois brilhos em estrela.** Eles medem ~26 unidades numa grade de 512.
 * Em 15pt isso dá dois terços de um pixel: não aparecem, e ainda assim
 * custariam dois nós por selo, num componente que se repete a cada linha do
 * feed e a cada mensagem do chat.
 *
 * O degradê fica: ele é o que separa ouro de amarelo, e sobrevive à redução
 * porque não depende de nenhuma parada ser vista sozinha.
 *
 * ## Por que o id do degradê é único por instância
 *
 * `useId`, e não uma constante. Ids de `Defs` já vazaram entre instâncias de
 * `Svg` em versões do `react-native-svg`, e o sintoma seria a tela do ranking
 * inteira pintada com o degradê de uma linha só. Gerar um id por montagem
 * custa nada e tira a possibilidade da mesa.
 */
export default function SeloVerificado({
  selo,
  size = 15,
}: {
  selo: Selo;
  /** Acompanha o tamanho do texto ao lado. 15 casa com `body`. */
  size?: number;
}) {
  // Antes de qualquer retorno: hook não pode ficar atrás de condição.
  const id = useId();

  if (!selo) return null;

  const ouro = selo === 'GOLD';
  const gradId = `selo-ouro-${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      {ouro ? (
        <Defs>
          {/* `userSpaceOnUse` com as mesmas coordenadas da arte: é o que faz o
              brilho cruzar o selo na diagonal em vez de acompanhar a caixa. */}
          <LinearGradient
            id={gradId}
            x1="90" y1="70" x2="430" y2="445"
            gradientUnits="userSpaceOnUse"
          >
            {OURO.map(([offset, cor]) => (
              <Stop key={offset} offset={offset} stopColor={cor} />
            ))}
          </LinearGradient>
        </Defs>
      ) : null}

      <Path d={ROSACEA} fill={ouro ? `url(#${gradId})` : AZUL} />
      {/*
        O visto do ouro tem contorno; o do azul não.

        No azul, branco sobre azul-médio já tem contraste de sobra. No ouro,
        branco sobre amarelo-claro quase some — o traço fino devolve a borda
        que o degradê comeu, e é o que mantém o visto legível em 13pt.
      */}
      <Path
        d={VISTO}
        fill="#FFFFFF"
        stroke={ouro ? '#D79B00' : undefined}
        strokeWidth={ouro ? 3 : undefined}
      />
    </Svg>
  );
}
