'use client';

import { Table2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Chart container. The "Show data" toggle is not a nicety — it is the
 * accessibility fallback the chart's colour encoding leans on, so every chart
 * built with this wrapper has a text equivalent by construction.
 */
export function ChartCard({
  title,
  description,
  children,
  tableHeaders,
  tableRows,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tableHeaders?: string[];
  tableRows?: (string | number)[][];
}) {
  const [showTable, setShowTable] = useState(false);
  const hasTable = Boolean(tableHeaders && tableRows);

  return (
    <section className="border-border bg-card rounded-lg border p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>

        {hasTable && (
          <button
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-xs transition-colors"
          >
            <Table2 className="size-3.5" aria-hidden />
            {showTable ? 'Show chart' : 'Show data'}
          </button>
        )}
      </div>

      {showTable && hasTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-card sticky top-0">
              <tr className="border-border text-muted-foreground border-b text-left">
                {tableHeaders!.map((header, i) => (
                  <th
                    key={header}
                    scope="col"
                    className={`py-2 font-medium ${i > 0 ? 'text-right' : ''}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows!.map((row, i) => (
                <tr key={i} className="border-border/50 border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className={`tabular py-1.5 ${j > 0 ? 'text-right' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Shared tooltip. Text uses ink tokens — never the series colour. */
export function ChartTooltip({
  active,
  label,
  value,
  suffix,
}: {
  active?: boolean;
  label?: string;
  value?: number;
  suffix?: string;
}) {
  if (!active || value === undefined) return null;

  return (
    <div className="border-border bg-background rounded-md border px-2.5 py-1.5 shadow-lg">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-semibold">
        {value.toLocaleString()}
        {suffix && <span className="text-muted-foreground ml-1 font-normal">{suffix}</span>}
      </p>
    </div>
  );
}
