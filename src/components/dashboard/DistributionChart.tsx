'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartTooltip } from './ChartCard';
import { AXIS_TICK, BAR_CATEGORY_GAP, BAR_RADIUS, MAX_BAR_SIZE, SERIES_COLOR } from './chart-theme';
import type { Bucket } from '@/lib/stats';

/**
 * A bucketed histogram. One flat hue rather than a ramp: bar height already
 * encodes the count, so colour has no second job to do here.
 */
export function DistributionChart({
  title,
  description,
  data,
  unitLabel,
}: {
  title: string;
  description: string;
  data: Bucket[];
  unitLabel: string;
}) {
  const total = data.reduce((sum, b) => sum + b.count, 0);

  return (
    <ChartCard
      title={title}
      description={description}
      tableHeaders={[unitLabel, 'Draws', 'Share']}
      tableRows={data.map((b) => [
        b.label,
        b.count,
        total === 0 ? '0%' : `${((b.count / total) * 100).toFixed(1)}%`,
      ])}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap={BAR_CATEGORY_GAP}
            margin={{ top: 4, right: 0, bottom: 0, left: -20 }}
          >
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as Bucket | undefined;
                if (!point) return null;
                const share = total === 0 ? 0 : (point.count / total) * 100;
                return (
                  <ChartTooltip
                    active={active}
                    label={point.label}
                    value={point.count}
                    suffix={`draws — ${share.toFixed(1)}%`}
                  />
                );
              }}
            />
            <Bar
              dataKey="count"
              fill={SERIES_COLOR}
              radius={BAR_RADIUS}
              maxBarSize={MAX_BAR_SIZE}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
