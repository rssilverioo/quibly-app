import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme, text } from '../../theme';

interface Props {
  uri?: string | null;
  name: string;
  size?: number;
  /** Colored ring, e.g. the subject color while someone is studying */
  ringColor?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ uri, name, size = 44, ringColor }: Props) {
  const { c } = useTheme();
  const ring = ringColor ? 2 : 0;
  const inner = size - ring * 2 - (ringColor ? 4 : 0);

  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: inner, height: inner, borderRadius: inner / 2 }}
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
        },
      ]}
    >
      <Text
        style={{
          ...text.caption,
          color: c.fgMuted,
          fontSize: Math.max(10, inner * 0.34),
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
  fallback: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
});
