import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme, text } from '../../theme';
import MolduraPro, { PROPORCAO_ESCUDO } from '../plano/MolduraPro';

interface Props {
  uri?: string | null;
  name: string;
  size?: number;
  /** Colored ring, e.g. the subject color while someone is studying */
  ringColor?: string;
  /**
   * Quem assina aparece em **escudo**, não em círculo — ver `MolduraPro`.
   *
   * O dado vem do servidor em `plan`, e chega aqui já como pergunta de sim ou
   * não porque é só isso que o desenho precisa saber. Quem recebe `plan`
   * inteiro é quem decide o que é "assinante", e essa decisão é uma só, no
   * ponto de chamada.
   */
  pro?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ uri, name, size = 44, ringColor, pro }: Props) {
  const { c } = useTheme();
  // **Foto quebrada não é o mesmo que foto ausente, e era esse o defeito real.**
  // Sem `onError`, um `avatar_url` que existe mas falha (URL expirada, objeto
  // apagado do storage, rede caída) deixa o `<Image>` desenhando nada — e o que
  // sobra é um disco vazio para sempre. Visualmente idêntico a "carregando",
  // então lê como travado, não como "sem foto".
  //
  // Cair para a inicial faz do caso quebrado o mesmo caso do ausente, que já é
  // um estado desenhado. O `useEffect` rearma a tentativa quando a `uri` muda:
  // sem ele, um item reciclado de `FlatList` herdaria a falha do anterior.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  const showPhoto = Boolean(uri) && !failed;
  const ring = ringColor ? 2 : 0;
  const inner = size - ring * 2 - (ringColor ? 4 : 0);

  // **Outros dois defeitos moravam nestas quatro linhas.** Junto com a foto
  // quebrada acima, eram os três jeitos de este componente virar disco vazio.
  //
  // 1. `...text.caption` traz `lineHeight: 17` junto. Sobrescrever só o
  //    `fontSize` deixa a caixa de linha em 17pt: num avatar de 80pt a inicial
  //    é desenhada a ~27pt dentro de uma caixa de 17 e o RN corta o glifo até
  //    não sobrar nada visível. Quanto maior o avatar, mais invisível a
  //    inicial — que é exatamente o contrário do esperado.
  // 2. O disco de fundo era `c.surfaceRaised`, que no claro é `#FFFFFF`,
  //    idêntico ao `c.surface` do card em que o avatar quase sempre pousa
  //    (`DESIGN-GYMRATS §4.2` faz a mesma observação sobre card). Sem forma e
  //    sem inicial, sobrava só o anel.
  //
  // O `lineHeight` agora acompanha o `fontSize`, e a hairline de `c.border` dá
  // aresta ao disco — mesma regra da §3.2.4: a mesma linha serve os dois modos,
  // no claro ela desenha, no escuro ela some sozinha.
  const fontSize = Math.max(10, inner * 0.34);

  // **O escudo herda a altura, não a largura.**
  //
  // Ele é 18% mais alto que largo. Manter a largura em `size` faria toda linha
  // de lista com um assinante crescer 18% — e o ritmo de uma lista é o que
  // menos pode depender de quem paga. Casando a altura, a linha não se mexe: o
  // escudo fica um pouco mais estreito que o círculo que substituiu, e é a
  // troca certa.
  //
  // A foto quebrada não cai para a inicial aqui: `onError` não existe na
  // `Image` do SVG. O que sobra é o escudo em degradê, vazio — um estado
  // **desenhado**, diferente do disco cinza que motivou o `onError` abaixo e
  // que lia como "travado carregando".
  if (pro) {
    return (
      <MolduraPro
        uri={showPhoto ? uri! : null}
        iniciais={initials(name)}
        size={size / PROPORCAO_ESCUDO}
      />
    );
  }

  const content = showPhoto ? (
    <Image
      source={{ uri: uri! }}
      style={{ width: inner, height: inner, borderRadius: inner / 2 }}
      onError={() => setFailed(true)}
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: c.surfaceRaised,
          borderColor: c.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          ...text.caption,
          color: c.fgMuted,
          fontSize,
          lineHeight: Math.ceil(fontSize * 1.2),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );

  if (!ringColor) return content;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ringColor,
          borderWidth: ring,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ring: { alignItems: 'center', justifyContent: 'center' },
});
