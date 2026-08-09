import { useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { useTheme, type Palette, text } from '../../theme';

/**
 * O avatar de quem assina: um escudo com a borda em degradê.
 *
 * ## Por que a forma muda, e não só a borda
 *
 * É o que faz o marcador do Strava funcionar, e o dono do produto identificou
 * exatamente isso: quem assina não ganha um enfeite **sobre** o avatar, ganha
 * um avatar de **outro formato**. A diferença é lida na silhueta, antes de
 * qualquer detalhe — e por isso ela dispensa a palavra "PRO" escrita em cima.
 *
 * ## Por que SVG
 *
 * Uma `View` do React Native só sabe ser retângulo, com cantos mais ou menos
 * arredondados. Escudo não é uma dessas formas. Então tanto a moldura quanto o
 * recorte da foto são desenhados em SVG, com `clipPath`.
 *
 * É também por isso que este componente recebe a **imagem**, e não um filho
 * para embrulhar. A versão anterior embrulhava, e a foto continuava redonda
 * dentro da moldura: quem arredonda o avatar é o próprio avatar, e de fora não
 * há como recortar em escudo algo que já foi desenhado.
 *
 * ## Por que degradê, e não brilho
 *
 * Uma versão anterior tinha halo — círculos concêntricos simulando luz difusa.
 * Funcionava, e competia com o próprio avatar: o brilho puxava o olho para a
 * borda em vez da pessoa. O degradê dá a mesma sensação de superfície polida
 * sem ocupar espaço além da moldura.
 *
 * Três paradas com contraste real — claro no canto que recebe luz, marca no
 * meio, escuro no oposto. Duas cores próximas leem como cor chapada, e cor
 * chapada lê como borda; borda não é moldura.
 *
 * ## Onde ela aparece
 *
 * Em todo lugar que desenha uma pessoa — decisão do dono do produto. Quem entra
 * por aqui direto é só o perfil; o resto do app chega por `components/ui/Avatar`,
 * que troca o círculo por este escudo quando `pro`.
 *
 * O que essa decisão custa: no feed, no chat e no ranking o avatar tem 18 a
 * 40pt, e quanto menor, menos a silhueta se separa de um quadrado arredondado.
 * A moldura continua legível — é a **forma** que perde definição. Abaixo de uns
 * 24pt o escudo é mais textura do que símbolo.
 *
 * ## Por que ela não é o selo de verificado
 *
 * São três marcas, e cada uma responde a uma pergunta: o selo azul diz **é
 * mesmo essa pessoa**, o dourado diz **esta pessoa ensina**, e esta diz **esta
 * pessoa paga**. Fundir qualquer par apagaria as duas — foi o que aconteceu
 * quando o X passou a vender o azul.
 */

/**
 * O quanto o escudo é mais alto que largo.
 *
 * Exportado porque quem coloca o escudo numa lista precisa dele: manter a
 * **altura** do círculo que havia ali (e não a largura) é o que impede a linha
 * de crescer 18% só porque a pessoa assina. Ver `components/ui/Avatar`.
 */
export const PROPORCAO_ESCUDO = 1.18;

/**
 * O escudo, numa grade de 100 × 118.
 *
 * Mais alto que largo de propósito: em proporção quadrada a ponta de baixo fica
 * rasa e a forma lê como "quadrado com defeito". O V precisa de altura para ser
 * um V.
 */
const ESCUDO = 'M14 0 H86 A14 14 0 0 1 100 14 V86 L50 118 L0 86 V14 A14 14 0 0 1 14 0 Z';

/** A área da foto: o mesmo escudo, encolhido pela espessura da moldura. */
const ESCUDO_INTERNO =
  'M18 5 H82 A11 11 0 0 1 93 16 V83 L50 110 L7 83 V16 A11 11 0 0 1 18 5 Z';

export default function MolduraPro({
  uri,
  iniciais,
  size,
}: {
  /** A foto. Sem ela, as iniciais aparecem sobre o degradê. */
  uri: string | null;
  iniciais: string;
  /** Largura do escudo. A altura sai da proporção 118/100. */
  size: number;
}) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c, size), [c, size]);

  // **Os `id` de um SVG são globais, e agora há muitos escudos por tela.**
  // Enquanto era um só, no perfil, nomes fixos bastavam. Numa lista, dois
  // `<Defs>` com o mesmo `id` fazem todos os `url(#…)` apontarem para o
  // primeiro que a plataforma registrou — e o sintoma não é sumir, é o escudo
  // de baixo herdar o recorte do de cima. Mesmo motivo do `SeloVerificado`.
  const idBase = useId();
  const idDegrade = `moldura-pro-${idBase}`;
  const idRecorte = `recorte-pro-${idBase}`;

  return (
    <View style={styles.envolve}>
      <Svg width={size} height={size * PROPORCAO_ESCUDO} viewBox="0 0 100 118">
        <Defs>
          <LinearGradient id={idDegrade} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#BBD5FF" />
            <Stop offset="0.5" stopColor={c.accent} />
            <Stop offset="1" stopColor="#0140B8" />
          </LinearGradient>
          <ClipPath id={idRecorte}>
            <Path d={ESCUDO_INTERNO} />
          </ClipPath>
        </Defs>

        <Path d={ESCUDO} fill={`url(#${idDegrade})`} />

        {uri ? (
          <SvgImage
            href={{ uri }}
            x="0"
            y="0"
            width="100"
            height="118"
            // `slice`: a foto preenche o escudo inteiro. `meet` deixaria faixas
            // do degradê aparecendo por dentro, como se a moldura vazasse.
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${idRecorte})`}
          />
        ) : null}
      </Svg>

      {/* As iniciais ficam fora do SVG: o `Text` de lá não herda a fonte do
          app, e a inicial de um avatar tem que ser a mesma letra do resto. */}
      {!uri ? (
        <View style={styles.iniciaisEnvolve} pointerEvents="none">
          <Text style={styles.iniciais}>{iniciais}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette, size: number) =>
  StyleSheet.create({
    envolve: { width: size, height: size * PROPORCAO_ESCUDO },
    iniciaisEnvolve: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      // A ponta do escudo puxa o centro óptico para cima; um texto centralizado
      // de verdade parece caído.
      paddingBottom: size * 0.16,
    },
    iniciais: {
      ...text.title3,
      color: c.fgOnAccent,
      fontSize: size * 0.34,
    },
  });
