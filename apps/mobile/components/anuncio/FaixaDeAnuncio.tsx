import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { useTheme, type Palette, radius, space } from '../../theme';

/**
 * A faixa de anúncio de quem não assina.
 *
 * ## Por que só aqui
 *
 * Decisão do dono do produto: **uma faixa, num lugar só**. Entre os números da
 * sala e o feed do dia — a dobra entre "onde eu estou" e "o que aconteceu",
 * que é onde o olho já para naturalmente.
 *
 * O que ficou de fora importa mais que o que entrou. Nada na sessão, no
 * check-in ou na tela de publicar: são os três momentos em que o app pede foco,
 * e anúncio ali seria o produto se contradizendo. Nada entre posts do feed
 * tampouco — faria o estudo das pessoas parecer publicidade.
 *
 * ## Por que ela some para quem assina
 *
 * "Sem anúncios" é o que a tela de planos vende. Enquanto não havia anúncio
 * nenhum, essa linha prometia a remoção de algo que não existia; agora ela é
 * verdade, e esta é a linha de código que a torna verdade.
 *
 * ## Por que ela não reserva espaço quando não existe
 *
 * Sem plano carregado, sem anúncio pronto ou fora do celular, o componente
 * devolve `null` e some da árvore. Um espaço vazio reservado deixaria um buraco
 * na tela toda vez que o anúncio não carregasse — e anúncio falha em carregar o
 * tempo todo, por rede, por bloqueio, por falta de inventário.
 */

const ATIVO = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * A unidade de anúncio, por plataforma.
 *
 * Vem do ambiente para a troca de teste → produção ser **configuração**, e não
 * commit: as chaves entram no `eas.json` junto das outras, e o mesmo código
 * serve os dois mundos.
 *
 * Sem a variável, cai nos identificadores de teste do Google — que servem
 * anúncio de teste para qualquer um, sem conta no AdMob. É o padrão certo para
 * errar: um build sem configuração mostra anúncio de teste, e não anúncio real
 * cobrado de anunciante nenhum, o que dá suspensão de conta.
 */
function unidadeDoAmbiente(): string | null {
  const daPlataforma =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS
      : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  const valor = daPlataforma?.trim();
  if (!valor || !valor.startsWith('ca-app-pub-')) return null;
  /*
   Bloco de anúncio tem **barra**; app tem **til**.

     app    ca-app-pub-7106022757613059~7466871837
     bloco  ca-app-pub-7106022757613059/1234567890

   Os dois começam igual, e o do app é o que está à mão na hora de preencher
   isto — é o erro fácil de cometer e impossível de ver relendo. Colado aqui,
   ele passaria no teste do prefixo, viraria pedido de anúncio inválido e a
   faixa sumiria calada, que é como o produto perde receita sem ninguém notar.

   Cair no anúncio de teste é ruim; servir um identificador inválido em
   produção é pior, porque parece que está funcionando.
  */
  return valor.includes('/') ? valor : null;
}

export default function FaixaDeAnuncio() {
  const { profile } = useAuth();
  const { c } = useTheme();
  const { width: larguraDaTela } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);

  /**
   * A largura de dentro do card, e não a da tela.
   *
   * O banner *adaptive* se dimensiona pela tela e ignora o recuo da lista — o
   * resultado era a única coisa da página encostando nas duas bordas, no meio
   * de cards que recuam 16pt de cada lado. Foi o que o dono do produto reparou
   * de imediato.
   *
   * `space.lg` de cada lado é o recuo da lista; 1pt de cada lado é a borda
   * deste card. O que sobra é o espaço útil, e é o que se pede ao anúncio.
   */
  const larguraUtil = Math.floor(larguraDaTela - space.lg * 2 - 2);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);

  /**
   * Só depois de saber o plano.
   *
   * `profile` chega `null` no primeiro quadro. Renderizar o anúncio antes de
   * saber quem é a pessoa faria quem assina ver a faixa piscar — pequeno, e é
   * exatamente o tipo de detalhe que faz alguém sentir que pagou por nada.
   */
  const ehPro = profile?.plan === 'PRO';
  const deveMostrar = ATIVO && Boolean(profile) && !ehPro && !falhou;

  const [Banner, setBanner] = useState<null | {
    BannerAd: React.ComponentType<Record<string, unknown>>;
    tamanho: string;
    unidade: string;
  }>(null);

  useEffect(() => {
    if (!deveMostrar) return;
    let vivo = true;
    (async () => {
      try {
        /*
         Carregado sob demanda, e não no topo do arquivo.

         O SDK do AdMob derruba o app na inicialização quando o App ID está
         ausente ou errado — antes de qualquer tela aparecer. Importando aqui, o
         pior caso é a faixa não aparecer; importando no topo, o pior caso é o
         app não abrir.
        */
        const modulo = await import('react-native-google-mobile-ads');
        if (!vivo) return;
        setBanner({
          BannerAd: modulo.BannerAd as never,
          /*
           Tamanho pedido pela largura do card, e não `ANCHORED_ADAPTIVE_BANNER`.

           O adaptive ancorado sempre ocupa a tela inteira — é para isso que ele
           existe. Pedir uma medida própria custa alcance: há menos anúncio
           desenhado para tamanhos fora dos padrões, e a taxa de preenchimento
           cai. É a troca que o dono do produto escolheu, e ela é defensável:
           uma faixa que rompe o alinhamento de toda a tela chama atenção pelo
           motivo errado.

           50pt é a altura do banner padrão — a mesma do `320x50`, que é o
           formato com mais inventário no mundo.
          */
          tamanho: `${larguraUtil}x50`,
          unidade: unidadeDoAmbiente() ?? modulo.TestIds.ADAPTIVE_BANNER,
        });
        setPronto(true);
      } catch {
        // Sem SDK linkado (build antigo, Expo Go) a faixa simplesmente não
        // existe. Não é erro para ninguém.
        if (vivo) setFalhou(true);
      }
    })();
    return () => { vivo = false; };
  }, [deveMostrar]);

  if (!deveMostrar || !pronto || !Banner) return null;

  const { BannerAd, tamanho, unidade } = Banner;

  return (
    <View style={styles.faixa}>
      <BannerAd
        unitId={unidade}
        size={tamanho}
        onAdFailedToLoad={() => setFalhou(true)}
      />
    </View>
  );
}

/**
 * A moldura.
 *
 * A primeira versão era sem borda e sem fundo, com o argumento de que emoldurar
 * o anúncio o faria parecer conteúdo nosso. O argumento estava mal aplicado: o
 * que a política de anúncio proíbe é **disfarçar** — colocar a faixa onde a
 * pessoa espera um botão, ou tirar dela a identificação. Aqui o banner traz o
 * próprio selo do Google, e alinhar a largura é higiene de layout, não disfarce.
 *
 * O fundo fica em `surface`, o mesmo dos cards, porque um anúncio flutuando sem
 * fundo sobre o cinza da tela é o que de fato parecia erro de renderização.
 */
const makeStyles = (c: Palette) =>
  StyleSheet.create({
    faixa: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: space.md,
      marginBottom: space.md,
    },
  });
