import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';

import Avatar from '../../components/ui/Avatar';
import Press from '../../components/ui/Press';
import { Mascot } from '../../components/mascot';
import { desbloquear, listarBloqueados, type PessoaBloqueada } from '../../services/moderation';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { voltar } from '../../lib/navegacao';

/**
 * Quem você bloqueou — e o botão para desfazer.
 *
 * ## Por que esta tela precisa existir
 *
 * O Guideline 1.2 da Apple não pede só o **ato** de bloquear: pede que a
 * pessoa consiga ver e desfazer o que bloqueou. Um bloqueio sem saída é uma
 * decisão irreversível tomada num toque longo, e ninguém decide bem assim.
 *
 * ## O que ela não mostra
 *
 * Quem bloqueou **você**. Não existe rota para isso, e não vai existir: saber
 * quem te bloqueou é a informação que transforma proteção em confronto, que é
 * exatamente a situação de que a outra pessoa estava tentando sair.
 */
export default function BloqueadosScreen() {
  const { t } = useTranslation('common');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [pessoas, setPessoas] = useState<PessoaBloqueada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [soltando, setSoltando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setPessoas(await listarBloqueados());
      setErro(null);
    } catch (err) {
      // Erro visível, e não lista vazia: "você não bloqueou ninguém" quando na
      // verdade a rede caiu é o app mentindo sobre uma decisão da pessoa.
      setErro((err as Error)?.message ?? t('moderation.error'));
    } finally {
      setCarregando(false);
    }
  }, [t]);

  useEffect(() => { carregar(); }, [carregar]);

  const soltar = async (id: string) => {
    setSoltando(id);
    try {
      await desbloquear(id);
      setPessoas((atuais) => atuais.filter((p) => p.id !== id));
    } catch (err) {
      setErro((err as Error)?.message ?? t('moderation.error'));
    } finally {
      setSoltando(null);
    }
  };

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.barra}>
        <Press onPress={() => voltar()} style={styles.voltar}>
          <ArrowLeft size={22} color={c.fg} />
        </Press>
        <Text style={styles.titulo}>{t('moderation.blockedTitle')}</Text>
        <View style={styles.voltar} />
      </View>

      {carregando ? (
        <View style={styles.centro}><ActivityIndicator color={c.fgMuted} /></View>
      ) : erro ? (
        <View style={styles.centro}>
          <Mascot state="worried" size={96} animate={false} />
          <Text style={styles.erro}>{erro}</Text>
          <Press onPress={carregar} style={styles.tentar}>
            <Text style={styles.tentarTexto}>{t('retry')}</Text>
          </Press>
        </View>
      ) : (
        <FlatList
          data={pessoas}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            pessoas.length > 0
              ? <Text style={styles.aviso}>{t('moderation.blockedNotice')}</Text>
              : null
          }
          ListEmptyComponent={
            <View style={styles.centro}>
              <Mascot state="idle" size={110} animate={false} />
              <Text style={styles.vazio}>{t('moderation.blockedEmpty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.linha}>
              <Avatar uri={item.avatar_url} name={item.username} size={40} pro={item.plan === 'PRO'} />
              <View style={styles.linhaTexto}>
                <Text style={styles.nome} numberOfLines={1}>{item.username}</Text>
                <Text style={styles.handle} numberOfLines={1}>@{item.handle}</Text>
              </View>
              <Press
                onPress={() => soltar(item.id)}
                disabled={soltando === item.id}
                style={styles.soltar}
              >
                <Text style={styles.soltarTexto}>
                  {soltando === item.id ? '…' : t('moderation.unblock')}
                </Text>
              </Press>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: c.bg },
  barra: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { ...text.bodyStrong, color: c.fg, flex: 1, textAlign: 'center' },

  lista: { paddingHorizontal: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
  aviso: { ...text.caption, color: c.fgMuted, marginBottom: space.lg, lineHeight: 18 },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  linhaTexto: { flex: 1 },
  nome: { ...text.bodyStrong, color: c.fg },
  handle: { ...text.caption, color: c.fgMuted },
  soltar: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  soltarTexto: { ...text.caption, color: c.accent },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  vazio: { ...text.body, color: c.fgMuted, textAlign: 'center' },
  erro: { ...text.body, color: c.danger, textAlign: 'center' },
  tentar: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  tentarTexto: { ...text.body, color: c.accent },
});
