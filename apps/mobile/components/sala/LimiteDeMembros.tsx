import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Press from '../ui/Press';
import { useTheme, type Palette, radius, space, text } from '../../theme';

/**
 * Quanta gente cabe na sala — escolha do dono.
 *
 * ## Por que opções e não um campo de número
 *
 * Um campo aberto faz a pessoa inventar um número, e nenhum número inventado é
 * melhor que o padrão. As quatro opções dizem, sem texto, qual é a faixa
 * razoável: grupo pequeno, turma, sala grande, teto.
 *
 * Também elimina o teclado numérico e a validação de "digitou 3000" — o valor
 * inválido não chega a existir.
 *
 * ## Por que o mesmo teto para todo mundo
 *
 * 100 é limite de legibilidade, não de plano. Acima disso o feed e o ranking
 * deixam de ser reconhecíveis, e reconhecer quem apareceu é a mecânica.
 *
 * Vender tamanho de sala seria a alavanca errada: capar a sala não custa nada
 * ao dono, custa a quem foi convidado e lê "sala cheia" na porta. O Pro dá sala
 * **ilimitada em quantidade**, que é despesa de quem paga.
 */
export const TAMANHOS = [10, 25, 50, 100] as const;

export default function LimiteDeMembros({
  valor,
  aoEscolher,
  jaDentro = 0,
}: {
  valor: number;
  aoEscolher: (n: number) => void;
  /**
   * Quantas pessoas já estão na sala. As opções abaixo disso ficam
   * indisponíveis: encolher a sala não expulsa ninguém, e um botão que promete
   * o que o servidor vai recusar é pior que um botão ausente.
   */
  jaDentro?: number;
}) {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.cartao}>
      <Text style={styles.rotulo}>{t('rooms.roomSize')}</Text>

      <View style={styles.linha}>
        {TAMANHOS.map((n) => {
          const escolhido = n === valor;
          const cabe = n >= jaDentro;
          return (
            <Press
              key={n}
              onPress={() => cabe && aoEscolher(n)}
              disabled={!cabe}
              style={[styles.opcao, escolhido && styles.opcaoAtiva, !cabe && styles.opcaoFora]}
            >
              <Text style={[styles.numero, escolhido && styles.numeroAtivo]}>{n}</Text>
            </Press>
          );
        })}
      </View>

      {jaDentro > 0 ? (
        <Text style={styles.dentro}>{t('rooms.roomSizeInside', { count: jaDentro })}</Text>
      ) : null}
      <Text style={styles.nota}>{t('rooms.roomSizeHint')}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    cartao: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: space.sm,
    },
    rotulo: { ...text.caption, color: c.fgMuted },

    linha: { flexDirection: 'row', gap: space.sm },
    opcao: {
      flex: 1,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    opcaoAtiva: { backgroundColor: c.accent, borderColor: c.accent },
    // Opacidade e não cor cinza: o número continua legível, e o que muda é a
    // disponibilidade — que é o que se quer comunicar.
    opcaoFora: { opacity: 0.35 },
    numero: { ...text.bodyStrong, color: c.fg },
    numeroAtivo: { color: c.fgOnAccent },

    dentro: { ...text.caption, color: c.fgMuted },
    nota: { ...text.caption, color: c.fgSubtle, lineHeight: 17 },
  });
