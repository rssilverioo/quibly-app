import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { FirebaseFeedPost } from './PostCard';
import { Mascot } from '../mascot';
import Avatar from '../ui/Avatar';
import Press from '../ui/Press';
import { useTheme, type Palette, radius, space, text } from '../../theme';

interface FeedRowProps {
  post: FirebaseFeedPost;
  locale: string;
  onPress: () => void;
}

export default function FeedRow({ post, locale, onPress }: FeedRowProps) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const title = post.caption?.trim() || post.subject_name || 'Estudo';
  const time = new Date(post.created_at).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  });
  // **Há foto? Mostra a foto.** Nada de flag por cima.
  //
  // Esta linha já foi `post.show_proof_photo && post.proof_photo_url`, e era o
  // defeito nomeado em `PLANO §Etapa 2`: todo post de foto avulsa caía no
  // ladrilho do coelho. O motivo é que `showProofPhoto` governa a foto de
  // **prova de sessão**, não a foto do post — a coluna é `@default(false)` e o
  // `POST /rooms/:id/posts` nunca a escreve. E o servidor já aplicou a flag
  // onde ela vale, ao montar `photoUrl = post.photoUrl ?? proofPhotoUrl`.
  // Filtrar de novo aqui era aplicá-la duas vezes, uma delas no lugar errado.
  //
  // `lib/feed-post.ts` já traduz `show_proof_photo` para `Boolean(photoUrl)`,
  // então as duas leituras concordam; depender só da URL é o que garante que
  // continuem concordando se alguém mexer no mapeador.
  const photo = post.proof_photo_url;

  // Nada de texto em cima da miniatura — nem a hora, nem contagem de reação.
  // A referência nunca escreve sobre foto, e sem véu de 72% a conta de
  // contraste não fecha (`DESIGN-GYMRATS §3.2.4`, regra do `fgOnScrim`).
  // Título, autor e hora ficam ao lado da foto, nunca por cima.
  return (
    <Press onPress={onPress} style={styles.row}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <Mascot state="idle" size={34} plate={false} animate={false} />
        </View>
      )}
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={styles.byline}>
          <Avatar uri={post.avatar_url} name={post.username} size={18} />
          <Text numberOfLines={1} style={styles.author}>{post.username}</Text>
        </View>
      </View>
      <Text style={styles.time}>{time}</Text>
    </Press>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // A linha do feed é um **card**, não uma faixa nua sobre a página
  // (`DESIGN-GYMRATS §5.1`, bloco 7). Antes era transparente, e o feed inteiro
  // lia como lista de sistema. Os 72pt externos com `borderWidth: 1` dão
  // exatamente os 69,9pt internos medidos na referência.
  //
  // Sem sombra, de propósito: a referência separa card de página só por
  // luminância (§2.1). Quem desenha a aresta é a borda de 1px, e é a mesma
  // linha de código nos dois modos — no claro ela aparece, no escuro
  // (`rgba(255,255,255,0.08)`) ela some sozinha. Não condicione ao `mode`.
  //
  // O respiro de 12pt ENTRE linhas não mora aqui: é do `FlatList` da tela da
  // sala. O card não conhece o vizinho.
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingLeft: space.sm,
    paddingRight: space.lg,
    gap: 10,
  },
  // Rounded square, measured off the GymRats reference (~9pt on a 56pt tile).
  // A circle would crop ~21% of the proof photo, and the photo is the product.
  // The 56x56 geometry itself is owner-approved — see feed-row-structure.test.ts.
  thumbnail: { width: 56, height: 56, borderRadius: radius.sm },
  // **`accentSoft`, não `surfaceRaised`.** No claro `surfaceRaised` é `#FFFFFF`,
  // idêntico ao card: o tile sem foto não existia como bloco, era um buraco.
  // E o mascote vira o coelho branco em breve — aí seria branco sobre branco,
  // exatamente a armadilha nomeada em `DESIGN-GYMRATS §3.3`. `accentSoft` é o
  // fundo que a §3.3 fixa para a miniatura de 34pt, e funciona nos dois modos.
  fallback: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { flex: 1, justifyContent: 'center' },
  title: { ...text.bodyStrong, color: c.fg },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  author: { ...text.caption, color: c.fgMuted, flexShrink: 1 },
  // `REF:` a hora acompanha a SEGUNDA linha (o byline), não o eixo vertical da
  // linha inteira. Ancorada embaixo e subida 13pt, a base dela cai no mesmo
  // eixo do byline — os ~7pt de desalinho que o spec apontou somem.
  time: { ...text.caption, color: c.fgMuted, alignSelf: 'flex-end', paddingBottom: 13 },
});
