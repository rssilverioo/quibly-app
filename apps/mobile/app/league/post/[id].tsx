import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Images, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import Press from '../../../components/ui/Press';
import SemanaDoCheckIn from '../../../components/checkin/SemanaDoCheckIn';
import { Mascot } from '../../../components/mascot';
import {
  createRoomPost,
  getMyRooms,
  type PostPhotoFile,
  type RoomSummary,
} from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';

/**
 * Âncora da barra "Concluir" acima do teclado.
 *
 * A legenda é `multiline`: Enter tem de quebrar linha, não fechar o teclado —
 * 280 caracteres pedem parágrafo. Sem `returnKeyType` para fechar, o iOS não
 * oferece saída nenhuma, e é isso que prende o usuário. A barra devolve a saída
 * explícita sem tirar a quebra de linha.
 */
const ACESSORIO_LEGENDA = 'legenda-do-post';

/**
 * O check-in: a foto que prova que você apareceu.
 *
 * ## O que esta tela era, e por que mudou
 *
 * Ela punha a foto num quadro de 172pt ladeado por duas colunas de rótulo —
 * "para onde vai" de um lado, "isto conta" do outro. As perguntas eram as
 * certas, e a execução starvava o assunto: **a foto, que é o conteúdo inteiro
 * de um check-in, aparecia menor que o texto que a explicava.**
 *
 * E o lápis de trocar a foto pendurava 18pt abaixo do quadro, onde o card da
 * legenda — desenhado depois, portanto por cima — cobria metade dele. O botão
 * parecia estar lá e não recebia o toque. Relatado duas vezes pelo dono do
 * produto antes de eu encontrar.
 *
 * ## A tese
 *
 * A foto é a tela. Todo o resto flutua sobre ela.
 *
 * As duas perguntas continuam respondidas, por outros meios: a sala é uma
 * etiqueta no topo, e "isto conta" virou `SemanaDoCheckIn` — sete células com a
 * de hoje esperando. Publicar preenche. A resposta deixou de ser um rótulo e
 * passou a ser a demonstração da consequência.
 *
 * ## Por que a foto não é cortada
 *
 * `contain`, e não `cover`. Uma prova recortada é uma prova pela metade: se
 * alguém fotografou a mesa inteira, a mesa inteira é o que a sala vê. O fundo
 * escuro absorve a sobra sem que ela pareça erro.
 */
