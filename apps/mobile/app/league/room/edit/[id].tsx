import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Camera, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import Press from '../../../../components/ui/Press';
import {
  deleteRoom,
  updateRoom,
  updateRoomCover,
  type PostPhotoFile,
} from '../../../../services/rooms';
import { roomCoverForId } from '../../../../assets/room-covers';
import { useTheme, type Palette, radius, space, text } from '../../../../theme';
import { voltar } from '../../../../lib/navegacao';

/**
 * Editar a sala — só o dono chega aqui.
 *
 * ## O que não está nesta tela, e por quê
 *
 * **A data.** Ela define a janela do desafio, e mexer nela com gente estudando
 * mudaria o resultado de uma disputa em andamento: dias já contados sairiam da
 * conta, dias futuros entrariam. Quem precisa de outra data apaga a sala e
 * recria — é por isso que o botão de apagar existe aqui embaixo, e não porque
 * excluir seja um recurso desejável por si.
 *
 * A API recusa a alteração de data do mesmo jeito; esta tela não é a única
 * guarda.
 *
 * ## A capa
 *
 * Sala sem capa cai no desenho gerado a partir do id, que é padrão e não
 * ausência. Por isso não há "remover capa": o estado sem foto já é o inicial, e
 * um botão para voltar a ele valeria menos que a confusão de existir.
 */
export default function EditRoomScreen() {
  const { id: roomId, name: nomeInicial, description: descInicial, cover } =
    useLocalSearchParams<{ id: string; name?: string; description?: string; cover?: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [nome, setNome] = useState(nomeInicial ?? '');
  const [descricao, setDescricao] = useState(descInicial ?? '');
  const [capa, setCapa] = useState<string | null>(cover ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const trocarCapa = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return;

    const escolha = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      // A capa é servida numa faixa larga. Recortar aqui evita que uma foto
      // vertical apareça cortada de um jeito que o usuário não escolheu.
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (escolha.canceled || !escolha.assets[0] || !roomId) return;

    const asset = escolha.assets[0];
    const arquivo: PostPhotoFile = {
      uri: asset.uri,
      name: asset.fileName || 'capa.jpg',
      type: asset.mimeType || 'image/jpeg',
    };

    // Mostra a escolha na hora e sobe em seguida: esperar a rede para trocar a
    // imagem faria o toque parecer ignorado.
    setCapa(asset.uri);
    try {
      await updateRoomCover(roomId, arquivo);
    } catch (e) {
      setCapa(cover ?? null);
      setErro((e as Error)?.message ?? t('rooms.editError'));
    }
  };

  const salvar = async () => {
    if (!roomId || salvando) return;
    const limpo = nome.trim();
    if (limpo.length < 2) {
      setErro(t('rooms.nameTooShort'));
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await updateRoom(roomId, { name: limpo, description: descricao.trim() });
      voltar();
    } catch (e) {
      setErro((e as Error)?.message ?? t('rooms.editError'));
      setSalvando(false);
    }
  };

  /**
   * Apagar pede confirmação e nomeia a consequência.
   *
   * "Tem certeza?" não informa nada. O que decide é saber que os posts e o
   * histórico das outras pessoas vão junto — e isso precisa estar escrito antes
   * do toque, não depois.
   */
  const apagar = () => {
    Alert.alert(
      t('rooms.deleteTitle'),
      t('rooms.deleteBody'),
      [
        { text: t('rooms.cancel'), style: 'cancel' },
        {
          text: t('rooms.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!roomId) return;
            try {
              await deleteRoom(roomId);
              // Volta para a lista, não para a sala: ela não existe mais.
              router.replace('/(tabs)');
            } catch (e) {
              setErro((e as Error)?.message ?? t('rooms.editError'));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Press onPress={() => voltar()} style={styles.acao}>
          <X size={22} color={c.fgMuted} />
        </Press>
        <Text style={styles.titulo}>{t('rooms.editRoom')}</Text>
        <Press onPress={salvar} disabled={salvando} style={styles.acao}>
          {salvando
            ? <ActivityIndicator color={c.accent} />
            : <Text style={styles.salvar}>{t('rooms.save')}</Text>}
        </Press>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.rolagem} keyboardShouldPersistTaps="handled">
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <Press onPress={trocarCapa} style={styles.capaWrap}>
              <Image
                source={capa ? { uri: capa } : roomCoverForId(roomId ?? '')}
                style={styles.capa}
                resizeMode="cover"
              />
              <View style={styles.capaAcao}>
                <Camera size={16} color={c.fgOnAccent} />
                <Text style={styles.capaTexto}>{t('rooms.changeCover')}</Text>
              </View>
            </Press>

            <View style={styles.cartao}>
              <Text style={styles.rotulo}>{t('rooms.roomName')}</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                style={styles.campo}
                maxLength={60}
                placeholder={t('rooms.roomName')}
                placeholderTextColor={c.fgSubtle}
              />
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotulo}>{t('rooms.roomDescription')}</Text>
              <TextInput
                value={descricao}
                onChangeText={setDescricao}
                style={[styles.campo, styles.campoLongo]}
                maxLength={280}
                multiline
                placeholder={t('rooms.roomDescriptionHint')}
                placeholderTextColor={c.fgSubtle}
              />
            </View>

            {/* A data aparece explicada, e não como campo desabilitado: um campo
                cinza convida ao toque e não diz por que não responde. */}
            <Text style={styles.nota}>{t('rooms.dateLocked')}</Text>

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}

            <Press onPress={apagar} style={styles.apagar}>
              <Trash2 size={17} color={c.danger} />
              <Text style={styles.apagarTexto}>{t('rooms.deleteRoom')}</Text>
            </Press>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  fill: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm },
  acao: { minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { ...text.bodyStrong, color: c.fg, flex: 1, textAlign: 'center' },
  salvar: { ...text.bodyStrong, color: c.accent },
  rolagem: { padding: space.lg, gap: space.lg },

  capaWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface },
  capa: { width: '100%', height: 150 },
  // Sobre a imagem, e não abaixo: a capa é o alvo do toque, e o rótulo precisa
  // dizer isso sem ocupar uma linha própria.
  capaAcao: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.accent, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
  },
  capaTexto: { ...text.caption, color: c.fgOnAccent, fontWeight: '600' },

  cartao: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 },
  rotulo: { ...text.caption, color: c.fgMuted },
  campo: { ...text.body, color: c.fg, paddingVertical: space.xs },
  campoLongo: { minHeight: 72, textAlignVertical: 'top' },

  nota: { ...text.caption, color: c.fgSubtle, paddingHorizontal: space.xs },
  erro: { ...text.caption, color: c.danger },

  apagar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.md, marginTop: space.lg },
  apagarTexto: { ...text.body, color: c.danger, fontWeight: '600' },
});
