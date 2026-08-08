import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme, type Palette, radius, space, text } from '../../theme';

export interface FirebaseFeedPost {
  id: string;
  kind?: 'session' | 'standalone';
  league_id: string;
  user_id: string;
  username: string;
  /** O selo do autor. `null` na esmagadora maioria — ver `SeloVerificado`. */
  verification?: 'BLUE' | 'GOLD' | null;
  avatar_url: string | null;
  session_id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  show_proof_photo: boolean;
  proof_photo_url: string | null;
  total_duration_minutes?: number;
  points_earned?: number;
  is_verified: boolean;
  reactions: Record<string, string[]>;
  comment_count: number;
  created_at: string;
  caption?: string | null;
  challenge_title?: string | null;
}

/**
 * `detail` é a tela do post: sem card, os blocos caem direto sobre `c.bg`.
 * Card é linguagem de lista — na referência a tela de detalhe não tem nenhum, e
 * a foto de 468pt já é a superfície.
 *
 * `list` é para quando vários posts se empilham (a lista de posts de um membro),
 * onde a moldura é o que separa um post do seguinte.
 */
export type PostCardVariant = 'detail' | 'list';

/**
 * O contrato de `editable`, governado por `MARCA §3.4` e `DESIGN-GYMRATS §5.10`.
 *
 * O princípio, do qual todo o resto decorre:
 *
 * > **O card não muda de forma quando você adiciona legenda ou foto.**
 *
 * Quando esta tela abre, o post **já existe** — encerrar a sessão é que cria o
 * post (`DIRECAO-PRODUTO §3`). Legenda e foto são enfeite opcional sobre algo
 * publicado, não campos a preencher. Se o estado sem legenda ler como
 * incompleto, incompleto lê como pendente, e pendente é formulário.
 *
 * Como isso está implementado aqui, e por quê:
 *
 * - **A linha-convite É o `placeholder` do próprio `TextInput`.** Em modo
 *   editável não existe troca de `<Text>` para `<TextInput>` no toque: o campo
 *   já está lá, sem borda, sem fundo, sem padding, com `...text.body`. Assim a
 *   posição e a métrica da legenda vazia são *literalmente* as mesmas da
 *   legenda escrita — não parecidas, as mesmas — e não há salto no instante do
 *   toque. É a leitura mais estrita de "toca e edita no lugar".
 * - **`autoFocus` nunca.** Não existe `focus()` imperativo neste arquivo.
 *   Teclado subindo sozinho é a definição de formulário aberto.
 * - **Sem contador de caracteres e sem "(opcional)".** Dizer "opcional" já
 *   admite que parecia obrigatório.
 * - **"+ foto" é ação textual** em `text.label`/`c.fgMuted`, no peso de
 *   qualquer ação secundária. Nunca um dropzone, nunca uma moldura vazia.
 * - **Nenhum estado "fresco".** `editable` não acrescenta glow, borda de
 *   destaque nem animação. Quem decide a moldura é `variant`, e só ele — o card
 *   editável é byte a byte o card do feed. A comemoração mora na moldura da
 *   tela, não aqui.
 * - **Os blocos opcionais ficam por último.** Legenda e "+ foto" vêm depois dos
 *   pills, então escrever uma legenda empurra o que está abaixo para baixo e
 *   não reflui nada acima. Foto, byline, matéria e dado não se movem.
 *
 * O que este componente **não** faz, de propósito: não salva, não valida, não
 * mostra erro e não conhece a API. Ele reporta a legenda confirmada e o toque
 * em "+ foto"; a tela decide o que fazer.
 */
export interface PostCardProps {
  post?: FirebaseFeedPost;
  loading?: boolean;
  variant?: PostCardVariant;
  /**
   * Liga a edição no lugar da legenda e a ação "+ foto".
   * Sem isto o card é estritamente de leitura — é o mesmo componente.
   */
  editable?: boolean;
  /**
   * Chamada quando a legenda é confirmada: ao sair do campo ou ao enviar.
   * Recebe o texto já aparado, e **não** é chamada se nada mudou.
   * Ausente = a legenda fica visível mas não editável.
   */
  onCaptionChange?: (caption: string) => void;
  /**
   * Toque em "+ foto". Ausente = a linha não aparece — a ação só existe quando
   * há quem a atenda, e nunca aparece se o post já tem foto.
   */
  onAddPhoto?: () => void;
}

