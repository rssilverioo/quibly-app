import { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { Mascot } from '../mascot';
import Press from '../ui/Press';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { COMPRAS_NO_APP_ATIVAS, revenueCatConfigError } from '../../services/iap';
import { useAuth } from '../../contexts/AuthContext';
import { captureException } from '../../lib/sentry';
import { useTheme, type Palette, radius, space, text } from '../../theme';

/**
 * O que aparece ao bater no limite de salas do plano grátis.
 *
 * ## Por que não é um alerta de erro
 *
 * Era. A tela de criar sala pintava a recusa do servidor como a mesma linha
 * vermelha de "faltou preencher o nome" — e bater no limite de um plano não é
 * um erro, é uma oferta. Quem lê vermelho conclui que quebrou alguma coisa,
 * tenta de novo, e desiste sem descobrir que existe um plano. É a maneira mais
 * rápida de perder a venda.
 *
 * Também não é `Alert.alert`: o alerta do sistema é para ação destrutiva
 * (`DESIGN-GYMRATS §4.4`), e ele não sabe mostrar nem o mascote nem a lista do
 * que o plano dá.
 *
 * ## Por que o coelho está coroado
 *
 * É o estado `crowned`, o mesmo que marca três horas de estudo numa sessão. O
 * mascote já é a linguagem do produto para "você chegou longe", e aqui a
 * pessoa chegou: ela encheu as três salas do plano grátis. A coroa diz isso
 * antes de qualquer texto.
 *
 * ## Por que a lista é honesta
 *
 * Só o que existe: cada linha tem um gate no servidor ou no app. Prometer
 * o que não está no ar é vender fumaça, e a primeira pessoa que assinar por
 * isso vai perceber. A lista mudou em 21/09/2026 com o pacote do Pro.
 *
 * ## `motivo`
 *
 * A folha é uma só, mas a porta muda: limite de salas, criar desafio, Foco
 * Profundo, estatísticas. Título e subtítulo dizem de onde a pessoa veio; a
 * lista é sempre a mesma, porque o plano é um só.
 */
export type MotivoDoPro = 'rooms' | 'challenges' | 'focus' | 'insights';
export default function FolhaDoPro({
  visivel,
  limite = 3,
  motivo = 'rooms',
  aoFechar,
}: {
  visivel: boolean;
  /** Quantas salas o plano grátis inclui. Vem do servidor, não daqui. */
  limite?: number;
  motivo?: MotivoDoPro;
  aoFechar: () => void;
}) {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const { refreshProfile } = useAuth();

  /**
   * O botão abre o paywall do RevenueCat **por cima desta folha**, sem passar
   * pela tela `/pricing`. A folha é o "por quê" (você bateu no limite de
   * salas, quis criar um desafio); o paywall é o "quanto" e o "como". Duas
   * telas de venda em sequência, com os mesmos sete benefícios, era ler a
   * mesma coisa duas vezes antes de ver um preço.
   *
   * Comprou ou restaurou: recarrega o perfil, porque `plan` vem do servidor
   * e é ele que abre as portas (salas, desafios, estatísticas, foco). Sem o
   * refresh a pessoa pagaria e continuaria vendo a coroa até reabrir o app.
   *
   * Sem chave de verdade no build, cai na `/pricing`, que é quem sabe dizer
   * o motivo em vez de mostrar um paywall vazio.
   */
  const abrirPaywall = async () => {
    if (revenueCatConfigError()) {
      aoFechar();
      router.push('/pricing?trigger=quota');
      return;
    }
    try {
      const resultado = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
      if (resultado === PAYWALL_RESULT.PURCHASED || resultado === PAYWALL_RESULT.RESTORED) {
        await refreshProfile();
        aoFechar();
      }
    } catch (err) {
      captureException(err, { where: 'FolhaDoPro.presentPaywall', motivo });
      aoFechar();
      router.push('/pricing?trigger=quota');
    }
  };
  const styles = useMemo(() => makeStyles(c), [c]);

  const beneficios = [
    t('pro.benefitRooms'),
    t('pro.benefitFocus'),
    t('pro.benefitShield'),
    t('pro.benefitInsights'),
    t('pro.benefitChallenges'),
    t('pro.benefitHours'),
    t('pro.benefitNoAds'),
  ];

  const titulo =
    motivo === 'rooms' ? t('pro.limitTitle', { limit: limite }) : t(`pro.${motivo}Title`);
  const subtitulo = motivo === 'rooms' ? t('pro.limitSubtitle') : t(`pro.${motivo}Subtitle`);

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      {/* Fundo que fecha ao toque: folha sem saída óbvia é armadilha. */}
      <Press haptic={false} scale={1} onPress={aoFechar} style={styles.fundo}>
        <View />
      </Press>

      <View style={styles.folha}>
        <View style={styles.pega} />

        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <View style={styles.mascote}>
            <Mascot state="crowned" size={116} />
          </View>

          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.subtitulo}>{subtitulo}</Text>

          <View style={styles.cartao}>
            <Text style={styles.cartaoTitulo}>{t('pro.name')}</Text>
            {beneficios.map((b) => (
              <View key={b} style={styles.linha}>
                <View style={styles.marca}>
                  <Check size={13} color={c.fgOnAccent} strokeWidth={3.2} />
                </View>
                <Text style={styles.linhaTexto}>{b}</Text>
              </View>
            ))}
          </View>

          {/*
            O botão só existe quando há o que comprar.

            Com `COMPRAS_NO_APP_ATIVAS` desligado, `/pricing` se redireciona
            sozinho para a home — de propósito, para o paywall sem preços não
            aparecer por deep link. Um botão que leva alguém para a lista de
            salas sem explicação é pior que botão nenhum; enquanto a compra não
            está no ar, a folha diz a verdade e oferece a saída que existe.
          */}
          {COMPRAS_NO_APP_ATIVAS ? (
            <Press onPress={abrirPaywall} style={styles.botao}>
              <Text style={styles.botaoTexto}>{t('pro.cta')}</Text>
            </Press>
          ) : (
            <View style={styles.emBreve}>
              <Text style={styles.emBreveTexto}>{t('pro.comingSoon')}</Text>
            </View>
          )}

          <Press onPress={aoFechar} style={styles.secundario}>
            <Text style={styles.secundarioTexto}>{t('pro.dismiss')}</Text>
          </Press>

          {/* A saída que não custa nada, e que é verdade: participar das salas
              dos outros nunca teve limite. Sem isto a folha parece dizer que a
              pessoa está travada, e ela não está. */}
          <Text style={styles.rodape}>{t('pro.joinIsFree')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFillObject, backgroundColor: c.scrim },
  folha: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '88%',
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  pega: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.borderStrong, alignSelf: 'center', marginBottom: space.sm,
  },
  mascote: { alignItems: 'center', marginBottom: space.sm },
  titulo: { ...text.title2, color: c.fg, textAlign: 'center' },
  subtitulo: {
    ...text.body, color: c.fgMuted, textAlign: 'center',
    marginTop: space.xs, marginBottom: space.lg,
  },
  cartao: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.md,
  },
  cartaoTitulo: {
    ...text.caption, color: c.accent,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  marca: {
    width: 22, height: 22, borderRadius: radius.full,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },
  linhaTexto: { ...text.body, color: c.fg, flex: 1 },
  botao: {
    backgroundColor: c.accent, borderRadius: radius.md,
    paddingVertical: space.md, alignItems: 'center', marginTop: space.lg,
  },
  botaoTexto: { ...text.bodyStrong, color: c.fgOnAccent },
  emBreve: {
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    paddingVertical: space.md, alignItems: 'center', marginTop: space.lg,
  },
  emBreveTexto: { ...text.body, color: c.fgMuted },
  secundario: { paddingVertical: space.md, alignItems: 'center' },
  secundarioTexto: { ...text.body, color: c.fgMuted },
  rodape: {
    ...text.caption, color: c.fgSubtle,
    textAlign: 'center', marginTop: space.xs,
  },
});
