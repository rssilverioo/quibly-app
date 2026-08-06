import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getStudyHeatmap } from '../services/sessions';
import { diasComEstudo, montarSemanas, type DiaDoMapa } from '../lib/study-heatmap';
import { useTheme, type Palette, radius, space, text } from '../theme';

/** Lado do quadradinho, e o respiro entre eles. */
const CELULA = 12;
const VAO = 3;

/**
 * O mapa de constância do perfil — as barrinhas do GitHub, em azul.
 *
 * ## Por que azul, e não verde
 *
 * `MARCA` fixa **um accent por tela**, e ele é o azul do coelho. Um verde novo
 * só para este bloco criaria uma segunda cor de marca para dizer a mesma coisa
 * que o accent já diz. Os degraus saem da opacidade do próprio `c.accent`, o
 * que também resolve o modo escuro sem uma segunda paleta.
 *
 * ## Por que rola na horizontal
 *
 * 53 semanas × 15pt são ~795pt. Espremer isso em 408 daria células de 7pt —
 * pequenas demais para ler e pequenas demais para tocar. O GitHub rola no
 * celular pelo mesmo motivo. Abre no fim, mostrando **hoje**: o dado com valor
 * é a sequência recente, não janeiro.
 */
export default function StudyHeatmap() {
  const { c } = useTheme();
  const { t } = useTranslation('profile');
  const styles = useMemo(() => makeStyles(c), [c]);
  const scroller = useRef<ScrollView>(null);

  const [semanas, setSemanas] = useState<DiaDoMapa[][]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mapa = await getStudyHeatmap();
        if (!vivo) return;
        const porDia = Object.fromEntries(mapa.days.map((d) => [d.date, d.minutes]));
        setSemanas(montarSemanas(mapa.from, mapa.to, porDia));
        setFalhou(false);
      } catch (erro) {
        // Nunca em silêncio: mapa vazio e mapa quebrado não podem desenhar
        // igual — foi assim que o feed passou semanas parecendo vazio.
        console.warn('[mapa de constância] não deu para carregar', erro);
        if (vivo) setFalhou(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (carregando || falhou || semanas.length === 0) {
    // Sem dado, o bloco inteiro some. Um esqueleto permanente no perfil seria
    // ruído; e quem nunca estudou não precisa de um mapa vazio para saber.
    return null;
  }

  const total = diasComEstudo(semanas);

  return (
    <View style={styles.bloco}>
      <View style={styles.cabecalho}>
        {/* Plural pelo i18next (`_one`/`_other`), não por `total === 1` no
            código: em inglês e português a regra coincide, mas escrevê-la aqui
            faria a próxima língua chegar com o plural já errado. */}
        <Text style={styles.titulo}>{t('heatmapDays', { count: total })}</Text>
        <Text style={styles.periodo}>{t('heatmapPeriod')}</Text>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Abre em "hoje". `onContentSizeChange` e não `useEffect`: a largura só
        // existe depois do primeiro layout.
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={styles.grade}
      >
        {semanas.map((semana) => (
          <View key={semana[0].data} style={styles.coluna}>
            {semana.map((dia) => (
              <View
                key={dia.data}
                style={[
                  styles.celula,
                  dia.nivel === 0
                    ? { backgroundColor: c.skeleton }
                    : { backgroundColor: c.accent, opacity: OPACIDADE[dia.nivel] },
                  // O recuo até domingo existe para alinhar a semana, não para
                  // afirmar que houve estudo antes da janela.
                  dia.preenchimento && styles.forasDaJanela,
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.legenda}>
        <Text style={styles.legendaTexto}>{t('heatmapLess')}</Text>
        <View style={[styles.celula, { backgroundColor: c.skeleton }]} />
        {([1, 2, 3, 4] as const).map((n) => (
          <View
            key={n}
            style={[styles.celula, { backgroundColor: c.accent, opacity: OPACIDADE[n] }]}
          />
        ))}
        <Text style={styles.legendaTexto}>{t('heatmapMore')}</Text>
      </View>
    </View>
  );
}

/**
 * Os quatro degraus. Começam em 0,25 e não em 0,1: abaixo disso o quadrado some
 * contra o `surface` no modo claro, e um dia estudado que não aparece é pior do
 * que nenhum mapa.
 */
const OPACIDADE: Record<1 | 2 | 3 | 4, number> = {
  1: 0.25,
  2: 0.5,
  3: 0.75,
  4: 1,
};

const makeStyles = (c: Palette) => StyleSheet.create({
  bloco: {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.md,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  titulo: { ...text.bodyStrong, color: c.fg },
  periodo: { ...text.caption, color: c.fgMuted },
  grade: { flexDirection: 'row', gap: VAO },
  coluna: { gap: VAO },
  celula: { width: CELULA, height: CELULA, borderRadius: 3 },
  forasDaJanela: { opacity: 0.25 },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: VAO },
  legendaTexto: { ...text.caption, color: c.fgMuted, marginHorizontal: space.xs },
});
