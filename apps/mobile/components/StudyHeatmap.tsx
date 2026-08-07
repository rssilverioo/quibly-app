import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getStudyHeatmap } from '../services/sessions';
import { diasComEstudo, montarSemanas, rotulosDeMes, type DiaDoMapa } from '../lib/study-heatmap';
import Press from './ui/Press';
import { useTheme, type Palette, radius, space, text } from '../theme';

/** Lado do quadradinho, e o respiro entre eles. */
const CELULA = 12;
const VAO = 3;
/** O passo de uma coluna para a próxima. É o que posiciona o nome do mês. */
const PASSO = CELULA + VAO;
/** Faixa dos nomes de mês, acima da grade. */
const ALTURA_MES = 15;
/** Coluna fixa dos dias da semana, à esquerda. */
const LARGURA_DIAS = 28;
/**
 * Largura reservada a um nome de mês abreviado (3 letras a 10pt).
 *
 * Serve para encostar o último rótulo na borda em vez de deixá-lo transbordar:
 * o mês corrente costuma ocupar uma coluna só, e sem esse recuo "ago" sairia
 * metade para fora da área que rola.
 */
const LARGURA_ROTULO_MES = 24;

/**
 * Só seg/qua/sex ganham nome, como no GitHub. Os sete caberiam — em 12pt de
 * altura, ilegíveis e encostados uns nos outros. Três bastam para o olho
 * ancorar a linha, que é a única função deles.
 */
const DIAS_NOMEADOS = [1, 3, 5];

