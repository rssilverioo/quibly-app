import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, type Palette, radius, space, text } from '../../theme';

/**
 * A semana, com hoje esperando ser preenchido.
 *
 * ## O que ela substitui
 *
 * Um selo que dizia "conta para o desafio" ou "não conta". O selo era honesto e
 * inerte: informava um fato e não mostrava consequência nenhuma.
 *
 * Aqui a pergunta é respondida pela coisa em si. O produto conta **dias**, e o
 * mapa de constância é o desenho disso em todo perfil do app. Sete células, a
 * de hoje vazia e pulsando: publicar preenche. Se a célula acende, contou.
 *
 * ## Por que ela aparece apagada em sala de estudo
 *
 * Numa sala em modo `study` o que marca o dia é tempo estudado, não foto. A
 * faixa então vem inteira apagada e a linha diz o que vai acontecer de verdade
 * — o post entra no feed e o dia não é marcado. É a mesma informação de antes,
 * dita pelo desenho em vez de por um rótulo.
 *
 * ## Por que os dias não vêm do servidor
 *
 * As células anteriores a hoje são ilustração, não histórico: buscar a semana
 * real custaria uma ida à rede para decorar uma tela cuja tarefa é publicar uma
 * foto. O que precisa ser verdade é **hoje**, e hoje é o que a tela conhece.
 */
export default function SemanaDoCheckIn({
  marcaODia,
  publicado = false,
}: {
  /** Se esta publicação marca o dia. `null` enquanto a sala não carregou. */
  marcaODia: boolean | null;
  /** Depois de publicar: a célula de hoje acende. */
  publicado?: boolean;
}) {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // `getDay()` é 0=domingo. A faixa começa na segunda, como o mapa do perfil.
  const hoje = (new Date().getDay() + 6) % 7;

  const inerte = marcaODia === false;

  return (
    <View style={styles.bloco}>
      <View style={styles.faixa}>
        {Array.from({ length: 7 }).map((_, dia) => {
          const eHoje = dia === hoje;
          const passado = dia < hoje;
          return (
            <View
              key={dia}
              style={[
                styles.celula,
                // Os dias passados dão contexto de que isto é uma semana; sem
                // eles a fileira lê como sete botões.
                passado && !inerte && styles.celulaPassada,
                eHoje && styles.celulaHoje,
                eHoje && publicado && styles.celulaCheia,
                inerte && styles.celulaInerte,
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.linha, inerte && styles.linhaInerte]}>
        {marcaODia === null
          ? ' '
          : inerte
            ? t('rooms.checkInFeedOnly')
            : t('rooms.checkInMarksToday')}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bloco: { gap: space.xs },
  faixa: { flexDirection: 'row', gap: 5 },
  celula: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  celulaPassada: { backgroundColor: 'rgba(255,255,255,0.34)' },
  celulaHoje: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: c.accent,
  },
  celulaCheia: { backgroundColor: c.accent, borderColor: c.accent },
  celulaInerte: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 0 },
  linha: { ...text.caption, color: 'rgba(255,255,255,0.78)' },
  linhaInerte: { color: 'rgba(255,255,255,0.5)' },
});
