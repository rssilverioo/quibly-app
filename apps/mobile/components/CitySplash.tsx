import { useMemo } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

/**
 * O azul das ilustrações. Tem que ser o mesmo do splash **nativo**
 * (`SplashScreenBackground` no iOS, `colors.xml` no Android): as duas telas se
 * sucedem em milissegundos, e qualquer diferença aparece como um piscar.
 */
export const AZUL_ABERTURA = '#015FFD';

/**
 * As cidades. Uma por abertura, sorteada.
 *
 * `require` estático de propósito — o Metro precisa resolver o caminho em tempo
 * de build, então nada de montar o nome do arquivo por interpolação.
 */
const CIDADES: ImageSourcePropType[] = [
  require('../assets/splash-cities/sao-paulo.jpg'),
  require('../assets/splash-cities/new-york.jpg'),
  require('../assets/splash-cities/san-francisco.jpg'),
];

/**
 * A tela de abertura, entre o splash nativo e o app pronto.
 *
 * ## Por que ela existe, se já há um splash nativo
 *
 * O splash nativo do Expo desenha **um logo centralizado sobre uma cor** — é o
 * que a storyboard do iOS e o `splashscreen_logo` do Android sabem fazer. Ele
 * não sabe preencher a tela com uma ilustração, e forçá-lo a isso exigiria
 * mexer na storyboard e ainda quebraria em proporções diferentes.
 *
 * Aqui, em React, `resizeMode="cover"` resolve em qualquer aparelho. E como o
 * fundo é o mesmo azul do splash nativo, a passagem de um para o outro não
 * aparece: o coelho centralizado dá lugar à cidade sem que a tela pisque.
 *
 * ## Por que a imagem é sorteada uma vez
 *
 * `useMemo` sem dependência: a escolha acontece na montagem e não muda enquanto
 * a tela viver. Sortear a cada render trocaria a ilustração no meio da abertura,
 * a cada vez que a autenticação atualizasse o estado.
 */
export default function CitySplash() {
  const cidade = useMemo(
    () => CIDADES[Math.floor(Math.random() * CIDADES.length)],
    [],
  );

  return (
    <View style={styles.tela}>
      <Image source={cidade} style={styles.arte} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  // `absoluteFill` e não `flex: 1`: esta tela cobre o que estiver montado
  // embaixo, e não disputa espaço com ele.
  tela: { ...StyleSheet.absoluteFillObject, backgroundColor: AZUL_ABERTURA },
  arte: { width: '100%', height: '100%' },
});