export function timeAgo(
  dateString: string,
  t: TFunction,
  now = Date.now(),
): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(dateString).getTime()) / 1000),
  );
  if (seconds < 60) return t('timeAgo.justNow');
  if (seconds < 3600) {
    return t('timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
  }
  if (seconds < 86400) {
    return t('timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
  }
  return t('timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

/**
 * Teto de retrato. `aspectRatio` é largura/altura, então quanto menor, mais
 * alta a foto: 0,75 é o retrato 3:4 e é onde a foto para de crescer.
 *
 * Sem esse teto uma foto 9:16 tirada no celular empurraria byline, legenda e
 * pills inteiros para fora da tela — e o post viraria só a foto.
 */
const PORTRAIT_CAP = 3 / 4;

/**
 * `REF:` a foto da referência é 0,763:1. Enquanto a proporção real não chega,
 * o bloco já reserva altura nessa medida em vez de aparecer do nada: um bloco
 * que surge e empurra o resto é pior que uma espera com a forma certa
 * (`MARCA §3.3` — foto nunca ganha esqueleto animado).
 */
const ASSUMED_RATIO = PORTRAIT_CAP;

function PostCardSkeleton({ c, variant }: { c: Palette; variant: PostCardVariant }) {
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View
      style={[styles.card, variant === 'list' && styles.cardList]}
      accessibilityLabel="Carregando publicação"
    >
      <View style={styles.byline}>
        <View style={[styles.avatar, styles.skeleton]} />
        <View style={styles.skeletonByline}>
          <View style={[styles.skeleton, styles.skeletonName]} />
          <View style={[styles.skeleton, styles.skeletonTime]} />
        </View>
      </View>
      <View style={[styles.skeleton, styles.skeletonSubject]} />
      <View style={styles.dataRow}>
        <View style={[styles.skeleton, styles.skeletonData]} />
        <View style={[styles.skeleton, styles.skeletonData]} />
      </View>
    </View>
  );
}

export default function PostCard({
  post,
  loading = false,
  variant = 'detail',
  editable = false,
  onCaptionChange,
  onAddPhoto,
}: PostCardProps) {
  const { t } = useTranslation('feed');
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [ratio, setRatio] = useState<number | null>(null);
  const [draft, setDraft] = useState(post?.caption ?? '');

  // A legenda vinda do servidor manda enquanto o usuário não está escrevendo.
  // Sem isto, um card reciclado ou um refetch deixariam o rascunho do post
  // anterior no campo.
  useEffect(() => { setDraft(post?.caption ?? ''); }, [post?.id, post?.caption]);

  const commitCaption = () => {
    const next = draft.trim();
    if (next === (post?.caption ?? '').trim()) return; // nada mudou: não avisa
    onCaptionChange?.(next);
  };

  // A proporção sai da imagem, não de um valor fixo. Antes era `4/3` com
  // `resizeMode="cover"`, o que **recortava a prova** — e prova recortada não é
  // prova. `onLoad` traz as dimensões reais sem uma segunda requisição.
  const onPhotoLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = e.nativeEvent.source;
    if (width > 0 && height > 0) setRatio(Math.max(PORTRAIT_CAP, width / height));
  };

  if (loading || !post) return <PostCardSkeleton c={c} variant={variant} />;

  const timeLabel = timeAgo(post.created_at, t);
  const showProofPhoto = post.show_proof_photo && Boolean(post.proof_photo_url);

  return (
    <View style={[styles.card, variant === 'list' && styles.cardList]}>
      {/* A foto é o primeiro bloco e nada é escrito em cima dela: nem hora, nem
          autor, nem contagem. A referência nunca escreve sobre foto, e sem véu
          de 72% + `fgOnScrim` a conta de contraste não fecha. O texto desce. */}
      {showProofPhoto ? (
        <Image
          source={{ uri: post.proof_photo_url! }}
          style={[styles.proofPhoto, { aspectRatio: ratio ?? ASSUMED_RATIO }]}
          // `contain` e não `cover`: com a proporção nativa aplicada os dois dão
          // o mesmo resultado, mas se a medida falhar `contain` mostra a foto
          // inteira com barra, enquanto `cover` volta a cortar em silêncio.
          resizeMode="contain"
          onLoad={onPhotoLoad}
          accessibilityLabel={t('proofPhotoAccessibility')}
        />
      ) : null}

      <View style={styles.byline}>
        {post.avatar_url ? (
          <Image source={{ uri: post.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>
              {getInitials(post.username)}
            </Text>
          </View>
        )}
        <Text style={styles.username} numberOfLines={1}>
          {post.username || t('common:unknown')}
        </Text>
        <Text style={styles.relativeTime}>· {timeLabel}</Text>
      </View>

      {post.subject_name ? (
        <View style={styles.subjectRow}>
          <View
            style={[
              styles.subjectDot,
              { backgroundColor: post.subject_color || c.fgMuted },
            ]}
          />
          <Text style={styles.subjectName}>{post.subject_name}</Text>
        </View>
      ) : null}

      {/* Pills ANTES da legenda, ordem de `MARCA §3.2` — travada por
          `lib/post-card-structure.test.ts` e listada no briefing §6 como
          decisão que não reabre. `DESIGN-GYMRATS §5.2` mede a referência com a
          legenda acima dos pills; a divergência está reportada ao CEO em vez de
          resolvida aqui, porque o próprio spec manda registrar discordância com
          `MARCA` na §3 dele, e esta não está lá. Inverter é trocar estes dois
          blocos de lugar. */}
      {post.kind !== 'standalone' ? (
        <View style={styles.dataRow}>
          {/* Minutos primeiro, sempre: é a North Star. O `✓` fica colado dentro
              do pill de minutos — verificado não é um dado próprio. */}
          <View style={styles.dataPill}>
            <Text style={styles.minutesText}>
              ⏱ {t('minutesShort', { count: post.total_duration_minutes ?? 0 })}
            </Text>
            {post.is_verified ? <Text style={styles.verified}> ✓</Text> : null}
          </View>
          <View style={styles.dataPill}>
            <Text style={styles.xpText}>⚡ +{post.points_earned ?? 0} XP</Text>
          </View>
        </View>
      ) : null}

      {/* Editável: o campo já está montado, sem borda e sem fundo, e o convite
          é o `placeholder` dele. Não há troca de componente no toque, então a
          legenda vazia e a escrita ocupam exatamente o mesmo lugar com a mesma
          métrica — o card não muda de forma. Sem `autoFocus`: o teclado só sobe
          se a pessoa tocar. */}
      {editable && onCaptionChange ? (
        <TextInput
          style={[styles.caption, styles.captionInput]}
          value={draft}
          onChangeText={setDraft}
          onBlur={commitCaption}
          onSubmitEditing={commitCaption}
          placeholder={t('addCaption')}
          placeholderTextColor={c.fgMuted}
          multiline
          blurOnSubmit
          returnKeyType="done"
          // Sem `maxLength`: contador e limite visível são linguagem de
          // formulário. Quem valida tamanho é o servidor.
          accessibilityLabel={t('addCaption')}
        />
      ) : post.caption ? (
        <View style={styles.captionBlock}>
          <Text style={styles.caption}>{post.caption}</Text>
        </View>
      ) : null}

      {/* Ação textual, no peso de qualquer ação secundária. Some quando já há
          foto: oferecer "+ foto" sobre uma foto seria pedir uma segunda. */}
      {editable && !showProofPhoto && onAddPhoto ? (
        <TouchableOpacity onPress={onAddPhoto} activeOpacity={0.7} style={styles.addPhotoBlock}>
          <Text style={styles.addPhoto}>{t('addPhoto')}</Text>
        </TouchableOpacity>
      ) : null}

      {post.challenge_title ? (
        <Text style={styles.challengeLine}>
          {t('countsForChallenge', { challenge: post.challenge_title })}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // `detail`: nenhuma moldura. Sem fundo, sem borda, sem raio, sem padding — a
  // margem lateral é da tela, e é assim que a foto alcança os 361pt medidos na
  // referência em vez de perder 16pt para um padding duplicado.
  card: { gap: 0 },
  // `list`: aí sim é card, porque a moldura é o que separa um post do próximo.
  // Card padrão da §4.2 — borda de 1px, sem sombra, raio pequeno.
  cardList: {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    overflow: 'hidden',
  },
  // Sem borda: a foto é a própria aresta. Sem esqueleto animado; o fundo
  // enquanto carrega é `c.skeleton`, parado.
  proofPhoto: {
    width: '100%',
    borderRadius: radius.sm,
    backgroundColor: c.skeleton,
    marginBottom: 20,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    marginBottom: 14,
  },
  avatar: { width: 32, height: 32, borderRadius: radius.full },
  avatarPlaceholder: {
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { ...text.caption, color: c.fgMuted },
  username: { ...text.bodyStrong, color: c.fg, marginLeft: space.sm, flexShrink: 1 },
  relativeTime: { ...text.caption, color: c.fgMuted, marginLeft: space.xs },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 14 },
  subjectDot: { width: 8, height: 8, borderRadius: radius.full },
  // Nunca na cor da matéria: a cor mora no ponto de 8px e só nele.
  subjectName: { ...text.title3, color: c.fg, flexShrink: 1 },
  captionBlock: { marginBottom: space.xl },
  // Zera tudo o que o `TextInput` acrescenta por conta própria — padding
  // interno, fundo, borda e o `includeFontPadding` do Android. Sem isto o campo
  // sentaria alguns pontos abaixo de onde um `<Text>` com o mesmo degrau
  // sentaria, e a promessa de "mesma métrica" seria só intenção.
  captionInput: {
    marginBottom: space.xl,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  addPhotoBlock: { marginBottom: space.xl },
  dataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: space.xl },
  // `REF:` 39,5pt de altura. Antes saía ~37 de `paddingVertical` implícito;
  // agora a altura é fixa e o pill para de depender do line-height da fonte.
  dataPill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.full,
    paddingHorizontal: 14,
  },
  minutesText: { ...text.label, color: c.fg, fontFamily: text.bodyStrong.fontFamily },
  verified: { ...text.label, color: c.success },
  xpText: { ...text.label, color: c.fg },
  caption: { ...text.body, color: c.fg },
  addPhoto: { ...text.label, color: c.fgMuted },
  challengeLine: { ...text.caption, color: c.fgMuted },
  skeleton: { backgroundColor: c.skeleton, borderRadius: radius.sm },
  skeletonByline: { marginLeft: space.sm, gap: space.xs },
  skeletonName: { width: 112, height: 12 },
  skeletonTime: { width: 64, height: 8 },
  skeletonSubject: { width: 148, height: 20, marginBottom: 14 },
  skeletonData: { width: 96, height: 40, borderRadius: radius.full },
});
