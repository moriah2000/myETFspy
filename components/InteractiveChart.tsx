import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface InteractiveChartProps {
  points: ChartPoint[];
  width?: number;
  height?: number;
  color?: string;
  loading?: boolean;
  formatValue?: (v: number) => string;
  liveValue?: number;
  liveLabel?: string;
}

const CROSSHAIR_DOT_R = 5;
const TOOLTIP_H = 28;
const TOOLTIP_PAD_X = 10;
const LABEL_FONT = 11;

function defaultFormat(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(2)}`;
}

export default function InteractiveChart({
  points: rawPoints,
  width,
  height = 160,
  color = '#00C896',
  loading = false,
  formatValue = defaultFormat,
  liveValue,
  liveLabel,
}: InteractiveChartProps) {
  const chartH = height;
  const [measuredW, setMeasuredW] = useState(0);
  // Always use measured width — ignore passed width prop for point scaling
  const chartW = measuredW;

  // Re-normalize points to actual rendered width
  const points: ChartPoint[] = useMemo(() => {
    if (rawPoints.length < 2 || chartW === 0) return rawPoints;

    const workingPoints = rawPoints.map(p => ({ ...p }));

    // Apply liveValue to last point
    if (liveValue) {
      const vals = workingPoints.map(p => p.value);
      const minV = Math.min(...vals.slice(0, -1), liveValue);
      const maxV = Math.max(...vals.slice(0, -1), liveValue);
      const range = maxV - minV || 1;
      const PAD_TOP = 12, PAD_BOTTOM = 4;
      const last = workingPoints[workingPoints.length - 1];
      last.value = liveValue;
      last.y = PAD_TOP + (1 - (liveValue - minV) / range) * (chartH - PAD_TOP - PAD_BOTTOM);
      if (liveLabel) last.label = liveLabel;
    }

    // Re-scale x positions to actual chartW
    const count = workingPoints.length;
    return workingPoints.map((p, i) => ({
      ...p,
      x: (i / (count - 1)) * chartW,
    }));
  }, [rawPoints, liveValue, liveLabel, chartH, chartW]);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isInteracting = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPositive = points.length > 1
    ? points[points.length - 1].value >= points[0].value
    : true;
  const resolvedColor = color === 'auto'
    ? (isPositive ? '#00C896' : '#FF5A5F')
    : color;

  function indexForRelX(relX: number): number {
    if (points.length === 0 || chartW === 0) return 0;
    const clampedX = Math.max(0, Math.min(relX, chartW));
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - clampedX);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  const linePath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : '';
  const areaPath = points.length > 1
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${chartH} L0,${chartH} Z`
    : '';

  const active = activeIndex !== null ? points[activeIndex] : null;
  const tooltipText = active ? formatValue(active.value) : '';
  const tooltipW = tooltipText.length * 7.5 + TOOLTIP_PAD_X * 2;
  const tooltipX = active
    ? Math.max(0, Math.min(active.x - tooltipW / 2, chartW - tooltipW))
    : 0;
  const tooltipY = active
    ? Math.max(0, active.y - TOOLTIP_H - 8)
    : 0;

  const gradientId = `icGrad_${resolvedColor.replace('#', '')}`;

  if (loading) {
    return (
      <View style={[styles.placeholder, { height: chartH }]}>
        <ActivityIndicator color="#338DFF" />
      </View>
    );
  }

  if (rawPoints.length < 2) {
    return (
      <View style={[styles.placeholder, { height: chartH }]}>
        <Text style={styles.emptyText}>No chart data</Text>
      </View>
    );
  }

  return (
    <View
      style={{ height: chartH + 20, width: '100%' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setMeasuredW(w);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => isInteracting.current}
      onResponderGrant={(e) => {
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
        isInteracting.current = true;
        setActiveIndex(indexForRelX(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        setActiveIndex(indexForRelX(e.nativeEvent.locationX));
      }}
      onResponderRelease={() => {
        isInteracting.current = false;
        releaseTimer.current = setTimeout(() => setActiveIndex(null), 800);
      }}
      onResponderTerminate={() => {
        isInteracting.current = false;
        setActiveIndex(null);
      }}
    >
      {chartW > 0 && (
        <Svg width={chartW} height={chartH}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={resolvedColor} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={resolvedColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill={`url(#${gradientId})`} />
          <Path d={linePath} fill="none" stroke={resolvedColor} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />
          {active && (
            <>
              <Line x1={active.x} y1={0} x2={active.x} y2={chartH}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4,4" />
              <Circle cx={active.x} cy={active.y} r={CROSSHAIR_DOT_R}
                fill={resolvedColor} stroke="#0B0F19" strokeWidth={2} />
              <Rect x={tooltipX} y={tooltipY} width={tooltipW} height={TOOLTIP_H}
                rx={6} fill="#141A26" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
              <SvgText x={tooltipX + tooltipW / 2} y={tooltipY + TOOLTIP_H / 2 + 4}
                fontSize={LABEL_FONT} fontWeight="600" fill="#E8EEF8" textAnchor="middle">
                {tooltipText}
              </SvgText>
            </>
          )}
        </Svg>
      )}
      {active && (
        <View style={[styles.dateLabel, { left: Math.max(0, Math.min(active.x - 40, chartW - 80)) }]}>
          <Text style={styles.dateLabelText}>{active.label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 12, color: '#4A6080' },
  dateLabel: {
    position: 'absolute',
    bottom: 0,
    width: 80,
    alignItems: 'center',
  },
  dateLabelText: {
    fontSize: 10,
    color: '#4A6080',
    fontVariant: ['tabular-nums'],
  },
});
