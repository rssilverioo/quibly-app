import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Press from '../ui/Press';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import {
  MOTIVOS_DENUNCIA,
  bloquear as bloquearPessoa,
  denunciar,
  type AlvoDenuncia,
  type MotivoDenuncia,
} from '../../services/moderation';

/**
 * O que aparece quando alguém segura um post ou uma mensagem.
 *
 * ## Por que as duas ações moram na mesma folha
 *
 * A Apple exige denunciar e bloquear (Guideline 1.2), e a tentação é fazer
 * duas portas. Mas quem chega aqui tem **um** problema — "não quero mais ver
 * isto" — e as duas ações respondem a ele em prazos diferentes: bloquear
 * resolve agora, denunciar resolve depois, quando alguém olhar a fila.
 *
 * Separar obrigaria a pessoa a entender essa diferença antes de conseguir o
 * que quer. Juntas, ela escolhe o motivo e leva o bloqueio no mesmo gesto.
 *
 * ## Por que bloquear é opcional aqui
 *
 * Nem toda denúncia é sobre alguém que a pessoa quer sumir da vida — spam de
 * um colega de sala é chato, não é assédio. O padrão vem ligado porque o caso
 * comum é querer os dois, e desligar é um toque.
 */
export default function FolhaDeDenuncia({
  visivel,
  alvo,
  alvoId,
  autorId,
  autorNome,
  aoFechar,
  aoConcluir,
}: {
  visivel: boolean;
  alvo: AlvoDenuncia;
  alvoId: string;
  /** Quem escreveu. Ausente quando não há ninguém a bloquear. */
  autorId?: string | null;
  autorNome?: string | null;
  aoFechar: () => void;
  /** Chamado depois de concluir, para a tela recarregar sem o conteúdo. */
  aoConcluir?: () => void;
}) {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [tambemBloquear, setTambemBloquear] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeBloquear = !!autorId;

  const enviar = async () => {
    if (!motivo || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await denunciar(alvo, alvoId, motivo);
      // Sequencial e não em paralelo: se o bloqueio falhar, a denúncia já está
      // registrada — e é ela que não pode se perder.
      if (tambemBloquear && autorId) await bloquearPessoa(autorId);

      setMotivo(null);
      aoFechar();
      aoConcluir?.();
    } catch (err) {
      setErro((err as Error)?.message ?? t('moderation.error'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      {/* Fundo escuro que fecha ao toque: folha sem saída óbvia é armadilha. */}
      <Press haptic={false} scale={1} onPress={aoFechar} style={styles.fundo}>
        <View />
      </Press>

      <View style={styles.folha}>
        <View style={styles.pega} />
        <Text style={styles.titulo}>{t('moderation.reportTitle')}</Text>
        <Text style={styles.subtitulo}>{t('moderation.reportSubtitle')}</Text>

        {MOTIVOS_DENUNCIA.map((m) => (
          <Press
            key={m}
            onPress={() => setMotivo(m)}
            style={[styles.motivo, motivo === m && styles.motivoEscolhido]}
          >
            <Text style={[styles.motivoTexto, motivo === m && styles.motivoTextoEscolhido]}>
              {t(`moderation.reason.${m}`)}
            </Text>
          </Press>
        ))}

        {podeBloquear ? (
          <Press onPress={() => setTambemBloquear((v) => !v)} style={styles.tambem}>
            <View style={[styles.caixa, tambemBloquear && styles.caixaMarcada]} />
            <Text style={styles.tambemTexto}>
              {t('moderation.alsoBlock', { name: autorNome ?? t('moderation.thisPerson') })}
            </Text>
          </Press>
        ) : null}

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <Press
          onPress={enviar}
          disabled={!motivo || enviando}
          style={[styles.enviar, (!motivo || enviando) && styles.enviarInativo]}
        >
          <Text style={styles.enviarTexto}>
            {enviando ? t('sending') : t('moderation.submit')}
          </Text>
        </Press>

        {/* O aviso existe porque expectativa errada é o que gera revolta: quem
            denuncia e vê o post continuar lá conclui que não funcionou. */}
        <Text style={styles.aviso}>{t('moderation.reviewNotice')}</Text>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFillObject, backgroundColor: c.scrim },
  folha: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  pega: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.borderStrong, alignSelf: 'center', marginBottom: space.md,
  },
  titulo: { ...text.title3, color: c.fg },
  subtitulo: { ...text.caption, color: c.fgMuted, marginBottom: space.sm },
  motivo: {
    paddingVertical: space.md, paddingHorizontal: space.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  motivoEscolhido: { borderColor: c.accent, backgroundColor: c.accentSoft },
  motivoTexto: { ...text.body, color: c.fg },
  motivoTextoEscolhido: { color: c.accent },
  tambem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  caixa: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 2, borderColor: c.borderStrong,
  },
  caixaMarcada: { backgroundColor: c.accent, borderColor: c.accent },
  tambemTexto: { ...text.body, color: c.fg, flex: 1 },
  erro: { ...text.caption, color: c.danger },
  enviar: {
    backgroundColor: c.accent, borderRadius: radius.md,
    paddingVertical: space.md, alignItems: 'center', marginTop: space.sm,
  },
  enviarInativo: { opacity: 0.5 },
  enviarTexto: { ...text.bodyStrong, color: c.fgOnAccent },
  aviso: { ...text.caption, color: c.fgSubtle, textAlign: 'center', marginTop: space.sm },
});
