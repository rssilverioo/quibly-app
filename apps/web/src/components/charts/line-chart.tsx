'use client';

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card } from '../ui/card';

// Cast recharts components to avoid React types version mismatch
const RContainer = ResponsiveContainer as any;
const RLineChart = RechartsLineChart as any;
const RLine = Line as any;
const RXAxis = XAxis as any;
const RYAxis = YAxis as any;
const RTooltip = Tooltip as any;
const RGrid = CartesianGrid as any;

interface LineChartProps {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color: string; label: string }[];
  height?: number;
}

export function LineChart({ title, data, xKey, lines, height = 300 }: LineChartProps) {
  return (
    <Card>
      <h3 className="text-sm font-medium text-quibly-text-muted mb-4">{title}</h3>
      <RContainer width="100%" height={height}>
        <RLineChart data={data}>
          <RGrid strokeDasharray="3 3" stroke="#2A2A3E" />
          <RXAxis
            dataKey={xKey}
            stroke="#6B7280"
            fontSize={12}
            tickLine={false}
          />
          <RYAxis stroke="#6B7280" fontSize={12} tickLine={false} />
          <RTooltip
            contentStyle={{
              backgroundColor: '#141420',
              border: '1px solid #2A2A3E',
              borderRadius: '8px',
              color: '#FFFFFF',
            }}
          />
          {lines.map((line) => (
            <RLine
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.label}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </RLineChart>
      </RContainer>
    </Card>
  );
}
