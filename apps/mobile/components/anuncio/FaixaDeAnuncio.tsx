import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

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
  // `ca-app-pub-…` é o formato real. Qualquer outra coisa — placeholder
  // esquecido, string vazia — não vale, e cair no teste é melhor que quebrar.
  return valor && valor.startsWith('ca-app-pub-') ? valor : null;
}

export default function FaixaDeAnuncio() {
  const { profile } = useAuth();
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
          tamanho: modulo.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
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

const styles = StyleSheet.create({
  // Sem fundo e sem borda: a faixa não é um card do app, e emoldurá-la a faria
  // parecer conteúdo nosso.
  faixa: { alignItems: 'center', marginTop: 12, marginBottom: 4 },
});
