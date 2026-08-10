import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clock, Minus, Pencil, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import Avatar from '../../../components/ui/Avatar';
import Press from '../../../components/ui/Press';
import {
  createRoomPost,
  getMyRooms,
  type PostPhotoFile,
  type RoomSummary,
} from '../../../services/rooms';
import { useTheme, type Palette, radius, space, text } from '../../../theme';
import { voltar } from '../../../lib/navegacao';

/** Retrato máximo: 3/4. Acima disso a foto some com o resto da tela. */
const PORTRAIT_LIMIT = 3 / 4;

/** Largura do quadro da mídia. As colunas de contexto dividem o que sobra. */
const LARGURA_MIDIA = 172;

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
 * Compor um post de sala.
 *
 * ## Por que a mídia é o centro, e não dois botões
 *
 * A versão anterior mostrava "Tirar foto" e "Escolher foto" lado a lado, e os
 * dois **sumiam** assim que havia foto, trocados pela imagem. A tela mudava de
 * forma no meio da tarefa: o que estava num lugar passava a estar em outro, e o
 * espaço da foto só existia depois de haver foto.
 *
 * Aqui o quadro da mídia existe desde o início, vazio, no mesmo lugar e do mesmo
 * tamanho. Ele é o objeto da tela — trocar a foto é um lápis sobre o quadro, não
 * um botão que aparece e desaparece.
 *
 * ## Por que o contexto ladeia a foto
 *
 * As duas perguntas que alguém tem antes de publicar são "para onde isto vai" e
 * "isto conta". Antes nenhuma das duas tinha resposta na tela: o nome da sala
 * não aparecia, e se a foto pontuava no desafio só se descobria depois. Agora as
 * duas ladeiam a mídia, que é onde o olho já está.
 *
 * ## Por que "Publicar" subiu para o cabeçalho
 *
 * Como botão de rodapé ele disputava espaço com o teclado — daí o
 * `KeyboardAvoidingView` e o acessório, que continuam aqui pela legenda. No
 * cabeçalho ele está sempre visível e nunca é coberto, e a tela deixa de ter um
 * bloco fixo embaixo empurrando o conteúdo.
 */
