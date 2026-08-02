'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartTooltip } from './ChartCard';
import { AXIS_TICK, BAR_CATEGORY_GAP, BAR_RADIUS, MAX_BAR_SIZE, rampStep } from './chart-theme';
import type { NumberFrequency } from '@/lib/stats';

/**
 * Draw count per number. Height carries the magnitude; the sequential fill
 * repeats it so a 69-bar chart can be scanned for hot and cold at a glance.
 * Single series, so no legend — the title says what is plotted.
 */
export function FrequencyChart({
  title,
  description,
  data,
  tickInterval,
}: {
  title: string;
  description: string;
  data: NumberFrequency[];
  tickInterval: number;
}) {
  const counts = data.map((d) => d.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);

  return (
    <ChartCard
      title={title}
      description={description}
      tableHeaders={['Number', 'Times drawn', 'Draws since last']}
      tableRows={data.map((d) => [
        String(d.number).padStart(2, '0'),
        d.count,
        d.gap === null ? 'never drawn' : d.gap,
      ])}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barCategoryGap={BAR_CATEGORY_GAP}
            margin={{ top: 4, right: 0, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as NumberFrequency | undefined;
                if (!point) return null;
                return (
                  <ChartTooltip
                    active={active}
                    label={`Number ${String(point.number).padStart(2, '0')}`}
                    value={point.count}
                    suffix={
                      point.gap === null
                        ? 'draws — never drawn'
                        : `draws — last seen ${point.gap} ago`
                    }
                  />
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={BAR_RADIUS}
              maxBarSize={MAX_BAR_SIZE}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.number} fill={rampStep(d.count, min, max)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
