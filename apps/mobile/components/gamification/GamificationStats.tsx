import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@quibly/shared/constants';

interface Stat {
  icon: React.ReactNode;
  value: string;
  label: string;
}

interface GamificationStatsProps {
  stats: Stat[];
}

export default function GamificationStats({ stats }: GamificationStatsProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {stats.map((stat, index) => (
          <React.Fragment key={stat.label}>
            <View style={styles.box}>
              {stat.icon}
              <Text style={styles.value}>{stat.value}</Text>
              <Text style={styles.label}>{stat.label}</Text>
            </View>
            {index < stats.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  box: { flex: 1, alignItems: 'center' },
  value: { fontSize: 20, fontFamily: FONTS.bold, color: COLORS.text, marginTop: 4, marginBottom: 4 },
  label: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { width: 1, height: 32, backgroundColor: COLORS.border },
});
