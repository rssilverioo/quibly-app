import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import {
  ArrowLeft, ChevronRight, Crown, Globe, Lock, LogOut, Moon, Pencil,
  ShieldCheck, Trash2, UserX,
} from 'lucide-react-native';

import Press from '../../components/ui/Press';
import { logout as firebaseLogout, deleteAccount } from '../../services/auth';
import { COMPRAS_NO_APP_ATIVAS } from '../../services/iap';
import i18n from '../../lib/i18n';
import { useTheme, type Palette, radius, space, text } from '../../theme';
import { voltar } from '../../lib/navegacao';

/**
 * Ajustes — uma tela, atrás da engrenagem do perfil.
 *
 * ## Por que saiu do perfil
 *
 * Estava tudo na mesma rolagem: identidade, números, conquistas, mapa de
 * constância e, embaixo, idioma, tema, sair e apagar a conta. Duas coisas de
 * naturezas opostas dividindo uma tela — uma que a pessoa mostra e outra que
 * ela configura uma vez e esquece.
 *
 * O custo era o perfil: para chegar ao mapa de constância era preciso passar
 * por cima do botão de apagar a conta. E era o que mais empurrava a parte
 * interessante para baixo da dobra.
 *
 * GitHub, Strava e praticamente todo app com perfil resolvem igual: a
 * engrenagem no canto, os ajustes numa tela sua. Não é convenção por moda — é
 * que "quem eu sou" e "como o app se comporta" são duas perguntas diferentes.
 *
 * ## Por que os grupos são estes
 *
 * Cada bloco responde a uma pergunta:
 * **conta** (quem eu sou aqui), **aparência e idioma** (como o app se
 * apresenta), **legal** (o que eu aceitei) e **destrutivo** (as duas saídas).
 *
 * O destrutivo fica por último e sozinho, separado por um respiro maior. Sair e
 * apagar a conta são as duas ações irreversíveis da tela, e vizinhança com um
 * seletor de idioma é o que faz alguém tocar na errada.
 */
