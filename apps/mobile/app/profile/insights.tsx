import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import Press from '../../components/ui/Press';
import FolhaDoPro from '../../components/plano/FolhaDoPro';
import { getInsights, horaLocal, type Insights } from '../../services/insights';
import { ApiError } from '../../lib/http-errors';
import { formatarTempoDeEstudo } from '../../lib/study-time';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { voltar } from '../../lib/navegacao';

/**
 * As estatísticas do Pro: o histórico lido de três jeitos.
 *
 * Sem biblioteca de gráfico. Oito barras e uma lista com proporção são
 * `View`s com largura em porcentagem — é o que o GymRats faz na tela de
 * estatísticas dele, e é o que cabe numa tela que a pessoa olha por dez
 * segundos. Um gráfico de verdade viria com eixo, legenda e dependência
 * nativa, e nenhum dos três ajudaria a responder "estudei mais esta semana?".
 *
 * O servidor manda minutos; quem formata é `formatarTempoDeEstudo`, a mesma
 * regra do app inteiro (minuto até fechar a hora, hora depois).
 *
 * Quem chega aqui sem ser Pro (deep link, plano que expirou) recebe o 403
 * `PRO_REQUIRED` e vê a folha do Pro, não uma tela vazia.
 */
export default function InsightsScreen() {
  const { t, i18n } = useTranslation('profile');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [dados, setDados] = useState<Insights | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaDoPro, setPrecisaDoPro] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setDados(await getInsights());
    } catch (err) {
      if (err instanceof ApiError && err.body?.code === 'PRO_REQUIRED') {
        setPrecisaDoPro(true);
        return;
      }
      setErro(t('insights.error'));
    }
  }, [t]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const maiorSemana = Math.max(1, ...(dados?.semanas.map((s) => s.minutos) ?? [1]));
  const maiorMateria = Math.max(1, ...(dados?.materias.map((m) => m.minutos) ?? [1]));

  const rotuloDaSemana = (iso: string) => {
    const [ano, mes, dia] = iso.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    return d.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Press onPress={() => voltar()} style={styles.back}>
          <ArrowLeft size={22} color={c.fg} />
        </Press>
        <Text style={styles.headerTitle}>{t('insights.title')}</Text>
        <View style={styles.back} />
      </View>

      {precisaDoPro ? (
        <FolhaDoPro visivel motivo="insights" aoFechar={() => voltar()} />
      ) : erro ? (
        <View style={styles.centro}>
          <Text style={styles.erro}>{erro}</Text>
          <Press onPress={carregar} style={styles.tentar}>
            <Text style={styles.tentarTexto}>{t('common:retry', { defaultValue: 'Tentar de novo' })}</Text>
          </Press>
        </View>
      ) : !dados ? (
        <View style={styles.centro}>
          <ActivityIndicator color={c.fgMuted} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
          {/* 1 — os dois números dos últimos 30 dias */}
          <View style={styles.resumo}>
            <View style={styles.resumoCelula}>
              <Text style={styles.resumoValor}>{formatarTempoDeEstudo(dados.total30Dias)}</Text>
              <Text style={styles.resumoRotulo}>{t('insights.last30')}</Text>
            </View>
            <View style={styles.resumoDivisor} />
            <View style={styles.resumoCelula}>
              <Text style={styles.resumoValor}>
                {dados.melhorHora
                  ? t('insights.bestHourValue', { hour: horaLocal(dados.melhorHora.hora) })
                  : '—'}
              </Text>
              <Text style={styles.resumoRotulo}>
                {dados.melhorHora ? t('insights.bestHour') : t('insights.noBestHour')}
              </Text>
            </View>
          </View>

          {/* 2 — oito semanas, barras de baixo para cima */}
          <Text style={styles.secao}>{t('insights.weeks')}</Text>
          <View style={styles.cartao}>
            <View style={styles.barras}>
              {dados.semanas.map((s, i) => {
                const atual = i === dados.semanas.length - 1;
                return (
                  <View key={s.inicio} style={styles.barraColuna}>
                    <Text style={styles.barraValor} numberOfLines={1}>
                      {s.minutos > 0 ? formatarTempoDeEstudo(s.minutos) : ''}
                    </Text>
                    <View style={styles.barraTrilho}>
                      <View
                        style={[
                          styles.barraCheia,
                          {
                            height: `${Math.max(3, (s.minutos / maiorSemana) * 100)}%`,
                            backgroundColor: atual ? c.accent : c.accentSoft,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barraRotulo} numberOfLines={1}>{rotuloDaSemana(s.inicio)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 3 — matérias dos últimos 30 dias, com proporção */}
          <Text style={styles.secao}>{t('insights.subjects')}</Text>
          <View style={styles.cartao}>
            {dados.materias.length === 0 ? (
              <Text style={styles.vazio}>{t('insights.noSubjects')}</Text>
            ) : (
              dados.materias.map((m) => (
                <View key={m.id} style={styles.materia}>
                  <View style={styles.materiaLinha}>
                    <Text style={styles.materiaNome} numberOfLines={1}>{m.nome}</Text>
                    <Text style={styles.materiaTempo}>{formatarTempoDeEstudo(m.minutos)}</Text>
                  </View>
                  <View style={styles.materiaTrilho}>
                    <View style={[styles.materiaCheia, { width: `${Math.max(2, (m.minutos / maiorMateria) * 100)}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: space.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { height: 56, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.bodyStrong, color: c.fg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  erro: { ...text.body, color: c.fgMuted, textAlign: 'center' },
  tentar: { paddingVertical: space.md, paddingHorizontal: space.xl, borderRadius: radius.full, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  tentarTexto: { ...text.bodyStrong, color: c.fg },
  conteudo: { paddingHorizontal: space.lg },

  resumo: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, padding: space.lg, marginBottom: space.xl },
  resumoCelula: { flex: 1, alignItems: 'center', gap: 2 },
  resumoDivisor: { width: 1, backgroundColor: c.border },
  resumoValor: { ...text.title2, color: c.fg },
  resumoRotulo: { ...text.caption, color: c.fgMuted },

  secao: { ...text.bodyStrong, color: c.fg, marginBottom: space.md },
  cartao: { backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, padding: space.lg, marginBottom: space.xl },

  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, height: 160 },
  barraColuna: { flex: 1, alignItems: 'center', height: '100%' },
  barraValor: { ...text.caption, color: c.fgSubtle, fontSize: 9, height: 14 },
  barraTrilho: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barraCheia: { width: '100%', borderRadius: radius.sm },
  barraRotulo: { ...text.caption, color: c.fgMuted, fontSize: 9, marginTop: space.xs },

  materia: { gap: space.xs, marginBottom: space.md },
  materiaLinha: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  materiaNome: { ...text.body, color: c.fg, flex: 1 },
  materiaTempo: { ...text.bodyStrong, color: c.fg },
  materiaTrilho: { height: 6, borderRadius: radius.full, backgroundColor: c.surfacePressed, overflow: 'hidden' },
  materiaCheia: { height: '100%', borderRadius: radius.full, backgroundColor: c.accent },
  vazio: { ...text.body, color: c.fgMuted },
});