export default function RoomPhotoPostScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [photo, setPhoto] = useState<PostPhotoFile | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sala, setSala] = useState<RoomSummary | null>(null);

  useEffect(() => {
    if (!roomId) return;
    // Falha em silêncio de propósito: o nome da sala é contexto útil, e não
    // poder mostrá-lo não é razão para impedir a publicação.
    void getMyRooms()
      .then((salas) => setSala(salas.find((s) => s.id === roomId) ?? null))
      .catch(() => {});
  }, [roomId]);

  /**
   * Se esta foto marca o dia no desafio da sala.
   *
   * Em sala no modo `study` o que conta é tempo estudado, então a foto entra no
   * feed e não marca o dia. Dizer isso **antes** de publicar é a diferença
   * entre uma expectativa cumprida e a sensação de que o app comeu o post.
   * `null` enquanto a sala não carregou — a faixa não afirma o que não sabe.
   */
  const desafio = sala?.active_challenge ?? null;
  const marcaODia = desafio ? (desafio.participation_mode ?? 'photo') === 'photo' : null;

  const adotar = (asset: ImagePicker.ImagePickerAsset) => {
    setPhoto({
      uri: asset.uri,
      name: asset.fileName || 'estudo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const tirarFoto = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!r.canceled && r.assets[0]) adotar(r.assets[0]);
  };

  const escolherFoto = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
    if (!r.canceled && r.assets[0]) adotar(r.assets[0]);
  };

  const publicar = async () => {
    if (!photo || !roomId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createRoomPost(roomId, photo, caption);
      router.back();
    } catch (err) {
      // A foto **não** se perde: ela continua no estado e o botão vira "tentar
      // de novo". Um alerta que fecha a tela aqui já custou o post de alguém.
      setError((err as Error)?.message ?? t('rooms.postError'));
      setSubmitting(false);
    }
  };

  const podePublicar = Boolean(photo) && !submitting;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── o palco: a foto, ou o convite de tirar uma ── */}
        <View style={styles.palco}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.foto} resizeMode="contain" />
          ) : (
            <View style={styles.vazio}>
              <Mascot state="wave" size={132} />
              <Text style={styles.vazioTitulo}>{t('rooms.checkInEmptyTitle')}</Text>
              <Text style={styles.vazioTexto}>{t('rooms.checkInEmptyText')}</Text>
            </View>
          )}

          {/* Escurecer topo e base é o que sustenta o texto sobre qualquer foto
              — a de uma mesa clara ao meio-dia inclusive. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.62)', 'transparent']}
            style={styles.scrimTopo}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.78)']}
            style={styles.scrimBase}
            pointerEvents="none"
          />

          <View style={styles.chrome}>
            <Press onPress={() => router.back()} style={styles.fechar} accessibilityLabel={t('close')}>
              <X size={22} color="#FFFFFF" />
            </Press>
            {sala ? (
              <View style={styles.etiquetaSala}>
                <Text style={styles.etiquetaTexto} numberOfLines={1}>{sala.name}</Text>
              </View>
            ) : null}
          </View>

          {/* Trocar a foto vive **dentro** do palco e alinhado ao topo direito,
              onde nada é desenhado depois dele. Era isto que sumia embaixo do
              card da legenda. */}
          {photo ? (
            <View style={styles.trocar}>
              <Press onPress={tirarFoto} style={styles.trocarBotao} accessibilityLabel={t('rooms.takePhoto')}>
                <Camera size={18} color="#FFFFFF" />
              </Press>
              <Press onPress={escolherFoto} style={styles.trocarBotao} accessibilityLabel={t('rooms.choosePhoto')}>
                <Images size={18} color="#FFFFFF" />
              </Press>
            </View>
          ) : null}

          {/* ── o pé: legenda, semana e a ação ── */}
          <View style={styles.pe}>
            {photo ? (
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t('rooms.captionPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                maxLength={280}
                style={styles.legenda}
                inputAccessoryViewID={Platform.OS === 'ios' ? ACESSORIO_LEGENDA : undefined}
              />
            ) : null}

            {error ? <Text style={styles.erro}>{error}</Text> : null}

            {photo ? (
              <View style={styles.acaoLinha}>
                <SemanaDoCheckIn marcaODia={marcaODia} />
                <Press onPress={publicar} disabled={!podePublicar} style={[styles.publicar, !podePublicar && styles.publicarInativo]}>
                  {submitting
                    ? <ActivityIndicator color={c.fgOnAccent} />
                    : <Text style={styles.publicarTexto}>{t(error ? 'rooms.tryAgain' : 'rooms.publish')}</Text>}
                </Press>
              </View>
            ) : (
              <View style={styles.escolhas}>
                <Press onPress={tirarFoto} style={styles.escolhaPrimaria}>
                  <Camera size={19} color={c.fgOnAccent} />
                  <Text style={styles.escolhaPrimariaTexto}>{t('rooms.takePhoto')}</Text>
                </Press>
                <Press onPress={escolherFoto} style={styles.escolhaSecundaria}>
                  <Images size={19} color="#FFFFFF" />
                  <Text style={styles.escolhaSecundariaTexto}>{t('rooms.choosePhoto')}</Text>
                </Press>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ACESSORIO_LEGENDA}>
          <View style={styles.barraTeclado}>
            <Press onPress={Keyboard.dismiss} style={styles.concluir}>
              <Text style={styles.concluirTexto}>{t('rooms.done')}</Text>
            </Press>
          </View>
        </InputAccessoryView>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * O palco é escuro nos dois temas, e é a única tela do app assim junto do
 * login.
 *
 * Não é preferência: é a régua de qualquer superfície onde uma imagem é o
 * conteúdo. Fundo claro em volta de uma foto rouba o contraste dela e faz a
 * borda da imagem competir com a moldura. Todo app de câmera do mundo é escuro
 * pela mesma razão.
 */
const makeStyles = (c: Palette) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#08080C' },
  fill: { flex: 1 },
  palco: { flex: 1, justifyContent: 'center' },
  foto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },

  /**
   * O vão embaixo compensa o pé, que é absoluto.
   *
   * `justifyContent: 'center'` centraliza na altura **inteira** do palco, e o
   * pé cobre os últimos ~200pt. Sem esta folga o conteúdo fica ótico-baixo: um
   * buraco no topo e o coelho encostando nos botões.
   */
  vazio: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: 180,
    gap: space.sm,
  },
  vazioTitulo: { ...text.title3, color: '#FFFFFF', textAlign: 'center' },
  vazioTexto: {
    ...text.body,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    lineHeight: 21,
  },

  scrimTopo: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  scrimBase: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },

  chrome: {
    position: 'absolute',
    top: 0,
    left: space.sm,
    right: space.sm,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  etiquetaSala: {
    flex: 1,
    alignItems: 'center',
  },
  etiquetaTexto: {
    ...text.caption,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },

  trocar: {
    position: 'absolute',
    top: 60,
    right: space.lg,
    gap: space.sm,
  },
  trocarBotao: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    // Respiro maior embaixo: o botão encostava na borda da tela, que num
    // aparelho com barra de gestos é onde o polegar arrasta o sistema.
    paddingBottom: space.xl,
    gap: space.md,
  },
  legenda: {
    ...text.body,
    color: '#FFFFFF',
    maxHeight: 96,
    textAlignVertical: 'top',
  },
  erro: { ...text.caption, color: '#FF8080' },

  acaoLinha: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  publicar: {
    backgroundColor: c.accent,
    borderRadius: radius.full,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    minWidth: 132,
    alignItems: 'center',
  },
  publicarInativo: { opacity: 0.45 },
  publicarTexto: { ...text.bodyStrong, color: c.fgOnAccent },

  escolhas: { gap: space.sm },
  escolhaPrimaria: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: c.accent,
    borderRadius: radius.full,
    paddingVertical: space.md,
  },
  escolhaPrimariaTexto: { ...text.bodyStrong, color: c.fgOnAccent },
  escolhaSecundaria: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: space.md,
  },
  escolhaSecundariaTexto: { ...text.bodyStrong, color: '#FFFFFF' },

  barraTeclado: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  concluir: { paddingHorizontal: space.md, paddingVertical: space.xs },
  concluirTexto: { ...text.bodyStrong, color: c.accent },
});