export default function SettingsScreen() {
  const { t } = useTranslation('profile');
  const { c, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [saindo, setSaindo] = useState(false);

  /**
   * A versão vem do **binário**, não do `app.json`.
   *
   * `expoConfig.ios.buildNumber` estava vazio, e a linha saía "Quibly 1.2.1 ()".
   * O motivo é o `appVersionSource: "remote"` do `eas.json`: quem incrementa o
   * build é o servidor do EAS, então o número nunca chega ao arquivo de
   * configuração — ele só existe no app instalado.
   *
   * `nativeBuildVersion` lê do próprio binário, que é o único lugar onde a
   * resposta é verdadeira. E é justamente esta linha que responde "qual build
   * você está usando?", a primeira pergunta de todo defeito relatado.
   */
  const versao = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
  const build = Constants.nativeBuildVersion ?? '';

  const sair = () => {
    Alert.alert(t('logOutConfirmTitle'), t('logOutConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('logOut'),
        style: 'destructive',
        onPress: async () => {
          setSaindo(true);
          try {
            await firebaseLogout();
            router.replace('/(auth)/login');
          } catch (err) {
            setSaindo(false);
            Alert.alert(t('common:error'), (err as Error)?.message || t('logOutError'));
          }
        },
      },
    ]);
  };

  const apagarConta = () => {
    Alert.alert(t('deleteAccountConfirmTitle'), t('deleteAccountConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('deleteAccount'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            router.replace('/(auth)/login');
          } catch (err) {
            /*
             A causa importa mais aqui do que em qualquer outro lugar.

             O Firebase recusa apagar a conta de quem não fez login há pouco
             (`auth/requires-recent-login`), e a saída é sair e entrar de novo —
             uma instrução que a pessoa consegue seguir. A frase genérica
             escondia isso, numa porta que a Apple exige que exista e funcione.
            */
            Alert.alert(t('common:error'), (err as Error)?.message || t('deleteAccountError'));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.barra}>
        <Press onPress={() => voltar()} style={styles.voltar}>
          <ArrowLeft size={22} color={c.fg} />
        </Press>
        <Text style={styles.titulo}>{t('settings')}</Text>
        {/* Espaçador da mesma largura do botão: sem ele o título fica fora do
            centro por 44pt, que é justamente o quanto se percebe. */}
        <View style={styles.voltar} />
      </View>

      <ScrollView contentContainerStyle={styles.rolagem} showsVerticalScrollIndicator={false}>
        {/* conta */}
        <View style={styles.grupo}>
          {COMPRAS_NO_APP_ATIVAS ? (
            <Linha Icon={Crown} rotulo={t('pricing:myPlan')} aoTocar={() => router.push('/pricing')} divisor c={c} styles={styles} />
          ) : null}
          <Linha Icon={Pencil} rotulo={t('editProfile')} aoTocar={() => router.push('/profile/edit')} divisor c={c} styles={styles} />
          {/* O Guideline 1.2 não pede só o ato de bloquear: pede que a pessoa
              veja e desfaça o que bloqueou. */}
          <Linha
            Icon={UserX}
            rotulo={t('common:moderation.blockedTitle')}
            aoTocar={() => router.push('/settings/bloqueados')}
            c={c}
            styles={styles}
          />
        </View>

        {/* aparência e idioma */}
        <View style={styles.grupo}>
          <Linha
            Icon={Moon}
            rotulo={t('appearance')}
            valor={mode === 'dark' ? t('themeDark') : t('themeLight')}
            aoTocar={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            divisor
            c={c}
            styles={styles}
          />
          <View style={styles.linha}>
            <View style={styles.icone}><Globe size={17} color={c.fgMuted} strokeWidth={2.2} /></View>
            <Text style={styles.rotulo}>{t('language')}</Text>
          </View>
          <View style={styles.segmentado}>
            {([['en', 'English'], ['pt-BR', 'Português (BR)']] as const).map(([codigo, nome]) => {
              const ativo = i18n.language === codigo;
              return (
                <Press
                  key={codigo}
                  haptic={false}
                  scale={0.97}
                  onPress={() => i18n.changeLanguage(codigo)}
                  style={[styles.segmento, ativo && styles.segmentoAtivo]}
                >
                  <Text style={[styles.segmentoTexto, ativo && styles.segmentoTextoAtivo]}>{nome}</Text>
                </Press>
              );
            })}
          </View>
        </View>

        {/* legal — a Apple exige as duas alcançáveis de dentro do app */}
        <View style={styles.grupo}>
          <Linha
            Icon={ShieldCheck}
            rotulo={t('terms')}
            aoTocar={() => router.push('https://tryquibly.com/terms' as never)}
            divisor
            c={c}
            styles={styles}
          />
          <Linha
            Icon={Lock}
            rotulo={t('privacy')}
            aoTocar={() => router.push('https://tryquibly.com/privacy' as never)}
            c={c}
            styles={styles}
          />
        </View>

        {/* destrutivo, por último e sozinho */}
        <View style={[styles.grupo, styles.grupoDestrutivo]}>
          <Linha Icon={LogOut} rotulo={t('logOut')} aoTocar={sair} destrutivo divisor carregando={saindo} c={c} styles={styles} />
          <Linha Icon={Trash2} rotulo={t('deleteAccount')} aoTocar={apagarConta} destrutivo c={c} styles={styles} />
        </View>

        {/* A versão existe para o suporte: "qual build você está usando?" é a
            primeira pergunta de todo defeito relatado. */}
        <Text style={styles.versao}>
          {build ? t('version', { version: versao, build }) : `Quibly ${versao}`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Linha({
  Icon, rotulo, valor, aoTocar, divisor, destrutivo, carregando, c, styles,
}: {
  Icon: any;
  rotulo: string;
  valor?: string;
  aoTocar: () => void;
  divisor?: boolean;
  destrutivo?: boolean;
  carregando?: boolean;
  c: Palette;
  styles: any;
}) {
  return (
    <Press onPress={aoTocar} disabled={carregando} style={[styles.linha, divisor && styles.divisor]}>
      <View style={styles.icone}>
        <Icon size={17} color={destrutivo ? c.danger : c.fgMuted} strokeWidth={2.2} />
      </View>
      <Text style={[styles.rotulo, destrutivo && { color: c.danger }]}>{rotulo}</Text>
      {valor ? <Text style={styles.valor}>{valor}</Text> : null}
      {!destrutivo ? <ChevronRight size={17} color={c.fgSubtle} /> : null}
    </Press>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  tela: { flex: 1, backgroundColor: c.bg },
  barra: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { ...text.bodyStrong, color: c.fg, flex: 1, textAlign: 'center' },
  rolagem: { paddingHorizontal: space.lg, paddingBottom: space.xxl },

  grupo: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  // Respiro maior antes do bloco irreversível: vizinhança com o seletor de
  // idioma é o que faz alguém tocar em "apagar conta" sem querer.
  grupoDestrutivo: { marginTop: space.md },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  divisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  icone: { width: 24, alignItems: 'center' },
  rotulo: { ...text.body, color: c.fg, flex: 1 },
  valor: { ...text.body, color: c.fgMuted },

  segmentado: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  segmento: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  segmentoAtivo: { backgroundColor: c.accentSoft, borderColor: c.accent },
  segmentoTexto: { ...text.caption, color: c.fgMuted },
  segmentoTextoAtivo: { color: c.accent },

  versao: { ...text.caption, color: c.fgSubtle, textAlign: 'center', marginTop: space.md },
});