/** Uma lista de textos, ou nada — nunca uma string fatiada por engano. */
const lista = (v: unknown): string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : [];

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
  // Meses e dias da semana vivem em `common`: são vocabulário de calendário, não
  // do perfil, e o `StreakCalendarModal` ainda os carrega em array no código.
  const { t: tc } = useTranslation('common');
  const styles = useMemo(() => makeStyles(c), [c]);
  const scroller = useRef<ScrollView>(null);

  const [semanas, setSemanas] = useState<DiaDoMapa[][]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  /**
   * `vivo` mora fora do efeito de busca para que o retry possa descartar a
   * resposta de uma tentativa anterior que chegue atrasada.
   *
   * O `vivo.current = true` na entrada não é redundante: em StrictMode o React
   * monta, desmonta e remonta: sem ele a limpeza do primeiro ciclo deixaria a
   * flag em `false` para sempre, e o mapa nunca sairia de "carregando" — some
   * da tela em dev e aparece em produção, que é o pior tipo de bug.
   */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const mapa = await getStudyHeatmap();
      if (!vivo.current) return;
      const porDia = Object.fromEntries(mapa.days.map((d) => [d.date, d.minutes]));
      setSemanas(montarSemanas(mapa.from, mapa.to, porDia));
      setFalhou(false);
    } catch (erro) {
      console.warn('[mapa de constância] não deu para carregar', erro);
      if (vivo.current) setFalhou(true);
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * **O mapa não some quando a busca falha.**
   *
   * Este bloco já devolveu `null` para os três estados de uma vez, com o
   * comentário de que "sem dado o bloco some". Só que sem dado ele **não** some:
   * `montarSemanas` só devolve vazio com a janela invertida (`study-heatmap.ts`),
   * e a API sempre manda `from` ≤ `to`. Conta sem nenhum estudo desenha a grade
   * cinza dizendo "0 dias" — que é a resposta certa para "nunca estudei".
   *
   * Ou seja, o único caminho até o invisível era a falha, e ela desenhava igual
   * a "não existe mapa". O `console.warn` continua, mas ninguém lê console num
   * device: era o mesmo defeito que fez o feed passar semanas parecendo vazio.
   */
  if (falhou) {
    return (
      <Press haptic="light" scale={0.98} onPress={carregar} style={[styles.bloco, styles.blocoErro]}>
        <Text style={styles.erro}>{t('heatmapError')}</Text>
        <Text style={styles.tentar}>{tc('retry')}</Text>
      </Press>
    );
  }

  // Carregando devolve nada de propósito: um esqueleto que pisca a cada abertura
  // do perfil é ruído, e a espera aqui é curta. `semanas` vazio fica como rede —
  // janela invertida não deve desenhar uma grade que mente.
  if (carregando || semanas.length === 0) {
    return null;
  }

  const total = diasComEstudo(semanas);
  const meses = rotulosDeMes(semanas);
  // `returnObjects` devolve a chave crua como string se a tradução faltar, e aí
  // `nomes[3]` daria a *letra* de índice 3 — meses viram "n", "t", "s". A grade
  // ficaria de pé com legendas sem sentido, que é pior do que sem legenda.
  const nomesDeMes = lista(tc('monthsShort', { returnObjects: true }));
  const nomesDeDia = lista(tc('weekdaysShort', { returnObjects: true }));

  return (
    <View style={styles.bloco}>
      <View style={styles.cabecalho}>
        {/* Plural pelo i18next (`_one`/`_other`), não por `total === 1` no
            código: em inglês e português a regra coincide, mas escrevê-la aqui
            faria a próxima língua chegar com o plural já errado. */}
        <Text style={styles.titulo}>{t('heatmapDays', { count: total })}</Text>
        <Text style={styles.periodo}>{t('heatmapPeriod')}</Text>
      </View>

      <View style={styles.corpo}>
        {/* Os dias da semana ficam FORA do ScrollView. Dentro, eles rolariam
            junto com a grade e a legenda da linha sumiria justamente quando se
            olha para dezembro — que é quando ela serve para alguma coisa. */}
        <View style={styles.diasDaSemana}>
          <View style={{ height: ALTURA_MES }} />
          {nomesDeDia.map((nome, i) => (
            <Text key={i} style={styles.rotuloDia}>
              {DIAS_NOMEADOS.includes(i) ? nome : ''}
            </Text>
          ))}
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Abre em "hoje". `onContentSizeChange` e não `useEffect`: a largura só
          // existe depois do primeiro layout.
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          <View>
            {/* Os meses são posicionados por `left`, e não por uma célula vazia
                por coluna: o nome é mais largo que os 12pt da coluna, e num
                layout de fluxo ele empurraria a grade para fora do alinhamento. */}
            <View style={[styles.faixaDeMeses, { width: semanas.length * PASSO }]}>
              {meses.map(({ coluna, mes }) => (
                <Text
                  key={`${coluna}-${mes}`}
                  style={[
                    styles.rotuloMes,
                    {
                      // O último rótulo cede alguns pontos para a esquerda em vez
                      // de transbordar. Desalinha um pouco da coluna, e é o preço
                      // de o mês corrente sempre aparecer.
                      left: Math.min(
                        coluna * PASSO,
                        semanas.length * PASSO - LARGURA_ROTULO_MES,
                      ),
                    },
                  ]}
                >
                  {nomesDeMes[mes]}
                </Text>
              ))}
            </View>

            <View style={styles.grade}>
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
                        // O recuo até domingo existe para alinhar a semana, não
                        // para afirmar que houve estudo antes da janela.
                        dia.preenchimento && styles.forasDaJanela,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

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
  /**
   * O estado de falha herda a moldura do bloco para o perfil não pular de
   * altura quando a rede volta — o mapa aparece no lugar onde o aviso estava.
   * Não usa `c.danger`: um mapa que não carregou é menos grave que uma sessão
   * perdida, e gastar o vermelho aqui o desvaloriza onde ele importa.
   */
  blocoErro: { gap: space.xs, alignItems: 'center' },
  erro: { ...text.caption, color: c.fgMuted, textAlign: 'center' },
  tentar: { ...text.caption, color: c.accent, textAlign: 'center' },
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  titulo: { ...text.bodyStrong, color: c.fg },
  periodo: { ...text.caption, color: c.fgMuted },
  corpo: { flexDirection: 'row' },
  diasDaSemana: { width: LARGURA_DIAS },
  /**
   * 10pt e não `text.caption` (12): aqui o texto precisa caber na altura de uma
   * célula, e `lineHeight` tem de ser exatamente `CELULA` para a linha do nome
   * cair sobre a linha dos quadrados. Um `lineHeight` de token desalinharia os
   * dois — é a única exceção de escala do bloco, e é geométrica.
   */
  rotuloDia: {
    fontSize: 10,
    lineHeight: CELULA,
    height: CELULA,
    marginBottom: VAO,
    color: c.fgMuted,
  },
  faixaDeMeses: { height: ALTURA_MES },
  rotuloMes: { position: 'absolute', top: 0, fontSize: 10, lineHeight: ALTURA_MES, color: c.fgMuted },
  grade: { flexDirection: 'row', gap: VAO },
  coluna: { gap: VAO },
  celula: { width: CELULA, height: CELULA, borderRadius: 3 },
  forasDaJanela: { opacity: 0.25 },
  // Alinhada à direita, embaixo da grade, como no GitHub — e não centralizada:
  // a legenda é nota de rodapé, não um segundo cabeçalho.
  legenda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: VAO },
  legendaTexto: { ...text.caption, color: c.fgMuted, marginHorizontal: space.xs },
});