export default function RoomPhotoPostScreen() {
  const { id: roomId, nome: nomeDaRota } = useLocalSearchParams<{ id: string; nome?: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [photo, setPhoto] = useState<PostPhotoFile | null>(null);
  // A proporção real da foto escolhida. Teto de 3/4 (retrato máximo) para uma
  // foto muito alta não empurrar a legenda e o botão para fora da tela.
  const [ratio, setRatio] = useState(PORTRAIT_LIMIT);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sala, setSala] = useState<RoomSummary | null>(null);

  /**
   * O nome da sala chega pela rota, e a busca é só a rede de segurança.
   *
   * A tela mostrava "Publicando em —" enquanto `getMyRooms()` não voltava — e
   * para sempre, se a chamada falhasse, porque o `catch` é mudo de propósito.
   * Um traço no lugar do destino é pior que não perguntar: a pessoa está
   * prestes a publicar uma foto e a tela não diz para onde.
   *
   * Quem navega até aqui vem da tela da sala e **já sabe o nome**. Passá-lo
   * como parâmetro faz o destino aparecer no primeiro quadro, sem rede.
   *
   * A busca continua para quem chega por link direto, onde o parâmetro não
   * existe — e é ela também que traz o desafio, que decide se a foto pontua.
   */
  useEffect(() => {
    if (!roomId) return;
    // Falha em silêncio de propósito: não saber o modo do desafio não é razão
    // para impedir a publicação.
    void getMyRooms()
      .then((salas) => setSala(salas.find((s) => s.id === roomId) ?? null))
      .catch(() => {});
  }, [roomId]);

  /** O que a etiqueta mostra: a rota primeiro, a busca depois. */
  const nomeDaSala = nomeDaRota || sala?.name || null;

  /**
   * Se esta foto pontua no desafio da sala.
   *
   * Numa sala em modo `study` o que conta é tempo estudado, então uma foto entra
   * no feed e **não** soma no ranking. Dizer isso antes de publicar é a
   * diferença entre uma expectativa cumprida e a sensação de que o app comeu o
   * post. Sem desafio ativo não há o que pontuar, e o indicador some.
   */
  const desafio = sala?.active_challenge ?? null;
  const pontua = desafio ? (desafio.participation_mode ?? 'photo') === 'photo' : null;

  const adopt = (asset: ImagePicker.ImagePickerAsset) => {
    setPhoto({
      uri: asset.uri,
      name: asset.fileName || 'estudo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
    // A prova não pode ser recortada: mostra-se a foto inteira, na proporção
    // que ela tem. Antes era `4/3` fixo com `cover`, que cortava.
    const natural = asset.width && asset.height ? asset.width / asset.height : PORTRAIT_LIMIT;
    setRatio(Math.max(PORTRAIT_LIMIT, natural));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled && result.assets[0]) adopt(result.assets[0]);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
    if (!result.canceled && result.assets[0]) adopt(result.assets[0]);
  };

  const publish = async () => {
    if (!photo || !roomId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createRoomPost(roomId, photo, caption);
      voltar();
    } catch (err) {
      // A foto NÃO se perde: ela continua no estado e o cabeçalho vira "Tentar
      // de novo". Um `Alert.alert` aqui já custou o post de alguém.
      setError((err as Error)?.message ?? t('rooms.postError'));
      setSubmitting(false);
    }
  };

  /**
   * A foto é o check-in, e por isso ela manda no botão.
   *
   * A legenda é opcional e acompanha a foto — não a substitui. O servidor
   * concorda desde 10/08: até então ele aceitava "foto **ou** legenda", e a
   * tela nunca deixou publicar sem foto. Duas réguas para a mesma pergunta,
   * com a mais restritiva vencendo em silêncio.
   *
   * O motivo de a foto mandar não é estético: a contagem do desafio conta dia
   * com foto como presença na sala. Post de texto tornaria a presença
   * reivindicável digitando uma linha.
   */
  const podePublicar = Boolean(photo) && !submitting;
  const agora = new Date().toLocaleString(i18n.language, {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Press onPress={() => voltar()} style={styles.close}><X size={22} color={c.fgMuted} /></Press>
        <Text style={styles.title}>{t('rooms.newCheckIn')}</Text>
        {/* Ação em texto, e não um bloco fixo no rodapé: aqui ela nunca é
            coberta pelo teclado da legenda. */}
        {/*
          Sem foto, o rótulo **diz** o que falta em vez de só apagar.

          Um botão desativado e mudo é indistinguível de um botão quebrado:
          quem só queria escrever ficava olhando o "Publicar" apagado sem
          nenhuma pista de que a foto era o que faltava.
        */}
        <Press onPress={publish} disabled={!podePublicar} style={styles.close}>
          {submitting
            ? <ActivityIndicator color={c.accent} />
            : (
              <Text style={[styles.acao, !podePublicar && styles.acaoInativa]}>
                {error
                  ? t('rooms.tryAgain')
                  : photo
                    ? t('rooms.publish')
                    : t('rooms.photoRequired')}
              </Text>
            )}
        </Press>
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.rolagem}
          // `handled` e não `always`: escolher foto continua respondendo ao
          // primeiro toque com o teclado aberto.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Toque em área vazia fecha o teclado. `Pressable` sem estilo de
              toque: é área de descarte, não botão. */}
          {/* O `gap` mora aqui, e não no `contentContainerStyle`.
              Ele estava lá — e não fazia nada: o `ScrollView` tem **um** filho
              só, este `Pressable`, então o vão era aplicado entre um elemento e
              o vazio. Os dois cards ficavam colados, encostados pela borda. */}
          <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.blocos}>

            <View style={styles.trio}>
              {/* Para onde vai */}
              {/* Para onde vai.
                  Sem nome, a coluna inteira sai: um rótulo "Publicando em"
                  seguido de traço não informa nada e ainda ocupa espaço que a
                  mídia poderia usar. */}
              {nomeDaSala ? (
                <View style={styles.lado}>
                  <Avatar uri={sala?.cover_url ?? null} name={nomeDaSala} size={36} />
                  <Text style={styles.ladoRotulo}>{t('rooms.postingTo')}</Text>
                  <Text style={styles.ladoValor} numberOfLines={2}>{nomeDaSala}</Text>
                </View>
              ) : (
                // O espaço permanece reservado, senão a mídia salta de posição
                // no instante em que o nome chega.
                <View style={styles.lado} />
              )}

              {/* A mídia. O quadro existe desde o início, vazio.
                  **Tocar o quadro tira foto; o lápis escolhe da galeria.**
                  Antes os dois abriam a galeria quando já havia foto, e o
                  toque no quadro nunca chamava a câmera — o gesto grande da
                  tela servia a ação secundária. */}
              <View style={styles.midia}>
                <Press onPress={takePhoto} style={[styles.quadro, { aspectRatio: photo ? ratio : PORTRAIT_LIMIT }]}>
                  {photo
                    ? <Image source={{ uri: photo.uri }} style={styles.foto} />
                    : <Text style={styles.semFoto}>{t('rooms.noMedia')}</Text>}
                </Press>
                <Press onPress={choosePhoto} style={styles.lapis}>
                  <Pencil size={18} color={c.fg} />
                </Press>
              </View>

              {/* Se conta */}
              <View style={styles.lado}>
                {pontua === null ? null : (
                  <>
                    <View style={[styles.selo, pontua ? styles.seloVale : styles.seloNao]}>
                      {pontua
                        ? <Check size={18} color={c.fgOnAccent} strokeWidth={3} />
                        : <Minus size={18} color={c.fgMuted} strokeWidth={3} />}
                    </View>
                    <Text style={styles.ladoValor} numberOfLines={2}>
                      {t(pontua ? 'rooms.countsForChallenge' : 'rooms.doesNotCount')}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.cartao}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t('rooms.captionPlaceholder')}
                placeholderTextColor={c.fgSubtle}
                multiline
                maxLength={280}
                style={styles.legenda}
                inputAccessoryViewID={Platform.OS === 'ios' ? ACESSORIO_LEGENDA : undefined}
              />
            </View>

            <View style={styles.cartao}>
              <View style={styles.linha}>
                <Clock size={18} color={c.fgMuted} />
                <Text style={styles.linhaRotulo}>{t('rooms.checkInTime')}</Text>
                {/* Só exibido. Quem carimba a hora é o servidor — o cliente
                    nunca manda tempo, e mostrar um campo editável aqui
                    prometeria um controle que não existe. */}
                <Text style={styles.linhaValor}>{agora}</Text>
              </View>
            </View>

            {error ? <Text style={styles.erro}>{error}</Text> : null}
          </Pressable>
        </ScrollView>
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

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  fill: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm },
  close: { minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg, flex: 1, textAlign: 'center' },
  acao: { ...text.bodyStrong, color: c.accent },
  acaoInativa: { color: c.fgSubtle },
  // Sem `gap`: quem espaça os blocos é o `Pressable` que os contém, porque é
  // ele o único filho deste container.
  rolagem: { padding: space.lg },
  blocos: { gap: space.lg },

  // `zIndex` sobe com a mídia: o irmão que contém o lápis precisa vencer o
  // card da legenda, e no RN a disputa acontece entre irmãos do mesmo pai.
  trio: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm, zIndex: 2 },
  // As colunas ficam estreitas de propósito: elas contextualizam a mídia, não
  // competem com ela.
  lado: { flex: 1, alignItems: 'center', gap: space.xs, paddingTop: space.lg },
  ladoRotulo: { ...text.caption, color: c.fgSubtle, textAlign: 'center' },
  ladoValor: { ...text.caption, color: c.fgMuted, textAlign: 'center' },

  /**
   * O lápis pendura 18pt abaixo do quadro, e sem esta folga o card da legenda
   * — desenhado depois, portanto por cima — cobria metade dele. No aparelho o
   * botão simplesmente não recebia o toque: parecia estar lá e não estava.
   */
  /**
   * O lápis pendura 18pt abaixo do quadro, e é isso que exige as duas linhas
   * abaixo.
   *
   * **`zIndex`** é o conserto de verdade. `bottom: -18` transborda o container,
   * e no React Native quem é desenhado depois pinta por cima: o card da legenda
   * cobria metade do lápis, e a metade coberta não recebia toque. O botão
   * parecia estar lá e não estava — foi o defeito relatado duas vezes.
   *
   * **`paddingBottom`** resolve o outro metade do problema, que é visual: sem
   * ele o lápis fica sobre a borda do card mesmo pintando por cima, e dois
   * elementos encostados leem como um erro de alinhamento.
   *
   * Os 40 saem de 18 de transbordo + 22 de respiro. Menos que isso e o lápis
   * volta a tocar o card.
   */
  midia: { paddingBottom: 40, zIndex: 2 },
  quadro: {
    width: LARGURA_MIDIA,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  foto: { width: '100%', height: '100%' },
  semFoto: { ...text.caption, color: c.fgSubtle },
  lapis: {
    position: 'absolute',
    /**
     * Dentro do container, e não transbordando.
     *
     * Era `-18`: o botão saía 18pt para fora, e o vão até o card é
     * `space.lg` (16). Ou seja, ele ocupava o vão inteiro e ainda sobrava
     * 2pt por cima do card — encostado, o que lê como erro de alinhamento
     * mesmo depois de o `zIndex` ter devolvido o toque.
     *
     * Com `22` — os 40 de `paddingBottom` menos os 18 de meio-botão — o lápis
     * fica **centrado na borda inferior do quadro**, exatamente como antes aos
     * olhos, e inteiramente dentro da caixa. Abaixo dele sobram 22 de padding
     * mais 16 do vão: 38pt de respiro até o card.
     */
    bottom: 22,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selo: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  seloVale: { backgroundColor: c.accent },
  seloNao: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },

  cartao: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.lg, zIndex: 1 },
  legenda: { minHeight: 96, color: c.fg, ...text.body, textAlignVertical: 'top', paddingVertical: space.md },
  linha: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  linhaRotulo: { ...text.body, color: c.fg, flex: 1 },
  linhaValor: { ...text.body, color: c.fgMuted },

  erro: { ...text.caption, color: c.danger },
  barraTeclado: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'flex-end', paddingHorizontal: space.lg, paddingVertical: space.sm },
  concluir: { paddingHorizontal: space.md, paddingVertical: space.xs },
  concluirTexto: { ...text.bodyStrong, color: c.accent },
});
